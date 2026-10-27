'use strict';

/**
 * קטגוריות תמונות אמיתיות (צילומים מוויקיפדיה/קומונס).
 * הנתונים נאפים מראש ל-photos-data.json על ידי fetch-photos.js,
 * כדי שה-build לא יהיה תלוי ברשת.
 */

let categories = [];
try {
  categories = require('./photos-data.json').categories || [];
} catch {
  console.warn('חסר photos-data.json — הריצו: node tools/content/fetch-photos.js');
}

module.exports = { CATEGORIES: categories };
