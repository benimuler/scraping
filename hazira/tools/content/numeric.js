'use strict';

/**
 * מחוללים מספריים — קטגוריות שהתשובה בהן מספר או שבר.
 *
 * למה דווקא אלה: הן היחידות שאינן חסומות בגודל התחום. אין יותר מתריסר
 * מזלות, אבל יש אינסוף כמויות לספור ואינסוף מספרים לכתוב בגימטריה, ולכן
 * מכאן מגיע רוב העומק של המשחק — עם דירוג קושי אמיתי ולא משוער.
 */

const { W, H, svg, textSvg, poly } = require('./svg');
const { numberWords, numberAliases } = require('./numbers');

const INK = '#ffcc33';
const BG = '#101528';
const PANEL = '#171d33';
const EDGE = '#2b3454';

const polygon = (cx, cy, r, sides, rotation = -Math.PI / 2) => poly(
  Array.from({ length: sides }, (_, i) => {
    const a = rotation + (i * 2 * Math.PI) / sides;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }), INK);

const starShape = (cx, cy, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${INK}"/>`;
};

// ------------------------------------------------------------ ספירת עצמים

/**
 * הצורות מסודרות בשורות של חמש ולא מפוזרות באקראי.
 *
 * זו ההחלטה שהופכת את הקטגוריה מניחוש לספירה: בפיזור אקראי שמונה־עשר
 * עיגולים הם הערכה, ובשורות של חמש אפשר לספור אותם בתוך שעון של ארבעים
 * וחמש שניות. הקושי עולה מהכמות, לא מהבלבול.
 */
const COUNT_SHAPES = [
  ['circle', 'עיגולים', (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>`],
  ['square', 'ריבועים', (cx, cy, r) =>
    `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="4" fill="${INK}"/>`],
  ['triangle', 'משולשים', (cx, cy, r) => polygon(cx, cy, r * 1.15, 3)],
  ['star', 'כוכבים', (cx, cy, r) => starShape(cx, cy, r * 1.2)],
  ['diamond', 'מעוינים', (cx, cy, r) => polygon(cx, cy, r * 1.15, 4)],
];

function countSvg(n, draw) {
  const cols = Math.min(5, n);
  const rows = Math.ceil(n / cols);
  const cellW = (W - 80) / cols;
  const cellH = (H - 80) / rows;
  const r = Math.min(cellW, cellH) * 0.3;
  let body = '';
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // השורה האחרונה ממורכזת, אחרת היא נראית כאילו חסר בה משהו
    const inRow = Math.min(cols, n - row * cols);
    const offset = (cols - inRow) * cellW / 2;
    body += draw(40 + offset + cellW * (col + 0.5), 40 + cellH * (row + 0.5), r);
  }
  return svg(body, { bg: BG });
}

function countCategory() {
  const items = [];
  for (const [slug, , draw] of COUNT_SHAPES) {
    for (let n = 1; n <= 20; n++) {
      const answer = numberWords(n, 'm');
      items.push({
        svg: countSvg(n, draw),
        answer,
        aliases: numberAliases(n, 'm'),
        slug: `${slug}-${n}`,
        difficulty: n <= 4 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : n <= 16 ? 4 : 5,
      });
    }
  }
  return { id: 'count', name: 'כמה יש?', hint: 'כמה צורות רואים?', items };
}

// ------------------------------------------------------------------ קוביות

// מקומות הנקודות על פני קובייה, ביחידות של רוחב הקובייה
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
};

const die = (x, y, size, face) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.14}" ` +
  `fill="#f6f4ef" stroke="${EDGE}" stroke-width="4"/>` +
  PIPS[face].map(([px, py]) =>
    `<circle cx="${(x + px * size).toFixed(1)}" cy="${(y + py * size).toFixed(1)}" ` +
    `r="${(size * 0.085).toFixed(1)}" fill="#1b2136"/>`).join('');

function diceSvg(faces) {
  const size = faces.length === 2 ? 150 : 115;
  const gap = 30;
  const totalW = faces.length * size + (faces.length - 1) * gap;
  const x0 = (W - totalW) / 2;
  const y = (H - size) / 2;
  return svg(faces.map((f, i) => die(x0 + i * (size + gap), y, size, f)).join(''), { bg: BG });
}

function diceCategory() {
  const items = [];
  const push = (faces, difficulty) => {
    const sum = faces.reduce((a, b) => a + b, 0);
    const answer = numberWords(sum);
    items.push({
      svg: diceSvg(faces),
      answer,
      aliases: numberAliases(sum),
      slug: `d${faces.join('')}`,
      difficulty,
    });
  };

  // שתי קוביות: כל שלושים ושש האפשרויות, כי (2,5) ו-(5,2) הן שתי תמונות שונות
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) push([a, b], a + b <= 6 ? 1 : a + b <= 9 ? 2 : 3);
  }
  // שלוש קוביות: רק צירופים לא מסודרים, אחרת אותה בעיה חוזרת בשש גרסאות
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      for (let c = b; c <= 6; c++) push([a, b, c], a + b + c <= 10 ? 4 : 5);
    }
  }
  return { id: 'dice', name: 'קוביות', hint: 'מה הסכום?', items };
}

// -------------------------------------------------------------------- שברים

// שם השבר בעברית: שליש ורבע מתנהגים כזכר, וכל השאר בצורת "יות" הנקבית
const FRACTION_NAMES = {
  2: ['חצי', null, 'm'],
  3: ['שליש', 'שלישים', 'm'],
  4: ['רבע', 'רבעים', 'm'],
  5: ['חמישית', 'חמישיות', 'f'],
  6: ['שישית', 'שישיות', 'f'],
  7: ['שביעית', 'שביעיות', 'f'],
  8: ['שמינית', 'שמיניות', 'f'],
  9: ['תשיעית', 'תשיעיות', 'f'],
  10: ['עשירית', 'עשיריות', 'f'],
};

// צורת הנסמך: "שני שלישים", "שתי חמישיות" — ולא "שניים שלישים"
const COUNTER = {
  m: ['', '', 'שני', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'],
  f: ['', '', 'שתי', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'],
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function fractionWords(k, n) {
  const [single, plural, gender] = FRACTION_NAMES[n];
  if (k === 1) return single;
  return `${COUNTER[gender][k]} ${plural}`;
}

/** פס מחולק לתאים גלויים — כדי שאפשר לספור את החלקים ולא להעריך אותם. */
function fractionBarSvg(k, n) {
  const w = W - 120;
  const cell = w / n;
  const y = H / 2 - 60;
  const cells = Array.from({ length: n }, (_, i) =>
    `<rect x="${(60 + i * cell).toFixed(1)}" y="${y}" width="${cell.toFixed(1)}" height="120" ` +
    `fill="${i < k ? INK : PANEL}" stroke="${EDGE}" stroke-width="4"/>`).join('');
  return svg(cells, { bg: BG });
}

/** אותם שברים כעוגה — תמונה שנייה לאותו מושג, עם קווי חלוקה גלויים. */
function fractionPieSvg(k, n) {
  const cx = W / 2;
  const cy = H / 2;
  const r = 150;
  const point = (i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  };
  const slices = Array.from({ length: n }, (_, i) =>
    `<path d="M${cx},${cy} L${point(i)} A${r},${r} 0 0,1 ${point(i + 1)} Z" ` +
    `fill="${i < k ? INK : PANEL}" stroke="${EDGE}" stroke-width="4"/>`).join('');
  return svg(slices, { bg: BG });
}

function fractionCategory() {
  const items = [];
  for (const shape of ['bar', 'pie']) {
    for (const n of Object.keys(FRACTION_NAMES).map(Number)) {
      for (let k = 1; k < n; k++) {
        // רק שברים מצומצמים: שני רבעים נראה בדיוק כמו חצי, וזו תמונה
        // עם שתי תשובות נכונות ושם אחד — בדיוק מה שאסור כאן
        if (gcd(k, n) !== 1) continue;
        const answer = fractionWords(k, n);
        items.push({
          svg: shape === 'bar' ? fractionBarSvg(k, n) : fractionPieSvg(k, n),
          answer,
          aliases: [`${numberWords(k, 'm')} חלקי ${numberWords(n)}`, `${k} חלקי ${n}`],
          slug: `${shape}-${k}-${n}`,
          difficulty: n <= 3 ? 1 : n <= 5 ? 2 : n <= 7 ? 3 : n <= 9 ? 4 : 5,
        });
      }
    }
  }
  return { id: 'fractions', name: 'שברים', hint: 'איזה שבר צבוע?', items };
}

// ----------------------------------------------------------------- גימטריה

const G_UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const G_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const G_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/**
 * מספר באותיות עבריות.
 *
 * חמש־עשרה ושש־עשרה נכתבות ט״ו וט״ז ולא י״ה וי״ו, כדי לא לכתוב שם שמיימי —
 * וזה לא קוריוז אלא הכתיב היחיד שמופיע על לוחות שנה, בדפי גמרא ובכל מקום
 * שבו מישהו באמת ייתקל במספר הזה.
 */
function hebrewNumeral(n) {
  let rest = n;
  let letters = '';
  while (rest >= 500) {
    letters += 'ת';
    rest -= 400;
  }
  letters += G_HUNDREDS[Math.floor(rest / 100)];
  rest %= 100;
  if (rest === 15) letters += 'טו';
  else if (rest === 16) letters += 'טז';
  else {
    letters += G_TENS[Math.floor(rest / 10)];
    letters += G_UNITS[rest % 10];
  }
  if (letters.length === 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

function gematriaCategory({ max = 400 } = {}) {
  const items = [];
  for (let n = 1; n <= max; n++) {
    const answer = numberWords(n);
    items.push({
      svg: textSvg(hebrewNumeral(n), { size: 200 }),
      answer,
      aliases: numberAliases(n),
      slug: `g${n}`,
      difficulty: n <= 10 ? 1 : n <= 30 ? 2 : n <= 99 ? 3 : n <= 200 ? 4 : 5,
    });
  }
  return { id: 'gematria', name: 'גימטריה', hint: 'איזה מספר?', items };
}

function build() {
  return [countCategory(), diceCategory(), fractionCategory(), gematriaCategory()];
}

module.exports = { build, hebrewNumeral, fractionWords };
