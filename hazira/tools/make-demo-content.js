'use strict';

/**
 * יוצר חבילת תוכן הדגמה: קבצי SVG מקומיים + קובצי JSON של קטגוריות.
 * הדגלים משורטטים בקוד; שאר הקטגוריות משתמשות באמוג'י בתוך SVG.
 * להחלפה בתוכן אמיתי: ערכו את ה-JSON תחת content/packs והצביעו על תמונות משלכם.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'content');
const MEDIA = path.join(ROOT, 'media');
const PACKS = path.join(ROOT, 'packs');

const W = 600;
const H = 400;

const svg = (body, { w = W, h = H, bg = '#fff' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
  `<rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;

// ---------------------------------------------------------------- דגלים

const vertical = (...colors) => svg(colors.map((c, i) =>
  `<rect x="${(W / colors.length) * i}" y="0" width="${W / colors.length}" height="${H}" fill="${c}"/>`).join(''));

const horizontal = (...colors) => svg(colors.map((c, i) =>
  `<rect x="0" y="${(H / colors.length) * i}" width="${W}" height="${H / colors.length}" fill="${c}"/>`).join(''));

const stripesWeighted = (bands) => {
  const total = bands.reduce((s, b) => s + b[1], 0);
  let y = 0;
  return svg(bands.map(([c, weight]) => {
    const height = (H * weight) / total;
    const rect = `<rect x="0" y="${y}" width="${W}" height="${height}" fill="${c}"/>`;
    y += height;
    return rect;
  }).join(''));
};

const disc = (bg, color, cy = H / 2) =>
  svg(`<rect width="${W}" height="${H}" fill="${bg}"/><circle cx="${W / 2}" cy="${cy}" r="110" fill="${color}"/>`);

/** צלב נורדי: מוסט שמאלה, עם אפשרות לצלב פנימי בצבע שני. */
const nordic = (bg, cross, inner = null) => {
  const x = W * 0.34;
  const y = H / 2;
  const t = 70;
  const ti = 34;
  let body = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  body += `<rect x="0" y="${y - t / 2}" width="${W}" height="${t}" fill="${cross}"/>`;
  body += `<rect x="${x - t / 2}" y="0" width="${t}" height="${H}" fill="${cross}"/>`;
  if (inner) {
    body += `<rect x="0" y="${y - ti / 2}" width="${W}" height="${ti}" fill="${inner}"/>`;
    body += `<rect x="${x - ti / 2}" y="0" width="${ti}" height="${H}" fill="${inner}"/>`;
  }
  return svg(body);
};

const swissCross = () => svg(
  `<rect width="${W}" height="${H}" fill="#d52b1e"/>` +
  `<rect x="${W / 2 - 30}" y="${H / 2 - 100}" width="60" height="200" fill="#fff"/>` +
  `<rect x="${W / 2 - 100}" y="${H / 2 - 30}" width="200" height="60" fill="#fff"/>`);

const starOfDavid = (cx, cy, r, color) => {
  const pts = (rot) => Array.from({ length: 3 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 3;
    return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts(0)}" fill="none" stroke="${color}" stroke-width="14"/>` +
         `<polygon points="${pts(Math.PI)}" fill="none" stroke="${color}" stroke-width="14"/>`;
};

const israel = () => svg(
  `<rect width="${W}" height="${H}" fill="#fff"/>` +
  `<rect x="0" y="48" width="${W}" height="46" fill="#0038b8"/>` +
  `<rect x="0" y="${H - 94}" width="${W}" height="46" fill="#0038b8"/>` +
  starOfDavid(W / 2, H / 2, 82, '#0038b8'));

const canada = () => svg(
  `<rect width="${W}" height="${H}" fill="#fff"/>` +
  `<rect x="0" y="0" width="150" height="${H}" fill="#d52b1e"/>` +
  `<rect x="${W - 150}" y="0" width="150" height="${H}" fill="#d52b1e"/>` +
  `<path transform="translate(${W / 2},${H / 2}) scale(1.9)" fill="#d52b1e" d="M0,-52 L8,-30 L26,-40 L18,-14 L40,-16 L32,-2 L52,10 L30,18 L34,32 L12,28 L14,52 L0,38 L-14,52 L-12,28 L-34,32 L-30,18 L-52,10 L-32,-2 L-40,-16 L-18,-14 L-26,-40 L-8,-30 Z"/>`);

const FLAGS = [
  ['france', 'צרפת', ['הרפובליקה הצרפתית'], () => vertical('#002395', '#ffffff', '#ed2939')],
  ['italy', 'איטליה', [], () => vertical('#009246', '#ffffff', '#ce2b37')],
  ['ireland', 'אירלנד', [], () => vertical('#169b62', '#ffffff', '#ff883e')],
  ['belgium', 'בלגיה', [], () => vertical('#000000', '#fdda24', '#ef3340')],
  ['romania', 'רומניה', [], () => vertical('#002b7f', '#fcd116', '#ce1126')],
  ['nigeria', 'ניגריה', [], () => vertical('#008751', '#ffffff', '#008751')],
  ['peru', 'פרו', [], () => vertical('#d91023', '#ffffff', '#d91023')],
  ['germany', 'גרמניה', [], () => horizontal('#000000', '#dd0000', '#ffce00')],
  ['netherlands', 'הולנד', ['ארצות הברית של הולנד', 'הולנד'], () => horizontal('#ae1c28', '#ffffff', '#21468b')],
  ['russia', 'רוסיה', [], () => horizontal('#ffffff', '#0039a6', '#d52b1e')],
  ['austria', 'אוסטריה', [], () => horizontal('#ed2939', '#ffffff', '#ed2939')],
  ['ukraine', 'אוקראינה', [], () => horizontal('#0057b7', '#ffd700')],
  ['poland', 'פולין', [], () => horizontal('#ffffff', '#dc143c')],
  ['indonesia', 'אינדונזיה', [], () => horizontal('#ce1126', '#ffffff')],
  ['hungary', 'הונגריה', [], () => horizontal('#ce2939', '#ffffff', '#477050')],
  ['bulgaria', 'בולגריה', [], () => horizontal('#ffffff', '#00966e', '#d62612')],
  ['estonia', 'אסטוניה', [], () => horizontal('#4891d9', '#000000', '#ffffff')],
  ['lithuania', 'ליטא', [], () => horizontal('#fdb913', '#006a44', '#c1272d')],
  ['armenia', 'ארמניה', [], () => horizontal('#d90012', '#0033a0', '#f2a800')],
  ['colombia', 'קולומביה', [], () => stripesWeighted([['#fcd116', 2], ['#003893', 1], ['#ce1126', 1]])],
  ['spain', 'ספרד', [], () => stripesWeighted([['#aa151b', 1], ['#f1bf00', 2], ['#aa151b', 1]])],
  ['thailand', 'תאילנד', [], () => stripesWeighted([['#a51931', 1], ['#f4f5f8', 1], ['#2d2a4a', 2], ['#f4f5f8', 1], ['#a51931', 1]])],
  ['japan', 'יפן', [], () => disc('#ffffff', '#bc002d')],
  ['bangladesh', 'בנגלדש', [], () => disc('#006a4e', '#f42a41')],
  ['denmark', 'דנמרק', [], () => nordic('#c60c30', '#ffffff')],
  ['sweden', 'שוודיה', [], () => nordic('#006aa7', '#fecc00')],
  ['finland', 'פינלנד', [], () => nordic('#ffffff', '#003580')],
  ['norway', 'נורווגיה', [], () => nordic('#ba0c2f', '#ffffff', '#00205b')],
  ['iceland', 'איסלנד', [], () => nordic('#02529c', '#ffffff', '#dc1e35')],
  ['switzerland', 'שווייץ', ['שוויץ'], swissCross],
  ['israel', 'ישראל', [], israel],
  ['canada', 'קנדה', [], canada],
];

// ------------------------------------------------------- קטגוריות אמוג'י

const emojiSvg = (glyph) => svg(
  `<rect width="${W}" height="${H}" fill="#f6f4ef"/>` +
  `<text x="${W / 2}" y="${H / 2}" font-size="230" text-anchor="middle" dominant-baseline="central">${glyph}</text>`);

const EMOJI_PACKS = [
  {
    id: 'animals', name: 'חיות', hint: 'איזו חיה?',
    items: [
      ['🦁', 'אריה'], ['🐘', 'פיל'], ['🦒', 'ג׳ירפה', ['גירפה']], ['🐊', 'תנין'],
      ['🦓', 'זברה'], ['🐬', 'דולפין'], ['🦉', 'ינשוף'], ['🐿️', 'סנאי'],
      ['🦔', 'קיפוד'], ['🐫', 'גמל'], ['🦅', 'נשר'], ['🐧', 'פינגווין'],
      ['🦇', 'עטלף'], ['🐝', 'דבורה'], ['🦂', 'עקרב'], ['🐙', 'תמנון'],
      ['🦈', 'כריש'], ['🐺', 'זאב'], ['🦌', 'איל', ['צבי']], ['🐢', 'צב'],
    ],
  },
  {
    id: 'food', name: 'פירות וירקות', hint: 'מה זה?',
    items: [
      ['🍎', 'תפוח'], ['🍌', 'בננה'], ['🍇', 'ענבים'], ['🍉', 'אבטיח'],
      ['🍓', 'תות'], ['🍍', 'אננס'], ['🥑', 'אבוקדו'], ['🍆', 'חציל'],
      ['🥕', 'גזר'], ['🌽', 'תירס'], ['🥦', 'ברוקולי'], ['🧄', 'שום'],
      ['🧅', 'בצל'], ['🍋', 'לימון'], ['🥝', 'קיווי'], ['🍑', 'אפרסק'],
      ['🥔', 'תפוח אדמה', ['תפוד']], ['🫑', 'פלפל'], ['🍅', 'עגבנייה', ['עגבניה']], ['🥥', 'קוקוס'],
    ],
  },
  {
    id: 'instruments', name: 'כלי נגינה', hint: 'איזה כלי נגינה?',
    items: [
      ['🎸', 'גיטרה'], ['🎹', 'פסנתר'], ['🎻', 'כינור'], ['🥁', 'תופים', ['תוף']],
      ['🎺', 'חצוצרה'], ['🎷', 'סקסופון'], ['🪕', 'בנג׳ו', ['בנגו']], ['🪗', 'אקורדיון'],
      ['🪈', 'חליל'], ['🎤', 'מיקרופון'], ['🔔', 'פעמון'], ['🪘', 'דרבוקה', ['תוף כף יד']],
    ],
  },
  {
    id: 'sports', name: 'ענפי ספורט', hint: 'איזה ענף ספורט?',
    items: [
      ['⚽', 'כדורגל'], ['🏀', 'כדורסל'], ['🎾', 'טניס'], ['🏐', 'כדורעף'],
      ['🏈', 'פוטבול', ['כדורגל אמריקאי']], ['⚾', 'בייסבול'], ['🏓', 'טניס שולחן', ['פינג פונג']],
      ['🏸', 'בדמינטון'], ['🥊', 'אגרוף'], ['⛳', 'גולף'], ['🏊', 'שחייה', ['שחיה']],
      ['🚴', 'רכיבה על אופניים', ['אופניים']], ['🤺', 'סיוף'], ['🏹', 'קשתות'],
      ['⛷️', 'סקי'], ['🏄', 'גלישה', ['גלישת גלים']],
    ],
  },
  {
    id: 'transport', name: 'כלי תחבורה', hint: 'איזה כלי תחבורה?',
    items: [
      ['🚗', 'מכונית', ['אוטו']], ['🚌', 'אוטובוס'], ['🚂', 'רכבת', ['קטר']], ['✈️', 'מטוס'],
      ['🚁', 'מסוק'], ['🚤', 'סירה', ['סירת מנוע']], ['🚲', 'אופניים'], ['🛵', 'קטנוע'],
      ['🚜', 'טרקטור'], ['🚑', 'אמבולנס'], ['🚒', 'כבאית'], ['🚕', 'מונית'],
      ['🛴', 'קורקינט'], ['🚀', 'רקטה', ['חללית']], ['⛵', 'מפרשית'], ['🚇', 'רכבת תחתית'],
    ],
  },
  {
    id: 'weather', name: 'מזג אוויר וטבע', hint: 'מה רואים?',
    items: [
      ['🌈', 'קשת'], ['⚡', 'ברק'], ['❄️', 'פתית שלג', ['שלג']], ['🌊', 'גל'],
      ['🌋', 'הר געש'], ['🏜️', 'מדבר'], ['🌪️', 'טורנדו', ['סופת טורנדו']], ['☂️', 'מטרייה', ['מטריה']],
      ['🌙', 'ירח'], ['⭐', 'כוכב'], ['🌵', 'קקטוס'], ['🍂', 'עלי שלכת', ['שלכת']],
      ['🔥', 'אש'], ['💧', 'טיפת מים', ['מים']], ['🏔️', 'הר מושלג', ['הר']], ['🌴', 'דקל'],
    ],
  },
];

// ----------------------------------------------------------------- כתיבה

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

function build({ force = false } = {}) {
  // התוכן נוצר אוטומטית ולא נשמר ב-git, ולכן הבנייה רצה גם לפני start ו-test.
  // אם הוא כבר קיים אין מה לעשות — אלא אם ביקשו במפורש לבנות מחדש.
  if (!force && fs.existsSync(PACKS) && fs.readdirSync(PACKS).some((f) => f.endsWith('.json'))) {
    return;
  }
  fs.rmSync(MEDIA, { recursive: true, force: true });
  fs.rmSync(PACKS, { recursive: true, force: true });

  const flagItems = FLAGS.map(([slug, answer, aliases, draw]) => {
    write(path.join(MEDIA, 'flags', `${slug}.svg`), draw());
    return { image: `/media/flags/${slug}.svg`, answer, aliases };
  });
  write(path.join(PACKS, 'flags.json'), JSON.stringify({
    id: 'flags', name: 'דגלי מדינות', hint: 'איזו מדינה?', items: flagItems,
  }, null, 2));

  for (const pack of EMOJI_PACKS) {
    const items = pack.items.map(([glyph, answer, aliases = []], i) => {
      const slug = `${pack.id}-${i}`;
      write(path.join(MEDIA, pack.id, `${slug}.svg`), emojiSvg(glyph));
      return { image: `/media/${pack.id}/${slug}.svg`, answer, aliases };
    });
    write(path.join(PACKS, `${pack.id}.json`), JSON.stringify({
      id: pack.id, name: pack.name, hint: pack.hint, items,
    }, null, 2));
  }

  const packs = fs.readdirSync(PACKS);
  const total = packs.reduce((sum, f) =>
    sum + JSON.parse(fs.readFileSync(path.join(PACKS, f), 'utf8')).items.length, 0);
  console.log(`נוצרו ${packs.length} קטגוריות, ${total} פריטים.`);
}

if (require.main === module) build({ force: process.argv.includes('--force') });
module.exports = { build };
