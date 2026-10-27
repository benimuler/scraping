'use strict';

/**
 * בונה את photos-data.json: לכל פריט ב-photos-def.js שולף את תמונת הערך
 * מוויקיפדיה העברית (pageimage — תמונה אמיתית), ובונוס: קרדיט ורישיון
 * מוויקימדיה קומונס. הריצו פעם אחת וכשמעדכנים הגדרות:
 *
 *   node tools/content/fetch-photos.js
 *
 * התוצאה נכנסת לריפו, כדי שה-build (גם ב-Render) לא יהיה תלוי ברשת.
 */

const fs = require('fs');
const path = require('path');
const { CATEGORIES } = require('./photos-def');

const HE_API = 'https://he.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const OUT = path.join(__dirname, 'photos-data.json');
const THUMB_WIDTH = 640;

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'user-agent': 'hazira-content-builder/1.0 (trivia game; contact: hazirapicduel@mailfence.com)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const stripHtml = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * מחזיר מפה title-> {image, pageimage} לערכים שיש להם תמונה.
 * המפתח הוא הכותרת המקורית מההגדרות, גם אחרי הפניות ונרמול —
 * אחרת "ארנב" הולך לאיבוד כשוויקיפדיה פותרת אותו ל"ארנבים".
 */
async function fetchThumbs(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await api(HE_API, {
      prop: 'pageimages',
      piprop: 'thumbnail',
      pithumbsize: String(THUMB_WIDTH),
      redirects: '1',
      titles: batch.join('|'),
    });
    const resolved = new Map();
    for (const n of data.query?.normalized || []) resolved.set(n.to, n.from);
    for (const r of data.query?.redirects || []) resolved.set(r.to, resolved.get(r.from) || r.from);
    for (const page of Object.values(data.query?.pages || {})) {
      if (!page.thumbnail?.source) continue;
      const from = resolved.get(page.title) || page.title;
      out.set(from, { image: page.thumbnail.source, pageimage: page.pageimage });
    }
  }
  // fallback לכותרות שהשאילתה המקובצת החמיצה: REST summary עוקב אחרי הפניות,
  // ואם גם זה לא מצליח — חיפוש חופשי ולוקחים את התוצאה הראשונה
  for (const title of titles) {
    if (out.has(title)) continue;
    try {
      const search = await api(HE_API, { list: 'search', srsearch: title, srnamespace: '0', srlimit: '1' });
      const hit = search.query?.search?.[0]?.title;
      if (hit) {
        const data = await api(HE_API, {
          prop: 'pageimages', piprop: 'thumbnail', pithumbsize: String(THUMB_WIDTH), redirects: '1', titles: hit,
        });
        const page = data.query?.pages?.[0];
        if (page?.thumbnail?.source) {
          out.set(title, { image: page.thumbnail.source, pageimage: page.pageimage });
          continue;
        }
      }
    } catch { /* ממשיכים ל-REST */ }
    try {
      const res = await fetch(`https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { 'user-agent': 'hazira-content-builder/1.0 (contact: hazirapicduel@mailfence.com)' },
      });
      if (!res.ok) continue;
      const d = await res.json();
      const image = d.thumbnail?.source;
      if (!image) continue;
      // שם הקובץ מחולץ מה-URL כדי שנוכל למשוך קרדיט מקומונס
      const clean = image.split('?')[0];
      const m = clean.match(/\/thumb\/[^/]+\/[^/]+\/([^/]+)\//) || clean.match(/\/wikipedia\/[^/]+\/[^/]+\/[^/]+\/([^/]+)$/);
      out.set(title, { image, pageimage: m ? decodeURIComponent(m[1]) : null });
    } catch { /* השאר בלי תמונה */ }
  }
  return out;
}

/** קרדיט ורישיון לקבצים מקומונס, באצוות של 50. */
async function fetchCredits(pageimages) {
  const out = new Map();
  const titles = pageimages.map((f) => `File:${f}`);
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await api(COMMONS_API, { prop: 'imageinfo', iiprop: 'extmetadata', titles: batch.join('|') });
    for (const page of Object.values(data.query?.pages || {})) {
      const meta = page.imageinfo?.[0]?.extmetadata;
      if (!meta) continue;
      const artist = stripHtml(meta.Artist?.value);
      const license = stripHtml(meta.LicenseShortName?.value);
      const file = (page.title || '').replace(/^File:/, '');
      if (artist || license) out.set(file, { artist, license });
    }
  }
  return out;
}

async function main() {
  const titles = [...new Set(CATEGORIES.flatMap((c) => c.items.map((i) => i[0])))];
  console.log(`שולף תמונות ל-${titles.length} ערכים…`);
  const thumbs = await fetchThumbs(titles);

  const missing = titles.filter((t) => !thumbs.has(t));
  if (missing.length) console.warn(`⚠ בלי תמונה (${missing.length}): ${missing.join(', ')}`);

  console.log('שולף קרדיטים מקומונס…');
  const credits = await fetchCredits([...new Set([...thumbs.values()].map((t) => t.pageimage).filter(Boolean))]);

  let itemCount = 0;
  const categories = [];
  for (const cat of CATEGORIES) {
    const items = [];
    for (const [title, answer, aliases, difficulty] of cat.items) {
      const thumb = thumbs.get(title);
      if (!thumb) continue;
      const credit = credits.get(thumb.pageimage);
      items.push({
        image: thumb.image,
        answer,
        aliases,
        difficulty,
        credit: credit ? [credit.artist, credit.license].filter(Boolean).join(' · ') : 'ויקימדיה קומונס',
        source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(thumb.pageimage)}`,
      });
      itemCount++;
    }
    if (items.length >= 10) categories.push({ id: cat.id, name: cat.name, hint: cat.hint, items });
    else console.warn(`⚠ הקטגוריה ${cat.id} נשארה עם ${items.length} פריטים — נשמטת`);
  }

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), categories }, null, 2));
  console.log(`נכתבו ${categories.length} קטגוריות, ${itemCount} פריטים עם תמונה, ל-${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
