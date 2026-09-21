'use strict';

/**
 * קטגוריות שנוצרות בקוד ולכן אינן חסומות בגודל.
 *
 * רוב התחומים סופיים מטבעם — יש שנים־עשר מזלות ועשרים ושתיים אותיות, וזה
 * כל מה שקיים. התחומים כאן הם היוצאים מן הכלל: שעה, מספר וחישוב הם מרחבים
 * פתוחים, ולכן אפשר לייצר מהם מאות פריטים עם דירוג קושי אמיתי ולא משוער.
 */

const { svg, textSvg, W, H } = require('./svg');

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
  if (minute === 10) return `${h} ועשרה`;
  if (minute === 50) return `עשרה ל${next}`;
  if (minute === 5) return `${h} וחמישה`;
  if (minute === 55) return `חמישה ל${next}`;
  if (minute === 25) return `${h} עשרים וחמש`;
  if (minute === 35) return `${h} שלושים וחמש`;
  return `${h} ${minute}`;
}

/**
 * הקושי עולה לפי כמה ה"קריאה" של השעה מיידית: שעה עגולה, חצי, ואז רבעים.
 *
 * המרווחים של עשר ועשרים דקות הושמטו בכוונה: בעברית מדוברת "אחת ועשרה"
 * ו"אחת עשרה" כמעט זהות, וכך גם "שתיים ועשרה" מול "שתים עשרה". מנוע
 * ההכרעה לא יכול להבחין ביניהן, ולכן השעון מוגבל לניסוחים חד-משמעיים —
 * מה שגם חוסם אותו על ארבעים ושמונה פריטים.
 */
const MINUTE_TIERS = [[0], [30], [15], [45]];

function clockCategory() {
  const items = [];
  MINUTE_TIERS.forEach((minutes, tier) => {
    for (const minute of minutes) {
      for (let hour = 1; hour <= 12; hour++) {
        items.push({
          svg: clockSvg(hour, minute),
          answer: timeWords(hour, minute),
          slug: `${hour}-${minute}`,
          difficulty: tier + 1,
        });
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

const ONES = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה',
  'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות',
  'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];

/** מספר במילים, לפי הצורה שבה אומרים אותו בקול. */
function numberWords(n) {
  if (n >= 1000) {
    const rest = n % 1000;
    return rest ? `אלף ו${numberWords(rest)}`.replace('ו אלף', 'אלף') : 'אלף';
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[h];
  if (!rest) return head;
  // בעברית מדוברת יש ו' לפני היחידות: "ארבעים וארבע", לא "ארבעים ארבע"
  const tail = rest < 10 ? ONES[rest]
    : rest < 20 ? TEENS[rest - 10]
      : rest % 10 === 0 ? TENS[Math.floor(rest / 10)]
        : `${TENS[Math.floor(rest / 10)]} ו${ONES[rest % 10]}`;
  return head ? `${head} ${tail}` : tail;
}

/** ניסוחים נוספים שנשמעים בדיבור: בלי ו' החיבור, ובספרות. */
function spokenVariants(n) {
  const words = numberWords(n);
  const variants = new Set([String(n), words.replace(/ ו/g, ' ')]);
  variants.delete(words);
  return [...variants];
}

function romanCategory({ max = 260 } = {}) {
  const items = [];
  for (let n = 1; n <= max; n++) {
    const symbol = toRoman(n);
    // אורך הסימון הוא מדד הקושי הישיר: I קל, MMXLVIII קשה
    const difficulty = Math.min(5, Math.max(1, Math.ceil(symbol.length / 2)));
    items.push({
      text: symbol, answer: numberWords(n), aliases: spokenVariants(n), slug: `r${n}`, difficulty,
    });
  }
  return { id: 'roman', name: 'ספרות רומיות', hint: 'איזה מספר?', items };
}

// ----------------------------------------------------------------- חשבון

function mathCategory() {
  const items = [];
  const push = (text, value, difficulty) =>
    items.push({
      text, answer: numberWords(value), aliases: spokenVariants(value),
      slug: text.replace(/\s|[+×÷−-]/g, '_'), difficulty,
    });

  for (let a = 2; a <= 10; a++) for (let b = 2; b <= 9; b++) push(`${a} + ${b}`, a + b, 1);
  for (let a = 11; a <= 20; a++) for (let b = 2; b <= 9; b++) push(`${a} − ${b}`, a - b, 2);
  for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) push(`${a} × ${b}`, a * b, 3);
  for (let a = 2; a <= 12; a++) for (let b = 2; b <= 9; b++) push(`${a * b} ÷ ${b}`, a, 4);
  for (let a = 11; a <= 25; a++) for (let b = 3; b <= 9; b++) push(`${a} × ${b}`, a * b, 5);

  return { id: 'math', name: 'חשבון', hint: 'כמה יוצא?', items };
}

function build() {
  return [clockCategory(), romanCategory(), mathCategory()];
}

module.exports = { build, toRoman, numberWords, timeWords };
