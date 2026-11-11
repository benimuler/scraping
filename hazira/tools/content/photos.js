'use strict';

/**
 * קטגוריות תמונות אמיתיות (צילומים מוויקיפדיה/קומונס).
 * כל קטגוריה בקובץ JSON נפרד בתיקיית photos-data/ (נאפה מראש על ידי fetch-photos.js),
 * כדי שה-build לא יהיה תלוי ברשת.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'photos-data');
let categories = [];
try {
  categories = fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
} catch {
  console.warn('חסרה תיקיית photos-data — הריצו: node tools/content/fetch-photos.js');
}

module.exports = { CATEGORIES: categories };
