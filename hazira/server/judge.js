'use strict';

/**
 * judge.js — מנוע ההאזנה והניתוח.
 *
 * הטלפון שולח תמלול חי (interim + final) מה-Web Speech API. המודול הזה מנרמל
 * עברית, משווה מול התשובות הקבילות של הפריט הנוכחי, ומחזיר הכרעה:
 * "correct" / "near" (כמעט — לפידבק חי) / "none".
 *
 * העברית מכניסה כמה מכשולים שחייבים טיפול לפני השוואה:
 *  - ניקוד וטעמים שמנוע הדיבור לפעמים מחזיר
 *  - אותיות סופיות (ך ם ן ף ץ)
 *  - כתיב מלא/חסר ("דגל" מול "דיגל", "וו" מול "ו")
 *  - אותיות שימוש בתחילת מילה (ו/ה/ב/ל/כ/מ/ש) — "הכלב" מול "כלב"
 *  - שגיאות זיהוי דיבור שמחליפות עיצורים דומים (ת/ט, כ/ק, א/ע/ה, ס/ש, ב/ו)
 */

const NIQQUD = /[֑-ׇ]/g;
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const PUNCT = /[־'"`׳״.,!?;:()\[\]{}\-–—_/\\|*+=~^<>@#$%&]/g;

// אותיות שנשמעות כמעט זהה למנוע זיהוי דיבור. כל קבוצה מתכווצת לתו נציג אחד
// רק בהשוואה ה"רכה", אחרי שההשוואה המדויקת נכשלה.
const HOMOPHONES = [
  ['א', 'ע', 'ה'],
  ['ת', 'ט'],
  ['כ', 'ק'],
  ['ס', 'ש'],
  ['ב', 'ו'],
  ['י', 'י'],
];
const HOMOPHONE_MAP = (() => {
  const map = new Map();
  for (const group of HOMOPHONES) for (const ch of group) map.set(ch, group[0]);
  return map;
})();

// אותיות שימוש שאפשר לקלף מתחילת מילה (כולל צירופים כמו "וה", "שה", "כש")
const PREFIXES = ['וה', 'שה', 'כש', 'מה', 'לה', 'בה', 'ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש'];

// מילות מילוי שמנוע הדיבור קולט ואין להן ערך תוכני
const FILLERS = new Set([
  'אה', 'אהh', 'אמ', 'המ', 'הא', 'נו', 'רגע', 'זה', 'זהו', 'הנה', 'אז', 'כאילו',
  'אני', 'חושב', 'חושבת', 'יודע', 'יודעת', 'נראה', 'לי', 'שזה', 'זאת', 'את',
  'של', 'עם', 'יש', 'כן', 'לא', 'אולי', 'בטח', 'באמת', 'וואי', 'איזה', 'מה',
]);

/** נרמול בסיסי: הורדת ניקוד, אותיות סופיות, פיסוק, רווחים כפולים. */
function normalize(text) {
  if (!text) return '';
  let s = String(text).normalize('NFKC').replace(NIQQUD, '');
  s = s.replace(/[ךםןףץ]/g, (ch) => FINALS[ch]);
  s = s.replace(PUNCT, ' ');
  s = s.replace(/[‎‏‪-‮]/g, ''); // סימני כיווניות
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** נרמול "רך" נוסף — לשימוש רק כשההשוואה המדויקת נכשלה. */
function soften(word) {
  let s = word
    .replace(/וו/g, 'ו')
    .replace(/יי/g, 'י')
    .replace(/ג'/g, 'ג');
  s = s.replace(/[֐-׿]/g, (ch) => HOMOPHONE_MAP.get(ch) || ch);
  return s;
}

// שארית קצרה מזו הופכת את הקילוף למסוכן: "מתח" ו"שטח" שתיהן מתחילות באות
// שימוש, ובלי המינימום הזה שתיהן מתכווצות ל"תח" ונחשבות לאותה תשובה.
const MIN_STEM = 3;

/** מסיר אות שימוש מתחילת מילה, כל עוד נשאר גזע ארוך מספיק כדי להיות מילה. */
function stripPrefix(word) {
  for (const p of PREFIXES) {
    if (word.length - p.length >= MIN_STEM && word.startsWith(p)) return word.slice(p.length);
  }
  return word;
}

function tokenize(text, { dropFillers = false } = {}) {
  const tokens = normalize(text).split(' ').filter(Boolean);
  return dropFillers ? tokens.filter((t) => !FILLERS.has(t)) : tokens;
}

/** מרחק לוינשטיין עם גג — מפסיק מוקדם כשברור שהמרחק גדול מדי. */
function levenshtein(a, b, cap = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/** דמיון 0..1 בין שתי מחרוזות. */
function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const max = Math.max(a.length, b.length);
  const cap = Math.ceil(max * 0.5);
  const d = levenshtein(a, b, cap);
  if (d > cap) return 0;
  return 1 - d / max;
}

/**
 * מכין תשובה קבילה לכמה צורות השוואה: מדויקת, בלי אותיות שימוש, ורכה.
 */
function forms(tokens) {
  // "הכלב" ו-"כלב" חייבים להיפגש, אבל אסור לקלף את ה-כ' של "כלב" עצמו —
  // ולכן כל צד מחזיק גם את הצורה המלאה וגם את המקולפת, ומחפשים חיתוך.
  const exact = tokens.join(' ');
  const bare = tokens.map(stripPrefix).join(' ');
  const plain = new Set([exact, bare].filter(Boolean));
  const soft = new Set([...plain].map((f) => f.split(' ').map(soften).join(' ')));
  return { exact, bare, plain, soft };
}

function prepareAnswer(raw) {
  const tokens = tokenize(raw);
  const f = forms(tokens);
  return { raw: String(raw), ...f, words: tokens.length };
}

/** מכין פריט תוכן פעם אחת, כדי לא לנרמל מחדש בכל צ'אנק של דיבור. */
function prepareItem(item) {
  const accepted = [item.answer, ...(item.aliases || [])].filter(Boolean);
  return {
    ...item,
    _accepted: accepted.map(prepareAnswer),
    _maxWords: Math.max(1, ...accepted.map((a) => tokenize(a).length)),
    _rivals: (item.rivals || []).map(prepareAnswer),
  };
}

/**
 * תשובות של פריטים אחרים באותה קטגוריה שמכילות את התשובה הזו. "סודאן"
 * ו"דרום סודאן" הן שתי מדינות שונות, ובלי ההבחנה הזו מי שרואה את סודאן
 * ואומר "דרום סודאן" היה זוכה בנקודה — כי התשובה הקצרה משובצת בארוכה.
 */
const containsWord = (haystack, needle) =>
  haystack === needle || haystack.startsWith(`${needle} `)
  || haystack.endsWith(` ${needle}`) || haystack.includes(` ${needle} `);

// ההשוואה חייבת להיות על אותן צורות שההכרעה עובדת עליהן. "עשרים ואחת"
// מכילה את "אחת" רק אחרי שה-ו' יורדת, ו"שתים עשרה" מכילה את "שתיים" רק
// אחרי שכתיב מלא/חסר מתאחד — שתי השכבות נדרשות.
const comparableForms = (value) => {
  const f = forms(tokenize(value));
  return [...f.plain, ...f.soft];
};

/**
 * מחשב יריבים לכל התשובות בקטגוריה בבת אחת.
 *
 * הצורות מחושבות פעם אחת לכל תשובה ולא לכל זוג: בקטגוריה של מאתיים פריטים
 * ההבדל הוא בין אלפי חישובים למאות, וזה מה שהופך את טעינת השרת למיידית.
 */
function findAllRivals(allAnswers) {
  const prepared = allAnswers.map((answer) => ({ answer, forms: comparableForms(answer) }));
  const result = new Map();
  for (const mine of prepared) {
    if (result.has(mine.answer)) continue;
    result.set(mine.answer, prepared
      .filter((other) => other.answer !== mine.answer
        && other.forms.some((theirs) =>
          mine.forms.some((m) => theirs.length > m.length && containsWord(theirs, m))))
      .map((other) => other.answer));
  }
  return result;
}

/** נוחות לשימוש נקודתי; לקטגוריה שלמה עדיף findAllRivals. */
function findRivals(answer, allAnswers) {
  return findAllRivals(allAnswers).get(answer) || [];
}

/**
 * מחלץ חלונות רצופים של מילים מזנב התמלול. הדיבור זורם, ולכן התשובה הנכונה
 * עשויה להיות משובצת בתוך מלמול ("אהh רגע זה... צרפת נכון?").
 */
function tailWindows(transcript, maxWords) {
  const tokens = tokenize(transcript, { dropFillers: false });
  const clean = tokens.filter((t) => !FILLERS.has(t));
  const windows = new Set();
  for (const source of [tokens, clean]) {
    const start = Math.max(0, source.length - (maxWords + 4));
    for (let i = start; i < source.length; i++) {
      for (let n = 1; n <= maxWords && i + n <= source.length; n++) {
        windows.add(source.slice(i, i + n).join(' '));
      }
    }
  }
  return [...windows].filter(Boolean);
}

// שכבת ההשוואה ה"רכה" כבר בולעת את שגיאות הזיהוי הפונטיות במדויק, ולכן שכבת
// דמיון-המחרוזות יכולה להיות מחמירה. סף נמוך מדי היה מקבל "אוסטריה" כתשובה
// ל"אוסטרליה" — הבדל של אות אחת שמשנה את התשובה לגמרי.
function intersects(a, b) {
  for (const value of a) if (value && b.has(value)) return true;
  return false;
}

const CORRECT_THRESHOLD = 0.9;
const NEAR_THRESHOLD = 0.62;

/**
 * מכריע אם התמלול החי מכיל תשובה נכונה לפריט.
 * @returns {{verdict:'correct'|'near'|'none', score:number, matched:string|null, heard:string|null}}
 */
function judge(transcript, preparedItem) {
  const item = preparedItem._accepted ? preparedItem : prepareItem(preparedItem);
  const windows = tailWindows(transcript, item._maxWords);
  if (windows.length === 0) return { verdict: 'none', score: 0, matched: null, heard: null };

  // אם נאמרה תשובה של פריט אחר בקטגוריה שמכילה את זו — זו לא התשובה הזו
  if (item._rivals?.length) {
    const rivalWords = Math.max(...item._rivals.map((r) => r.words));
    for (const window of tailWindows(transcript, rivalWords)) {
      const heardForms = forms(window.split(' '));
      for (const rival of item._rivals) {
        if (intersects(heardForms.plain, rival.plain) || intersects(heardForms.soft, rival.soft)) {
          return { verdict: 'none', score: 0, matched: null, heard: window, rival: rival.raw };
        }
      }
    }
  }

  let best = { verdict: 'none', score: 0, matched: null, heard: null };

  for (const window of windows) {
    const heardForms = forms(window.split(' '));

    for (const answer of item._accepted) {
      // 1. התאמה מדויקת אחרי נרמול — עם או בלי אות שימוש בפתח המילה
      if (intersects(heardForms.plain, answer.plain)) {
        return { verdict: 'correct', score: 1, matched: answer.raw, heard: window };
      }
      // 2. התאמה רכה: הומופונים (ת/ט, כ/ק, א/ע/ה) וכתיב מלא/חסר
      if (intersects(heardForms.soft, answer.soft)) {
        return { verdict: 'correct', score: 0.97, matched: answer.raw, heard: window };
      }
      // 3. דמיון מחרוזות — רשת ביטחון אחרונה לשגיאות זיהוי ארוכות
      const score = Math.max(
        similarity(heardForms.exact, answer.exact),
        similarity(heardForms.bare, answer.bare),
        similarity([...heardForms.soft][0] || '', [...answer.soft][0] || ''),
      );
      if (score > best.score) {
        best = {
          verdict: score >= CORRECT_THRESHOLD ? 'correct' : score >= NEAR_THRESHOLD ? 'near' : 'none',
          score: Number(score.toFixed(3)),
          matched: score >= NEAR_THRESHOLD ? answer.raw : null,
          heard: window,
        };
      }
    }
    if (best.verdict === 'correct') return best;
  }
  return best;
}

module.exports = {
  normalize,
  soften,
  stripPrefix,
  tokenize,
  levenshtein,
  similarity,
  prepareItem,
  prepareAnswer,
  findRivals,
  findAllRivals,
  forms,
  tailWindows,
  judge,
  CORRECT_THRESHOLD,
  NEAR_THRESHOLD,
};
