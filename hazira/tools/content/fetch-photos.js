'use strict';
/**
 * Reviewed photo pools live in photos-data/<category>.json.
 * Do not automatically substitute Wikipedia search hits: a licensed photo can
 * still be the wrong subject (the old pipeline selected a portrait for lotus).
 *
 * node tools/content/fetch-photos.js            Offline safety validation.
 * node tools/content/fetch-photos.js --refresh  Recheck current Commons license
 * metadata, preserving reviewed image choices. Writes only if ALL checks pass.
 * New subjects require exact-page provenance and manual pixel review first.
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, 'photos-data');
const strip = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const free = (s) => /^(CC BY(?:-SA)? [1234]|CC0|Public domain)/.test(s) && !/NC|ND/.test(s);
function validate(category) {
  const answers = new Set();
  const images = new Set();
  for (const item of category.items) {
    if (!item.answer || !item.reviewed) throw Error(`${category.id}: missing answer/pixel review`);
    if (!free(item.license) || !item.artist || !item.credit) throw Error(`${category.id}/${item.answer}: missing free license/credit`);
    const source = new URL(item.source);
    const image = new URL(item.image);
    if (source.hostname !== 'commons.wikimedia.org' || !source.pathname.startsWith('/wiki/File:')) throw Error('Invalid Commons source');
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(image.hostname) || !/\.(jpe?g|png|webp)$/i.test(image.pathname)) throw Error('Not a reviewed raster asset');
    if (answers.has(item.answer) || images.has(item.image)) throw Error(`${category.id}: duplicate answer/image`);
    answers.add(item.answer); images.add(item.image);
  }
}
async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  const categories = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  categories.forEach(validate);
  if (process.argv.includes('--refresh')) {
    for (const c of categories) {
      for (let n = 0; n < c.items.length; n += 20) {
        const batch = c.items.slice(n, n + 20);
        const titles = batch.map((i) => decodeURIComponent(new URL(i.source).pathname.slice('/wiki/'.length)));
        const url = new URL('https://commons.wikimedia.org/w/api.php');
        url.search = new URLSearchParams({action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'extmetadata', titles: titles.join('|')});
        const response = await fetch(url, {headers: {'User-Agent': 'PicDuelContent/2.0 (hazirapicduel@mailfence.com)'}});
        if (!response.ok) throw Error(`Commons ${response.status}; no files written`);
        const data = await response.json();
        const pages = new Map((data.query?.pages || []).map((p) => [p.title.replaceAll(' ', '_'), p]));
        batch.forEach((i, k) => {
          const meta = pages.get(titles[k].replaceAll(' ', '_'))?.imageinfo?.[0]?.extmetadata;
          const license = strip(meta?.LicenseShortName?.value);
          const artist = strip(meta?.Artist?.value);
          if (!free(license) || !artist) throw Error(`${titles[k]} no longer passes; no files written`);
          i.license = license; i.artist = artist; i.credit = `${artist} · ${license}`;
          i.licenseUrl = meta.LicenseUrl?.value || '';
        });
      }
    }
    categories.forEach(validate);
    categories.forEach((c, n) => fs.writeFileSync(path.join(DIR, files[n]), JSON.stringify(c, null, 2) + '\n'));
  }
  console.log(`${categories.length} reviewed categories, ${categories.reduce((n, c) => n + c.items.length, 0)} items validated`);
}
if (require.main === module) main().catch((e) => { console.error(e.message); process.exitCode = 1; });
module.exports = { validate, free };
