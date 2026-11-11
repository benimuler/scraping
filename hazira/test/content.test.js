'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ContentLibrary } = require('../server/content');
const { judge } = require('../server/judge');
const { findCollisions } = require('../tools/content/build');

const content = new ContentLibrary();

function seeded(seed = 3) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('נטענו מספיק קטגוריות למשחק לוח מלא', () => {
  assert.ok(content.list().length >= 70, `נטענו ${content.list().length} קטגוריות`);
});

test('לכל קטגוריה יש מספיק פריטים לדו־קרב', () => {
  for (const c of content.list()) {
    assert.ok(c.size >= 10, `${c.name} — רק ${c.size} פריטים`);
  }
});

test('החפיסה מסודרת בקושי עולה', () => {
  for (const { id } of content.list()) {
    const deck = content.deck(id, seeded());
    const levels = deck.map((i) => i.difficulty || 1);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i] >= levels[i - 1], `${id}: דרגה ירדה במיקום ${i}`);
    }
  }
});

test('הסדר בתוך דרגה מתערבב בין חפיסות', () => {
  // אחרת שני דו־קרבות באותה קטגוריה היו מציגים בדיוק אותה סדרה
  const a = content.deck('mammals', seeded(1)).map((i) => i.answer);
  const b = content.deck('mammals', seeded(99)).map((i) => i.answer);
  assert.notDeepEqual(a, b);
  assert.deepEqual([...a].sort(), [...b].sort(), 'אותם פריטים, סדר אחר');
});

test('אין שתי תשובות שמנוע ההכרעה יבלבל ביניהן באותה קטגוריה', () => {
  // אותה בדיקה שרצה בזמן הבנייה, ולא העתק שלה: אחרת הן מתפצלות עם הזמן
  const problems = [];
  for (const { id } of content.list()) {
    for (const pair of findCollisions(content.category(id))) problems.push(`${id}: ${pair}`);
  }
  assert.deepEqual(problems, []);
});

test('כל פריט נושא תמונה או רמז מילולי', () => {
  for (const { id } of content.list()) {
    for (const item of content.category(id).items) {
      assert.ok(item.image || item.text, `${id}: פריט בלי רמז`);
      assert.ok(item.answer && item.answer.trim(), `${id}: פריט בלי תשובה`);
    }
  }
});

test('יריבים מחושבים לכל קטגוריה שיש בה תשובות מוכלות', () => {
  const maps = content.category('map-africa').items;
  const sudan = maps.find((i) => i.answer === 'סודאן');
  assert.ok(sudan, 'סודאן אמורה להיות במפות אפריקה');
  assert.ok(sudan._rivals.some((r) => r.raw === 'דרום סודאן'));
  assert.equal(judge('דרום סודאן', sudan).verdict, 'none');
});
