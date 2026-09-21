'use strict';

/**
 * קטגוריות ששורטטו בקוד. היתרון על פני אמוג'י: שליטה מלאה בתמונה, ולכן
 * אפשר לבנות פריטים שאין להם אמוג'י — דגל מדויק, שעון שמראה שעה מסוימת,
 * או צורה גאומטרית נקייה.
 */

const { W, H, svg, textSvg } = require('./svg');

// ----------------------------------------------------------------- דגלים

const vertical = (...colors) => svg(colors.map((c, i) =>
  `<rect x="${(W / colors.length) * i}" y="0" width="${W / colors.length}" height="${H}" fill="${c}"/>`).join(''));

const horizontal = (...colors) => svg(colors.map((c, i) =>
  `<rect x="0" y="${(H / colors.length) * i}" width="${W}" height="${H / colors.length}" fill="${c}"/>`).join(''));

const bands = (rows) => {
  const total = rows.reduce((s, b) => s + b[1], 0);
  let y = 0;
  return svg(rows.map(([c, weight]) => {
    const h = (H * weight) / total;
    const rect = `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${c}"/>`;
    y += h;
    return rect;
  }).join(''));
};

const disc = (bg, color) =>
  svg(`<rect width="${W}" height="${H}" fill="${bg}"/><circle cx="${W / 2}" cy="${H / 2}" r="110" fill="${color}"/>`);

/** צלב נורדי: מוסט שמאלה, עם אפשרות לצלב פנימי בצבע שני. */
const nordic = (bg, cross, inner = null) => {
  const x = W * 0.34;
  const y = H / 2;
  let body = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  body += `<rect x="0" y="${y - 35}" width="${W}" height="70" fill="${cross}"/>`;
  body += `<rect x="${x - 35}" y="0" width="70" height="${H}" fill="${cross}"/>`;
  if (inner) {
    body += `<rect x="0" y="${y - 17}" width="${W}" height="34" fill="${inner}"/>`;
    body += `<rect x="${x - 17}" y="0" width="34" height="${H}" fill="${inner}"/>`;
  }
  return svg(body);
};

const star = (cx, cy, r, color, points = 5) => {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.38;
    const a = (i * Math.PI) / points - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
};

const starOfDavid = (cx, cy, r, color) => {
  const tri = (rot) => Array.from({ length: 3 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 3;
    return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${tri(0)}" fill="none" stroke="${color}" stroke-width="14"/>` +
         `<polygon points="${tri(Math.PI)}" fill="none" stroke="${color}" stroke-width="14"/>`;
};

const FLAGS = {
  europe: [
    ['france', 'צרפת', () => vertical('#002395', '#ffffff', '#ed2939')],
    ['italy', 'איטליה', () => vertical('#009246', '#ffffff', '#ce2b37')],
    ['ireland', 'אירלנד', () => vertical('#169b62', '#ffffff', '#ff883e')],
    ['belgium', 'בלגיה', () => vertical('#000000', '#fdda24', '#ef3340')],
    ['romania', 'רומניה', () => vertical('#002b7f', '#fcd116', '#ce1126')],
    ['germany', 'גרמניה', () => horizontal('#000000', '#dd0000', '#ffce00')],
    ['netherlands', 'הולנד', () => horizontal('#ae1c28', '#ffffff', '#21468b')],
    ['russia', 'רוסיה', () => horizontal('#ffffff', '#0039a6', '#d52b1e')],
    ['austria', 'אוסטריה', () => horizontal('#ed2939', '#ffffff', '#ed2939')],
    ['ukraine', 'אוקראינה', () => horizontal('#0057b7', '#ffd700')],
    ['poland', 'פולין', () => horizontal('#ffffff', '#dc143c')],
    ['hungary', 'הונגריה', () => horizontal('#ce2939', '#ffffff', '#477050')],
    ['bulgaria', 'בולגריה', () => horizontal('#ffffff', '#00966e', '#d62612')],
    ['estonia', 'אסטוניה', () => horizontal('#4891d9', '#000000', '#ffffff')],
    ['lithuania', 'ליטא', () => horizontal('#fdb913', '#006a44', '#c1272d')],
    ['armenia', 'ארמניה', () => horizontal('#d90012', '#0033a0', '#f2a800')],
    ['spain', 'ספרד', () => bands([['#aa151b', 1], ['#f1bf00', 2], ['#aa151b', 1]])],
    ['denmark', 'דנמרק', () => nordic('#c60c30', '#ffffff')],
    ['sweden', 'שוודיה', () => nordic('#006aa7', '#fecc00')],
    ['finland', 'פינלנד', () => nordic('#ffffff', '#003580')],
    ['norway', 'נורווגיה', () => nordic('#ba0c2f', '#ffffff', '#00205b')],
    ['iceland', 'איסלנד', () => nordic('#02529c', '#ffffff', '#dc1e35')],
    ['switzerland', 'שווייץ', 'שוויץ', () => svg(
      `<rect width="${W}" height="${H}" fill="#d52b1e"/>` +
      `<rect x="${W / 2 - 30}" y="${H / 2 - 100}" width="60" height="200" fill="#fff"/>` +
      `<rect x="${W / 2 - 100}" y="${H / 2 - 30}" width="200" height="60" fill="#fff"/>`)],
    ['greece', 'יוון', () => svg(
      Array.from({ length: 9 }, (_, i) =>
        `<rect x="0" y="${(H / 9) * i}" width="${W}" height="${H / 9}" fill="${i % 2 ? '#fff' : '#0d5eaf'}"/>`).join('') +
      `<rect x="0" y="0" width="${(H / 9) * 5}" height="${(H / 9) * 5}" fill="#0d5eaf"/>` +
      `<rect x="${(H / 9) * 2}" y="0" width="${H / 9}" height="${(H / 9) * 5}" fill="#fff"/>` +
      `<rect x="0" y="${(H / 9) * 2}" width="${(H / 9) * 5}" height="${H / 9}" fill="#fff"/>`)],
    ['portugal', 'פורטוגל', () => svg(
      `<rect width="${W}" height="${H}" fill="#f00"/>` +
      `<rect width="${W * 0.4}" height="${H}" fill="#006600"/>` +
      `<circle cx="${W * 0.4}" cy="${H / 2}" r="70" fill="#ffd700"/>`)],
  ],
  world: [
    ['japan', 'יפן', () => disc('#ffffff', '#bc002d')],
    ['bangladesh', 'בנגלדש', () => disc('#006a4e', '#f42a41')],
    ['israel', 'ישראל', () => svg(
      `<rect width="${W}" height="${H}" fill="#fff"/>` +
      `<rect x="0" y="48" width="${W}" height="46" fill="#0038b8"/>` +
      `<rect x="0" y="${H - 94}" width="${W}" height="46" fill="#0038b8"/>` +
      starOfDavid(W / 2, H / 2, 82, '#0038b8'))],
    ['canada', 'קנדה', () => svg(
      `<rect width="${W}" height="${H}" fill="#fff"/>` +
      `<rect x="0" y="0" width="150" height="${H}" fill="#d52b1e"/>` +
      `<rect x="${W - 150}" y="0" width="150" height="${H}" fill="#d52b1e"/>` +
      `<path transform="translate(${W / 2},${H / 2}) scale(1.9)" fill="#d52b1e" d="M0,-52 L8,-30 L26,-40 L18,-14 L40,-16 L32,-2 L52,10 L30,18 L34,32 L12,28 L14,52 L0,38 L-14,52 L-12,28 L-34,32 L-30,18 L-52,10 L-32,-2 L-40,-16 L-18,-14 L-26,-40 L-8,-30 Z"/>`)],
    ['nigeria', 'ניגריה', () => vertical('#008751', '#ffffff', '#008751')],
    ['peru', 'פרו', () => vertical('#d91023', '#ffffff', '#d91023')],
    ['indonesia', 'אינדונזיה', () => horizontal('#ce1126', '#ffffff')],
    ['colombia', 'קולומביה', () => bands([['#fcd116', 2], ['#003893', 1], ['#ce1126', 1]])],
    ['thailand', 'תאילנד', () => bands([['#a51931', 1], ['#f4f5f8', 1], ['#2d2a4a', 2], ['#f4f5f8', 1], ['#a51931', 1]])],
    ['argentina', 'ארגנטינה', () => bands([['#74acdf', 1], ['#ffffff', 1], ['#74acdf', 1]])],
    ['india', 'הודו', () => svg(
      bands([['#ff9933', 1], ['#ffffff', 1], ['#138808', 1]]).match(/<rect[^>]*\/>/g).join('') +
      `<circle cx="${W / 2}" cy="${H / 2}" r="55" fill="none" stroke="#000080" stroke-width="8"/>`)],
    ['vietnam', 'וייטנאם', () => svg(
      `<rect width="${W}" height="${H}" fill="#da251d"/>` + star(W / 2, H / 2, 105, '#ffff00'))],
    ['morocco', 'מרוקו', () => svg(
      `<rect width="${W}" height="${H}" fill="#c1272d"/>` +
      `<polygon points="${[0, 1, 2, 3, 4].map((i) => {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        return `${(W / 2 + 95 * Math.cos(a)).toFixed(1)},${(H / 2 + 95 * Math.sin(a)).toFixed(1)}`;
      }).join(' ')}" fill="none" stroke="#006233" stroke-width="12"/>`)],
    ['turkey', 'טורקיה', () => svg(
      `<rect width="${W}" height="${H}" fill="#e30a17"/>` +
      `<circle cx="${W * 0.38}" cy="${H / 2}" r="80" fill="#fff"/>` +
      `<circle cx="${W * 0.44}" cy="${H / 2}" r="64" fill="#e30a17"/>` +
      star(W * 0.58, H / 2, 42, '#fff'))],
    ['china', 'סין', () => svg(
      `<rect width="${W}" height="${H}" fill="#de2910"/>` + star(140, 110, 62, '#ffde00') +
      [[250, 55], [300, 105], [300, 175], [250, 225]].map(([x, y]) => star(x, y, 22, '#ffde00')).join(''))],
    ['brazil', 'ברזיל', () => svg(
      `<rect width="${W}" height="${H}" fill="#009b3a"/>` +
      `<polygon points="${W / 2},40 ${W - 60},${H / 2} ${W / 2},${H - 40} 60,${H / 2}" fill="#fedf00"/>` +
      `<circle cx="${W / 2}" cy="${H / 2}" r="75" fill="#002776"/>`)],
  ],
};

// ------------------------------------------------------ צורות, צבעים, זמן

const COLORS = [
  ['#e63946', 'אדום'], ['#1d3557', 'כחול'], ['#2a9d8f', 'טורקיז'], ['#43aa8b', 'ירוק'],
  ['#f4a261', 'כתום'], ['#e9c46a', 'צהוב'], ['#9b5de5', 'סגול'], ['#f15bb5', 'ורוד'],
  ['#8d5524', 'חום'], ['#000000', 'שחור'], ['#ffffff', 'לבן'], ['#808080', 'אפור'],
];

const SHAPES = [
  ['עיגול', `<circle cx="${W / 2}" cy="${H / 2}" r="130"/>`],
  ['ריבוע', `<rect x="${W / 2 - 130}" y="${H / 2 - 130}" width="260" height="260"/>`],
  ['מלבן', `<rect x="${W / 2 - 180}" y="${H / 2 - 100}" width="360" height="200"/>`],
  ['משולש', `<polygon points="${W / 2},60 ${W / 2 + 150},340 ${W / 2 - 150},340"/>`],
  ['מעוין', `<polygon points="${W / 2},50 ${W / 2 + 130},200 ${W / 2},350 ${W / 2 - 130},200"/>`],
  ['טרפז', `<polygon points="${W / 2 - 90},90 ${W / 2 + 90},90 ${W / 2 + 170},310 ${W / 2 - 170},310"/>`],
  ['אליפסה', `<ellipse cx="${W / 2}" cy="${H / 2}" rx="180" ry="110"/>`],
  ['מחומש', `<polygon points="${Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    return `${(W / 2 + 140 * Math.cos(a)).toFixed(1)},${(H / 2 + 140 * Math.sin(a)).toFixed(1)}`;
  }).join(' ')}"/>`],
  ['משושה', `<polygon points="${Array.from({ length: 6 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 6;
    return `${(W / 2 + 140 * Math.cos(a)).toFixed(1)},${(H / 2 + 140 * Math.sin(a)).toFixed(1)}`;
  }).join(' ')}"/>`],
  ['כוכב', star(W / 2, H / 2, 150, 'currentColor')],
  ['חץ', `<polygon points="${W / 2 - 150},170 ${W / 2 + 40},170 ${W / 2 + 40},100 ${W / 2 + 170},200 ${W / 2 + 40},300 ${W / 2 + 40},230 ${W / 2 - 150},230"/>`],
  ['לב', `<path d="M300,330 C160,240 180,120 250,120 C285,120 300,150 300,165 C300,150 315,120 350,120 C420,120 440,240 300,330 Z"/>`],
];

/** שעון אנלוגי שמראה שעה מסוימת. */
const clockSvg = (hour, minute) => {
  const cx = W / 2;
  const cy = H / 2;
  const r = 150;
  const hourAngle = ((hour % 12) + minute / 60) * 30 - 90;
  const minAngle = minute * 6 - 90;
  const hand = (angle, len, width, color) =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx + len * Math.cos((angle * Math.PI) / 180)).toFixed(1)}" ` +
    `y2="${(cy + len * Math.sin((angle * Math.PI) / 180)).toFixed(1)}" stroke="${color}" ` +
    `stroke-width="${width}" stroke-linecap="round"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    return `<circle cx="${(cx + (r - 18) * Math.cos(a)).toFixed(1)}" ` +
      `cy="${(cy + (r - 18) * Math.sin(a)).toFixed(1)}" r="5" fill="#98a3c7"/>`;
  }).join('');
  return svg(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#171d33" stroke="#2b3454" stroke-width="6"/>` +
    ticks + hand(hourAngle, 85, 12, '#eef2ff') + hand(minAngle, 125, 7, '#ffcc33') +
    `<circle cx="${cx}" cy="${cy}" r="9" fill="#ffcc33"/>`,
    { bg: '#101528' },
  );
};

const CLOCK_TIMES = [
  [3, 0, 'שלוש'], [6, 0, 'שש'], [9, 0, 'תשע'], [12, 0, 'שתים עשרה'],
  [1, 30, 'אחת וחצי'], [4, 30, 'ארבע וחצי'], [7, 15, 'שבע ורבע'], [10, 45, 'עשר וארבעים וחמש'],
  [2, 15, 'שתיים ורבע'], [5, 45, 'רבע לשש'], [8, 30, 'שמונה וחצי'], [11, 0, 'אחת עשרה'],
];

const HEBREW_LETTERS = [
  ['א', 'אלף'], ['ב', 'בית'], ['ג', 'גימל'], ['ד', 'דלת'], ['ה', 'הא'],
  ['ו', 'וו'], ['ז', 'זין'], ['ח', 'חית'], ['ט', 'טית'], ['י', 'יוד'],
  ['כ', 'כף'], ['ל', 'למד'], ['מ', 'מם'], ['נ', 'נון'], ['ס', 'סמך'],
  ['ע', 'עין'], ['פ', 'פא'], ['צ', 'צדי'], ['ק', 'קוף'], ['ר', 'ריש'],
  ['ש', 'שין'], ['ת', 'תו'],
];

function build() {
  const cats = [];

  for (const [group, label] of [['europe', 'אירופה'], ['world', 'העולם']]) {
    cats.push({
      id: `flags-${group}`,
      name: `דגלי ${label}`,
      hint: 'איזו מדינה?',
      items: FLAGS[group].map((entry) => {
        const draw = entry[entry.length - 1];
        const aliases = entry.slice(2, -1);
        return { svg: draw(), answer: entry[1], aliases, slug: entry[0] };
      }),
    });
  }

  cats.push({
    id: 'colors', name: 'צבעים', hint: 'איזה צבע?',
    items: COLORS.map(([hex, answer], i) => ({
      svg: svg(`<rect x="60" y="40" width="${W - 120}" height="${H - 80}" rx="24" fill="${hex}" stroke="#2b3454" stroke-width="3"/>`, { bg: '#101528' }),
      answer, slug: `color-${i}`,
    })),
  });

  cats.push({
    id: 'shapes', name: 'צורות', hint: 'איזו צורה?',
    items: SHAPES.map(([answer, path], i) => ({
      svg: svg(path.replace('currentColor', '#ffcc33').replace(/(<(?:circle|rect|polygon|ellipse|path)\b)/, '$1 fill="#ffcc33"'), { bg: '#101528' }),
      answer, slug: `shape-${i}`,
    })),
  });


  cats.push({
    id: 'hebrew-letters', name: 'אותיות עבריות', hint: 'איזו אות?',
    items: HEBREW_LETTERS.map(([glyph, answer]) => ({
      svg: textSvg(glyph, { size: 220 }), answer, slug: `letter-${answer}`,
    })),
  });

  return cats;
}

module.exports = { build };
