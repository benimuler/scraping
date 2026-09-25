'use strict';

/**
 * שעון, ספרות רומיות וחשבון — שלושה תחומים פתוחים.
 *
 * רוב התחומים סופיים מטבעם: יש שנים־עשר מזלות ועשרים ושתיים אותיות, וזה כל
 * מה שקיים. כאן אין תקרה כזו, ולכן מכאן מגיע חלק גדול מהעומק של המשחק —
 * ועם דירוג קושי אמיתי, שנגזר מהפריט עצמו ולא ממקומו ברשימה.
 */

const { svg, W, H } = require('./svg');
const { numberWords, numberAliases } = require('./numbers');

// ------------------------------------------------------------------ שעון

const HOUR_WORDS = ['שתים עשרה', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש',
  'שבע', 'שמונה', 'תשע', 'עשר', 'אחת עשרה'];

function clockSvg(hour, minute) {
  const cx = W / 2;
  const cy = H / 2;
  const r = 150;
  const hand = (angle, len, width, color) =>
    `<line x1="${cx}" y1="${cy}" x2="${(cx + len * Math.cos((angle * Math.PI) / 180)).toFixed(1)}" ` +
    `y2="${(cy + len * Math.sin((angle * Math.PI) / 180)).toFixed(1)}" stroke="${color}" ` +
    `stroke-width="${width}" stroke-linecap="round"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    return `<circle cx="${(cx + (r - 18) * Math.cos(a)).toFixed(1)}" ` +
      `cy="${(cy + (r - 18) * Math.sin(a)).toFixed(1)}" r="5" fill="#98a3c7"/>`;
  }).join('');
  return svg(
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#171d33" stroke="#2b3454" stroke-width="6"/>` +
    ticks +
    hand(((hour % 12) + minute / 60) * 30 - 90, 85, 12, '#eef2ff') +
    hand(minute * 6 - 90, 125, 7, '#ffcc33') +
    `<circle cx="${cx}" cy="${cy}" r="9" fill="#ffcc33"/>`,
    { bg: '#101528' },
  );
}

/** איך אומרים שעה בעברית מדוברת. */
function timeWords(hour, minute) {
  const h = HOUR_WORDS[hour % 12];
  const next = HOUR_WORDS[(hour + 1) % 12];
  if (minute === 0) return h;
  if (minute === 15) return `${h} ורבע`;
  if (minute === 30) return `${h} וחצי`;
  if (minute === 45) return `רבע ל${next}`;
  if (minute === 20) return `${h} ועשרים`;
  if (minute === 40) return `עשרים ל${next}`;
  if (minute === 25) return `${h} עשרים וחמש`;
  if (minute === 35) return `${h} שלושים וחמש`;
  return `${h} ${minute}`;
}

/**
 * הקושי עולה לפי כמה ה"קריאה" של השעה מיידית: שעה עגולה, חצי, רבעים, ואז
 * העשרים והחמישיות.
 *
 * שתי הגבלות, ושתיהן בגלל השפה ולא בגלל הקוד:
 *
 * המרווחים של עשר ועשרים דקות מושמטים לגמרי — בעברית מדוברת "אחת ועשרה"
 * ו"אחת עשרה" כמעט זהות, וכך גם "שתיים ועשרה" מול "שתים עשרה".
 *
 * והניסוחים הארוכים (עשרים, עשרים וחמש) קיימים רק לשעות אחת עד תשע. שמות
 * השעות עשר, אחת עשרה ושתים עשרה נבדלים באות אחת בלבד, וברגע שנוסף להם זנב
 * ארוך — "עשר ועשרים" מול "אחת עשרה ועשרים" — ההבדל נעלם בתוך המשפט ומנוע
 * ההכרעה מקבל כל אחת מהן במקום השנייה.
 */
const SAFE_MINUTES = [[0], [30], [15], [45]];
const LONG_MINUTES = [[20, 40], [25, 35]];
const AMBIGUOUS_HOURS = new Set([10, 11, 12]);

function clockCategory() {
  const items = [];
  const push = (hour, minute, difficulty) => items.push({
    svg: clockSvg(hour, minute),
    answer: timeWords(hour, minute),
    slug: `${hour}-${minute}`,
    difficulty,
  });

  SAFE_MINUTES.forEach((minutes, tier) => {
    for (const minute of minutes) for (let hour = 1; hour <= 12; hour++) push(hour, minute, tier + 1);
  });
  LONG_MINUTES.forEach((minutes) => {
    for (const minute of minutes) {
      for (let hour = 1; hour <= 12; hour++) {
        if (!AMBIGUOUS_HOURS.has(hour)) push(hour, minute, 5);
      }
    }
  });
  return { id: 'clock', name: 'שעון', hint: 'מה השעה?', items };
}

// --------------------------------------------------------- ספרות רומיות

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'],
  [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function toRoman(n) {
  let out = '';
  let rest = n;
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

function romanCategory({ max = 600 } = {}) {
  const items = [];
  for (let n = 1; n <= max; n++) {
    const symbol = toRoman(n);
    // אורך הסימון הוא מדד הקושי הישיר: I קל, DLXXXVIII קשה
    const difficulty = Math.min(5, Math.max(1, Math.ceil(symbol.length / 2)));
    const answer = numberWords(n);
    items.push({
      text: symbol, answer, aliases: numberAliases(n), slug: `r${n}`, difficulty,
    });
  }
  return { id: 'roman', name: 'ספרות רומיות', hint: 'איזה מספר?', items };
}

// ----------------------------------------------------------------- חשבון

/**
 * החשבון בנוי כמשפחות תרגילים, וכל משפחה היא דרגת קושי אחת.
 *
 * הדירוג אינו לפי גודל המספר אלא לפי מה שהתרגיל דורש: חיבור חד-ספרתי הוא
 * שליפה מהזיכרון, כפל דו-ספרתי הוא חישוב בראש תוך ארבעים וחמש שניות מול
 * שעון שרץ. לכן חילוק קשה מכפל, ואחוזים קשים מכולם.
 */
function mathCategory() {
  const items = [];
  const seen = new Set();
  const push = (text, value, difficulty) => {
    if (seen.has(text)) return;
    seen.add(text);
    const answer = numberWords(value);
    items.push({
      text,
      answer,
      aliases: numberAliases(value),
      slug: `m${items.length}`,
      difficulty,
    });
  };

  // 1 — שליפה מהזיכרון
  for (let a = 2; a <= 10; a++) for (let b = 2; b <= 9; b++) push(`${a} + ${b}`, a + b, 1);
  for (let n = 3; n <= 30; n++) push(`${n} + ${n}`, n * 2, 1);

  // 2 — חיסור חד-ספרתי ולוח הכפל
  for (let a = 11; a <= 20; a++) for (let b = 2; b <= 9; b++) push(`${a} − ${b}`, a - b, 2);
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) push(`${a} × ${b}`, a * b, 2);

  // 3 — חיבור דו-ספרתי
  for (let a = 11; a <= 48; a++) for (let b = 11; b <= 19; b++) push(`${a} + ${b}`, a + b, 3);
  for (let n = 2; n <= 25; n++) push(`${n} × ${n}`, n * n, 3);

  // 4 — חיסור דו-ספרתי וחילוק
  for (let a = 41; a <= 78; a++) for (let b = 11; b <= 19; b++) push(`${a} − ${b}`, a - b, 4);
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 9; b++) push(`${a * b} ÷ ${b}`, a, 4);

  // 5 — כפל דו-ספרתי, שורשים ואחוזים
  for (let a = 11; a <= 25; a++) for (let b = 3; b <= 9; b++) push(`${a} × ${b}`, a * b, 5);
  for (let n = 2; n <= 25; n++) push(`√${n * n}`, n, 5);
  for (const pct of [10, 20, 25, 50, 75]) {
    for (let base = 20; base <= 200; base += 20) {
      if ((base * pct) % 100) continue;   // רק תוצאות שלמות
      push(`${pct}% מתוך ${base}`, (base * pct) / 100, 5);
    }
  }

  return { id: 'math', name: 'חשבון', hint: 'כמה יוצא?', items };
}

function build() {
  return [clockCategory(), romanCategory(), mathCategory()];
}

module.exports = { build, toRoman, timeWords };
