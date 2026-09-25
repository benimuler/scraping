'use strict';

/**
 * מרכיב את כל מקורות התוכן לחבילות שהשרת טוען.
 *
 * המקורות מחזירים צורות שונות — אמוג'י, SVG משורטט, או רמז מילולי — וכאן
 * הם מתנרמלים לפורמט אחד: קובץ תמונה תחת content/media, או שדה text.
 */

const fs = require('fs');
const path = require('path');

const { emojiSvg } = require('./svg');
const emoji = require('./emoji');
const text = require('./text');
const countries = require('./countries');
const drawn = require('./drawn');
const flags = require('./flags');
const generated = require('./generated');
const numeric = require('./numeric');
const { judge, couldMatchProfile, transcriptProfile, prepareItem, findAllRivals } = require('../../server/judge');

const ROOT = path.join(__dirname, '..', '..', 'content');
const MEDIA = path.join(ROOT, 'media');
const PACKS = path.join(ROOT, 'packs');

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, 'utf8');
}

const slugify = (value, fallback) =>
  String(value).replace(/[^\w֐-׿-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;

/** מנרמל קטגוריה אחת ממקור כלשהו לפורמט החבילות. */
function normalize(category, kind) {
  const items = category.items.map((item, index) => {
    // מקורות אמוג'י וטקסט מחזירים מערך: [רמז, תשובה, ...נרדפות]
    if (Array.isArray(item)) {
      const [clue, answer, ...aliases] = item;
      if (kind === 'emoji') {
        // שם הקובץ נגזר מנקודות הקוד של האמוג'י ולא ממקומו ברשימה: כך הוספת
        // פריט באמצע אינה משנה את שמות כל השאר, ואמוג'י שנכתב פעמיים נופל
        // על אותו שם ומסולק בניכוי הכפילויות. בלי זה כפילות הייתה עוברת.
        const slug = [...clue].map((ch) => ch.codePointAt(0).toString(16)).join('-');
        write(path.join(MEDIA, category.id, `${slug}.svg`), emojiSvg(clue));
        return { image: `/media/${category.id}/${slug}.svg`, answer, aliases };
      }
      return { text: clue, answer, aliases };
    }
    // מקורות משורטטים מחזירים אובייקט עם svg מוכן או רמז מילולי
    if (item.svg) {
      const slug = slugify(item.slug, `${category.id}-${index}`);
      write(path.join(MEDIA, category.id, `${slug}.svg`), item.svg);
      return {
        image: `/media/${category.id}/${slug}.svg`,
        answer: item.answer,
        aliases: item.aliases || [],
        difficulty: item.difficulty,
      };
    }
    return {
      text: item.text,
      answer: item.answer,
      aliases: item.aliases || [],
      difficulty: item.difficulty,
    };
  });

  return { id: category.id, name: category.name, hint: category.hint || null, items };
}

const BANDS = 5;

/**
 * מקצה דרגת קושי 1..5 לכל פריט.
 *
 * מקור שיודע לדרג בעצמו (מחולל פרמטרי, למשל) מספק difficulty מפורש. אחרת
 * הדרגה נגזרת ממקום הפריט ברשימה: הרשימות נכתבו מהמוכר אל הנדיר, ולכן
 * המיקום הוא קירוב סביר לקושי.
 */
function assignDifficulty(category) {
  const total = category.items.length;
  category.items.forEach((item, index) => {
    if (item.difficulty) return;
    item.difficulty = Math.min(BANDS, Math.floor((index / total) * BANDS) + 1);
  });
  return category;
}

/**
 * תשובות דומות מדי באותה קטגוריה שוברות את המשחק: מנוע ההכרעה יקבל את
 * "קונגו" גם כשהתמונה היא "רפובליקת קונגו", והשחקן יזכה בנקודה על טעות.
 * לכן כל קטגוריה נבדקת מול עצמה לפני שהיא נכתבת.
 */
function findCollisions(category) {
  const collisions = [];
  // אותה הכנה שהשרת עושה בזמן ריצה, כולל יריבים — אחרת נדווח על התנגשויות
  // שמנוע ההכרעה כבר יודע להבחין ביניהן
  const rivals = findAllRivals(category.items.map((i) => i.answer));
  const prepared = category.items.map((i) => prepareItem({ ...i, rivals: rivals.get(i.answer) }));
  // הפרופיל תלוי בתשובה בלבד, והיא נבדקת מול כל שאר הפריטים — מחשבים פעם אחת
  const profiles = category.items.map((i) => transcriptProfile(i.answer));
  for (let i = 0; i < category.items.length; i++) {
    for (let j = i + 1; j < category.items.length; j++) {
      const a = category.items[i];
      const b = category.items[j];
      if (a.answer === b.answer) continue; // אותו פריט בדיוק — רק כפילות
      // מסנן זול לפני הכרעה מלאה: בקטגוריה של אלף תרגילים זו ההפרש בין דקה
      // לשנייה, והוא חוסם רק זוגות שההכרעה ממילא לא יכולה לקבל
      const canIJ = couldMatchProfile(profiles[i], prepared[j]);
      const canJI = couldMatchProfile(profiles[j], prepared[i]);
      if (!canIJ && !canJI) continue;
      if ((canIJ && judge(a.answer, prepared[j]).verdict === 'correct')
        || (canJI && judge(b.answer, prepared[i]).verdict === 'correct')) {
        // אותו זוג תשובות יכול לחזור בפריטים שונים — מדווחים עליו פעם אחת
        const key = [a.answer, b.answer].sort().join(' / ');
        if (!collisions.includes(key)) collisions.push(key);
      }
    }
  }
  return collisions;
}

/**
 * מסיר פריטים שהרמז שלהם חוזר, כדי שחפיסה לא תציג אותה שאלה פעמיים.
 * המפתח הוא הרמז ולא התשובה: "3 + 4" ו-"12 − 5" הן שתי שאלות שונות
 * לגמרי, גם אם שתיהן נענות ב"שבע".
 */
function dedupe(category) {
  const seen = new Set();
  category.items = category.items.filter((item) => {
    const key = item.image || item.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return category;
}

function build({ force = false, minItems = 10, quiet = false } = {}) {
  if (!force && fs.existsSync(PACKS) && fs.readdirSync(PACKS).some((f) => f.endsWith('.json'))) {
    return null;
  }
  fs.rmSync(MEDIA, { recursive: true, force: true });
  fs.rmSync(PACKS, { recursive: true, force: true });

  const sources = [
    ...emoji.CATEGORIES.map((c) => [c, 'emoji']),
    ...text.CATEGORIES.map((c) => [c, 'text']),
    ...countries.build({ minItems }).map((c) => [c, 'drawn']),
    ...drawn.build().map((c) => [c, 'drawn']),
    ...flags.build().map((c) => [c, 'drawn']),
    ...generated.build().map((c) => [c, 'drawn']),
    ...numeric.build().map((c) => [c, 'drawn']),
  ];

  const report = { categories: 0, items: 0, skipped: [], collisions: [], smallest: Infinity };
  const ids = new Set();

  for (const [source, kind] of sources) {
    if (ids.has(source.id)) throw new Error(`מזהה קטגוריה כפול: ${source.id}`);
    ids.add(source.id);

    const category = assignDifficulty(dedupe(normalize(source, kind)));
    if (category.items.length < minItems) {
      report.skipped.push(`${category.id} (${category.items.length} פריטים)`);
      continue;
    }

    const collisions = findCollisions(category);
    if (collisions.length) {
      report.collisions.push(`${category.id}: ${collisions.join(', ')}`);
    }

    write(path.join(PACKS, `${category.id}.json`), JSON.stringify(category, null, 2));
    report.categories++;
    report.items += category.items.length;
    report.smallest = Math.min(report.smallest, category.items.length);
  }

  if (!quiet) {
    console.log(`נוצרו ${report.categories} קטגוריות, ${report.items} פריטים.`);
    if (report.skipped.length) console.log(`דולגו (מעט מדי פריטים): ${report.skipped.join(', ')}`);
    for (const c of report.collisions) console.warn(`⚠ תשובות מתנגשות — ${c}`);
  }
  return report;
}

module.exports = { build, findCollisions, PACKS, MEDIA };
