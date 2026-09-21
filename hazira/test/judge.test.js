'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, similarity, prepareItem, judge } = require('../server/judge');

const item = (answer, aliases = []) => prepareItem({ answer, aliases });

test('נרמול: ניקוד, אותיות סופיות ופיסוק', () => {
  assert.equal(normalize('שָׁלוֹם!'), 'שלומ');
  assert.equal(normalize('ג׳ירפה,'), 'ג ירפה');
  assert.equal(normalize('  תפוח   אדמה  '), 'תפוח אדמה');
});

test('תשובה מדויקת מזוהה', () => {
  const result = judge('צרפת', item('צרפת'));
  assert.equal(result.verdict, 'correct');
  assert.equal(result.score, 1);
});

test('תשובה משובצת בתוך מלמול מזוהה', () => {
  for (const said of ['אהh רגע זה צרפת', 'אני חושב שזה צרפת נכון', 'הדגל של צרפת']) {
    assert.equal(judge(said, item('צרפת')).verdict, 'correct', said);
  }
});

test('שגיאת זיהוי דיבור נסלחת', () => {
  assert.equal(judge('צרפט', item('צרפת')).verdict, 'correct');
  assert.equal(judge('עגבניה', item('עגבנייה')).verdict, 'correct');
});

test('כינויים חלופיים קבילים', () => {
  const flag = item('הולנד', ['ארצות השפלה']);
  assert.equal(judge('ארצות השפלה', flag).verdict, 'correct');
});

test('אות שימוש בתחילת מילה לא פוסלת', () => {
  assert.equal(judge('הכלב', item('כלב')).verdict, 'correct');
  assert.equal(judge('וגיטרה', item('גיטרה')).verdict, 'correct');
});

test('תשובה שגויה נדחית', () => {
  for (const said of ['ספרד', 'איטליה', 'בננה']) {
    assert.notEqual(judge(said, item('צרפת')).verdict, 'correct', said);
  }
});

test('שתי מדינות דומות באורכן לא מתבלבלות', () => {
  assert.notEqual(judge('אוסטריה', item('אוסטרליה')).verdict, 'correct');
});

test('תשובה קרובה מסומנת כ-near ולא כנכונה', () => {
  const result = judge('כדורסל', item('כדורגל'));
  assert.equal(result.verdict, 'near');
  assert.ok(result.score > 0.6 && result.score < 0.86);
});

test('שקט לא מייצר תשובה', () => {
  assert.equal(judge('', item('צרפת')).verdict, 'none');
  assert.equal(judge('אהh אמ נו', item('צרפת')).verdict, 'none');
});

test('דמיון מחרוזות סימטרי ומוגבל ל-0..1', () => {
  assert.equal(similarity('אבג', 'אבג'), 1);
  assert.equal(similarity('אבג', 'דהו'), 0);
  assert.equal(similarity('', ''), 1);
});

test('תשובה רב-מילתית מזוהה בתוך משפט', () => {
  const potato = item('תפוח אדמה', ['תפוד']);
  assert.equal(judge('זה נראה לי תפוח אדמה', potato).verdict, 'correct');
  assert.equal(judge('תפוד', potato).verdict, 'correct');
});
