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
// Exact official object/media pairs, individually checked for selected-media CC0 rights.
const NMNH_MEDIA = {"nmnhmineralsciences_17124213":{"source":"https://www.si.edu/object/nmnhmineralsciences_17124213","mediaID":"ark:/65665/m3e4558f4224274d4794f5a6d9c78dbf24","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3e4558f4224274d4794f5a6d9c78dbf24&max_w=800"},"nmnhmineralsciences_1008594":{"source":"https://www.si.edu/object/opal%3Anmnhmineralsciences_1008594","mediaID":"ark:/65665/m33af5655485d44cf59dbb4c8c563808a8","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m33af5655485d44cf59dbb4c8c563808a8&max_w=800"},"nmnhmineralsciences_1105408":{"source":"https://www.si.edu/object/beryl-var-aquamarine:nmnhmineralsciences_1105408","mediaID":"ark:/65665/m30d94671f6ee8479487a6b4f0cfae8d5f","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m30d94671f6ee8479487a6b4f0cfae8d5f&max_w=800"},"nmnhmineralsciences_1079737":{"source":"https://www.si.edu/object/topaz%3Anmnhmineralsciences_1079737","mediaID":"ark:/65665/m3d063bd4d3ccd452298364572e7133a96","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3d063bd4d3ccd452298364572e7133a96&max_w=800"},"nmnhmineralsciences_16580233":{"source":"https://www.si.edu/object/nmnhmineralsciences_16580233","mediaID":"ark:/65665/m30153e2b1fb614146a2c086f1a23b0cc4","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m30153e2b1fb614146a2c086f1a23b0cc4&max_w=800"},"nmnhmineralsciences_1174303":{"source":"https://www.si.edu/object/elbaite:nmnhmineralsciences_1174303","mediaID":"ark:/65665/m3c7cd06dba803492190018e93806ca44f","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3c7cd06dba803492190018e93806ca44f&max_w=800"},"nmnhmineralsciences_1082279":{"source":"https://www.si.edu/object/beryl-var-emerald:nmnhmineralsciences_1082279","mediaID":"ark:/65665/m3b949c5d43a8e414fa69eceaae90e3f05","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3b949c5d43a8e414fa69eceaae90e3f05&max_w=800"},"nmnhmineralsciences_11722358":{"source":"https://www.si.edu/object/spinel:nmnhmineralsciences_11722358","mediaID":"ark:/65665/m3f85fcfdff6a345b39275ffeabd829789","image":"https://ids.si.edu/ids/deliveryService?id=ark:/65665/m3f85fcfdff6a345b39275ffeabd829789&max_w=800"},"nmnhmineralsciences_10209820":{"source":"https://naturalhistory.si.edu/object/nmnhmineralsciences_10209820","mediaID":"ark:/65665/m31861ef226ed344e4b5a154a76f064b6c","image":"https://ids.si.edu/ids/deliveryService?max=800&id=ark:/65665/m31861ef226ed344e4b5a154a76f064b6c"},"nmnhmineralsciences_1000714":{"source":"https://www.naturalhistory.si.edu/object/nmnhmineralsciences_1000714","mediaID":"ark:/65665/m3eb01b22b80d542d7933e61a42ae5a7b9","image":"https://ids.si.edu/ids/deliveryService?max=800&id=ark:/65665/m3eb01b22b80d542d7933e61a42ae5a7b9"}};
function reviewedAsset(item) {
  const source = new URL(item.source);
  const image = new URL(item.image);
  if (source.protocol !== 'https:' || image.protocol !== 'https:') throw Error('Asset must use HTTPS');
  const commons = source.hostname === 'commons.wikimedia.org' && source.pathname.startsWith('/wiki/File:') &&
    ['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(image.hostname) && /\.(jpe?g|png|webp)$/i.test(image.pathname);
  const id = source.pathname.match(/^\/art\/collection\/search\/(\d+)$/)?.[1];
  const met = ['www.metmuseum.org', 'metmuseum.org'].includes(source.hostname) && id &&
    image.hostname === 'images.metmuseum.org' && /^\/CRDImages\/[a-z]+\/(web-large|original)\/[^/]+\.jpg$/i.test(image.pathname) &&
    item.provider === 'met' && item.objectID === Number(id) && item.isPublicDomain === true &&
    item.license === 'CC0' && item.licenseUrl === 'https://www.metmuseum.org/openaccess' &&
    item.metadataSource === `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
  const mediaID = source.hostname === 'airandspace.si.edu' && source.pathname.match(/^\/collection-media\/(NASM-[A-Za-z0-9-]+)$/)?.[1];
  const smithsonian = mediaID && item.provider === 'smithsonian-nasm' && item.mediaID === mediaID &&
    image.hostname === 'ids.si.edu' && image.pathname === '/ids/deliveryService' && image.searchParams.get('id') === mediaID &&
    [...image.searchParams.keys()].every(k=>['id','max_w'].includes(k)) && image.searchParams.get('max_w') === '900' &&
    item.license === 'CC0' && item.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/';
  const observationID = source.hostname === 'www.inaturalist.org' && source.pathname.match(/^\/observations\/(\d+)$/)?.[1];
  const photoID = image.hostname === 'inaturalist-open-data.s3.amazonaws.com' && image.pathname.match(/^\/photos\/(\d+)\/large\.(jpe?g)$/)?.[1];
  const inatLicense = {cc0:['CC0','https://creativecommons.org/publicdomain/zero/1.0/'], 'cc-by':['CC BY 4.0','https://creativecommons.org/licenses/by/4.0/'], 'cc-by-sa':['CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/']}[item.photoLicenseCode];
  const inaturalist = observationID && photoID && item.provider === 'inaturalist' && item.observationID === Number(observationID) &&
    item.photoID === Number(photoID) && item.metadataSource === `https://api.inaturalist.org/v1/observations/${observationID}` &&
    item.taxonName && inatLicense && item.license === inatLicense[0] && item.licenseUrl === inatLicense[1];
  const bound = NMNH_MEDIA[item.objectID];
  const nmnh = item.provider === 'smithsonian-nmnh' && bound &&
    item.source === bound.source && item.image === bound.image && item.mediaID === bound.mediaID &&
    item.isPublicDomain === true && item.metadataSource === item.source &&
    item.license === 'CC0' && item.licenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (!commons && !met && !smithsonian && !inaturalist && !nmnh) throw Error('Invalid reviewed asset provenance');
}
function validate(category) {
  const answers = new Set();
  const images = new Set();
  for (const item of category.items) {
    if (!item.answer || !item.reviewed) throw Error(`${category.id}: missing answer/pixel review`);
    if (!free(item.license) || !item.artist || !item.credit) throw Error(`${category.id}/${item.answer}: missing free license/credit`);
    reviewedAsset(item);
    if (answers.has(item.answer) || images.has(item.image)) throw Error(`${category.id}: duplicate answer/image`);
    answers.add(item.answer); images.add(item.image);
  }
}
async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  const categories = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
  categories.forEach(validate);
  if (process.argv.includes('--refresh')) {
    if (categories.some(c => c.items.some(i => ['smithsonian-nasm','smithsonian-nmnh','inaturalist'].includes(i.provider))))
      throw Error('Issuer-specific manual rights refresh required; no files written');
    // Never apply Commons metadata to another issuer. Recheck exact Met object.
    for (const c of categories) for (const i of c.items.filter(i => i.provider === 'met')) {
      const response = await fetch(i.metadataSource);
      if (!response.ok) throw Error(`Met ${response.status}; no files written`);
      const object = await response.json();
      if (object.objectID !== i.objectID || object.isPublicDomain !== true ||
          ![object.primaryImage, object.primaryImageSmall].includes(i.image) ||
          object.objectURL !== i.source) throw Error('Met provenance changed; no files written');
    }
    for (const c of categories) {
      for (let n = 0; n < c.items.length; n += 20) {
        const batch = c.items.slice(n, n + 20).filter((i) => !i.provider);
        if (!batch.length) continue;
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
module.exports = { validate, free, reviewedAsset };
