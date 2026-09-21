'use strict';

const fs = require('fs');
const path = require('path');
const { prepareItem, findAllRivals } = require('./judge');
const { shuffle } = require('./shuffle');

const PACKS_DIR = path.join(__dirname, '..', 'content', 'packs');

/**
 * טוען את קטגוריות התוכן ומכין מראש את צורות ההשוואה של כל תשובה,
 * כדי שההכרעה בזמן אמת לא תנרמל טקסט מחדש בכל צ'אנק דיבור.
 */
class ContentLibrary {
  constructor(dir = PACKS_DIR) {
    this.dir = dir;
    this.categories = new Map();
    this.load();
  }

  load() {
    this.categories.clear();
    if (!fs.existsSync(this.dir)) {
      throw new Error(`לא נמצאה ספריית תוכן: ${this.dir} — הריצו: npm run content`);
    }
    for (const file of fs.readdirSync(this.dir).filter((f) => f.endsWith('.json'))) {
      const pack = JSON.parse(fs.readFileSync(path.join(this.dir, file), 'utf8'));
      if (!pack.id || !Array.isArray(pack.items) || pack.items.length === 0) {
        throw new Error(`חבילת תוכן פגומה: ${file}`);
      }
      // תשובות שמכילות זו את זו באותה קטגוריה חייבות להיות מובחנות בהכרעה
      const rivals = findAllRivals(pack.items.map((i) => i.answer));
      this.categories.set(pack.id, {
        id: pack.id,
        name: pack.name || pack.id,
        hint: pack.hint || null,
        items: pack.items.map((i) => prepareItem({ ...i, rivals: rivals.get(i.answer) })),
      });
    }
    if (this.categories.size === 0) throw new Error('לא נמצאו קטגוריות תוכן');
    return this;
  }

  list() {
    return [...this.categories.values()].map((c) => ({
      id: c.id, name: c.name, hint: c.hint, size: c.items.length,
    }));
  }

  category(id) {
    return this.categories.get(id) || null;
  }

  /** בוחר קטגוריה פנויה; אם כולן תפוסות, מחזיר את הפחות שימושית. */
  pickCategory(taken = new Set(), rand = Math.random) {
    const free = [...this.categories.keys()].filter((id) => !taken.has(id));
    const pool = free.length ? free : [...this.categories.keys()];
    return pool[Math.floor(rand() * pool.length)];
  }

  /** חפיסת פריטים מעורבבת לדו-קרב אחד. */
  /**
   * חפיסה לדו־קרב אחד: קלה בהתחלה, קשה בסוף.
   *
   * הסדר בתוך כל דרגה מעורבב, כך ששני דו־קרבות באותה קטגוריה לא מציגים
   * בדיוק את אותה סדרה — אבל העלייה בקושי נשמרת. זה מה שמייצר את הקצב של
   * התוכנית: הפתיחה מהירה, וההכרעה נופלת על הפריטים הקשים.
   */
  deck(categoryId, rand = Math.random) {
    const category = this.category(categoryId);
    if (!category) throw new Error(`קטגוריה לא מוכרת: ${categoryId}`);

    const bands = new Map();
    for (const item of category.items) {
      const level = item.difficulty || 1;
      if (!bands.has(level)) bands.set(level, []);
      bands.get(level).push(item);
    }

    return [...bands.keys()]
      .sort((a, b) => a - b)
      .flatMap((level) => shuffle(bands.get(level), rand));
  }
}

module.exports = { ContentLibrary, PACKS_DIR };
