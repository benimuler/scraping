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

test('מילים קצרות שמתחילות באות שימוש אינן מתמזגות', () => {
  // בלי מינימום לגזע, "מתח" ו"שטח" היו מתכווצות שתיהן ל"תח"
  assert.notEqual(judge('מתח', item('שטח')).verdict, 'correct');
  assert.notEqual(judge('שטח', item('מתח')).verdict, 'correct');
  assert.notEqual(judge('מלח', item('שלח')).verdict, 'correct');
  assert.notEqual(judge('בית', item('לוט')).verdict, 'correct');
});

test('קילוף אות שימוש ממשיך לעבוד במילים ארוכות', () => {
  assert.equal(judge('הכלב', item('כלב')).verdict, 'correct');
  assert.equal(judge('וגיטרה', item('גיטרה')).verdict, 'correct');
  assert.equal(judge('הפיל', item('פיל')).verdict, 'correct');
});

test('תשובה של פריט אחר בקטגוריה לא נחשבת לתשובה הזו', () => {
  const { findRivals, prepareItem } = require('../server/judge');
  const answers = ['סודאן', 'דרום סודאן', 'גינאה', 'גינאה ביסאו'];
  const withRivals = (answer) =>
    prepareItem({ answer, rivals: findRivals(answer, answers) });

  // מי שרואה את סודאן ואומר "דרום סודאן" נקב בשם מדינה אחרת
  assert.equal(judge('דרום סודאן', withRivals('סודאן')).verdict, 'none');
  assert.equal(judge('גינאה ביסאו', withRivals('גינאה')).verdict, 'none');

  // והכיוון ההפוך ממשיך לעבוד כרגיל
  assert.equal(judge('סודאן', withRivals('סודאן')).verdict, 'correct');
  assert.equal(judge('זה סודאן נכון', withRivals('סודאן')).verdict, 'correct');
  assert.equal(judge('דרום סודאן', withRivals('דרום סודאן')).verdict, 'correct');
  assert.equal(judge('סודאן', withRivals('דרום סודאן')).verdict, 'none');
});

test('findRivals מוצא רק תשובות שמכילות ממש', () => {
  const { findRivals } = require('../server/judge');
  assert.deepEqual(findRivals('סודאן', ['סודאן', 'דרום סודאן', 'מצרים']), ['דרום סודאן']);
  assert.deepEqual(findRivals('מצרים', ['סודאן', 'דרום סודאן', 'מצרים']), []);
  assert.deepEqual(findRivals('טניס', ['טניס', 'טניס שולחן']), ['טניס שולחן']);
});

test('מספר ארוך שמסתיים באותן מילים אינו מתקבל כמספר הקצר', () => {
  const { findAllRivals, prepareItem } = require('../server/judge');
  // "מאה ושלושים ואחת" מסתיימת ב"שלושים ואחת", וחלון הזנב היה תופס אותה
  const answers = ['שלושים ואחת', 'מאה ושלושים ואחת', 'ארבעים וארבע', 'מאה וארבעים וארבע'];
  const rivals = findAllRivals(answers);
  const shown = (answer) => prepareItem({ answer, rivals: rivals.get(answer) });

  assert.equal(judge('מאה ושלושים ואחת', shown('שלושים ואחת')).verdict, 'none');
  assert.equal(judge('מאה וארבעים וארבע', shown('ארבעים וארבע')).verdict, 'none');

  // והמספר עצמו ממשיך להתקבל, עם ו' החיבור ובלעדיה
  assert.equal(judge('שלושים ואחת', shown('שלושים ואחת')).verdict, 'correct');
  assert.equal(judge('מאה ושלושים ואחת', shown('מאה ושלושים ואחת')).verdict, 'correct');
});

test('רשת הדמיון מוגבלת לשגיאה של אות אחת', () => {
  // מאתיים עשרים ושתיים ומאתיים תשעים ושתיים נבדלות בשתי אותיות מתוך עשרים,
  // כלומר בדיוק בסף היחסי — ושתי תשובות שונות לגמרי
  assert.equal(judge('מאתיים ועשרים ושתיים', item('מאתיים ותשעים ושתיים')).verdict, 'near');
  // שגיאת זיהוי של אות אחת בתוך ביטוי ארוך עדיין מתקבלת
  assert.equal(judge('ארצות הברת', item('ארצות הברית')).verdict, 'correct');
});

test('המסנן המהיר לעולם אינו חוסם תשובה שההכרעה מקבלת', () => {
  const { couldMatch, prepareItem } = require('../server/judge');
  const words = ['סודאן', 'דרום סודאן', 'אוסטרליה', 'אוסטריה', 'כלב', 'הכלב', 'מתח',
    'שטח', 'ארצות הברית', 'ארצות הברת', 'עגבנייה', 'עגבניה', 'שלושים ואחת',
    'מאה ושלושים ואחת', 'צרפת', 'ברזיל'];
  let filtered = 0;
  for (const said of words) {
    for (const shown of words) {
      const prepared = prepareItem({ answer: shown, aliases: [] });
      const passes = couldMatch(said, prepared);
      if (!passes) {
        filtered += 1;
        assert.notEqual(judge(said, prepared).verdict, 'correct', `${said} → ${shown}`);
      }
    }
  }
  assert.ok(filtered > words.length, `המסנן סינן רק ${filtered} זוגות — הוא לא עושה כלום`);
});
