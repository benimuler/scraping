'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../public/js/profile.mjs');

/** דו־קרב טיפוסי; כל בדיקה משנה רק את מה שמעניין אותה. */
const round = (over = {}) => ({
  won: true, correct: 6, passes: 1, bestStreak: 3, fastestMs: 3000,
  clockLeftMs: 20000, totalMs: 18000, totalAnswers: 11, categoryId: 'mammals',
  ...over,
});

test('רמה עולה לפי ניסיון מצטבר', async () => {
  const { levelFor, levelThreshold } = await load();
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(99), 1);
  assert.equal(levelFor(100), 2);
  assert.equal(levelFor(299), 2);
  assert.equal(levelFor(300), 3);
  assert.equal(levelThreshold(1), 0);
  for (let l = 1; l < 20; l++) {
    assert.ok(levelThreshold(l + 1) > levelThreshold(l), `רמה ${l} לא עולה`);
  }
});

test('פס ההתקדמות נשאר בין אפס לאחד', async () => {
  const { levelProgress } = await load();
  for (const xp of [0, 50, 100, 250, 999, 5000]) {
    const p = levelProgress(xp);
    assert.ok(p.ratio >= 0 && p.ratio < 1, `xp=${xp} יצא מחוץ לטווח`);
    assert.ok(p.need > 0);
  }
});

test('גם מפסיד צובר ניסיון', async () => {
  const { xpForRound } = await load();
  const lost = xpForRound(round({ won: false, passes: 2 }));
  assert.ok(lost > 0, 'הפסד בלי ניסיון היה מרגיש כמו עמידה במקום');
  assert.ok(xpForRound(round()) > lost, 'ניצחון שווה יותר');
});

test('ניצחון נקי ובלחץ שעון מזכים בתוספת', async () => {
  const { xpForRound } = await load();
  const plain = xpForRound(round({ passes: 3, clockLeftMs: 30000, bestStreak: 2 }));
  const clean = xpForRound(round({ passes: 0, clockLeftMs: 30000, bestStreak: 2 }));
  const clutch = xpForRound(round({ passes: 3, clockLeftMs: 2000, bestStreak: 2 }));
  assert.ok(clean > plain);
  assert.ok(clutch > plain);
});

test('ניצחון ראשון פותח גביע, והוא לא נפתח שוב', async () => {
  const { emptyProfile, applyRound } = await load();
  const first = applyRound(emptyProfile('דנה'), round());
  assert.ok(first.unlocked.some((t) => t.id === 'first-win'));

  const second = applyRound(first.profile, round());
  assert.ok(!second.unlocked.some((t) => t.id === 'first-win'), 'גביע נפתח פעמיים');
});

test('רצף ניצחונות נשבר בהפסד', async () => {
  const { emptyProfile, applyRound } = await load();
  let p = emptyProfile('יוסי');
  for (let i = 0; i < 3; i++) p = applyRound(p, round()).profile;
  assert.equal(p.winStreak, 3);
  assert.ok(p.trophies.hattrick, 'שלושער לא נפתח');

  p = applyRound(p, round({ won: false })).profile;
  assert.equal(p.winStreak, 0);
  assert.equal(p.bestWinStreak, 3, 'השיא נשמר גם אחרי שהרצף נשבר');
});

test('קאמבק נפתח רק בניצחון שאחרי הפסד', async () => {
  const { emptyProfile, applyRound } = await load();
  let p = applyRound(emptyProfile('א'), round()).profile;      // ניצחון
  let step = applyRound(p, round({ won: false }));              // הפסד
  assert.ok(!step.unlocked.some((t) => t.id === 'comeback'));

  step = applyRound(step.profile, round());                     // ניצחון אחרי הפסד
  assert.ok(step.unlocked.some((t) => t.id === 'comeback'));
});

test('קטגוריות נספרות פעם אחת כל אחת', async () => {
  const { emptyProfile, applyRound } = await load();
  let p = emptyProfile('א');
  p = applyRound(p, round({ categoryId: 'mammals' })).profile;
  p = applyRound(p, round({ categoryId: 'mammals' })).profile;
  p = applyRound(p, round({ categoryId: 'fruits' })).profile;
  assert.deepEqual(p.categoriesWon, ['mammals', 'fruits']);
  assert.deepEqual(p.categoriesPlayed, ['mammals', 'fruits']);
});

test('גביע רב־תחומי נפתח בקטגוריה החמישית', async () => {
  const { emptyProfile, applyRound } = await load();
  let p = emptyProfile('א');
  const cats = ['a', 'b', 'c', 'd', 'e'];
  let unlocked = [];
  for (const categoryId of cats) {
    const step = applyRound(p, round({ categoryId }));
    p = step.profile;
    unlocked = step.unlocked;
  }
  assert.ok(unlocked.some((t) => t.id === 'polymath'), 'לא נפתח בקטגוריה החמישית');
});

test('שיא אישי מזוהה רק כשהוא נשבר', async () => {
  const { emptyProfile, applyRound, personalBests } = await load();
  const fresh = emptyProfile('א');
  assert.ok(personalBests(fresh, round({ fastestMs: 3000 })).some((b) => b.id === 'fastest'));

  const after = applyRound(fresh, round({ fastestMs: 3000, bestStreak: 4 })).profile;
  assert.deepEqual(personalBests(after, round({ fastestMs: 3500, bestStreak: 4 })), []);
  assert.ok(personalBests(after, round({ fastestMs: 1200, bestStreak: 4 })).some((b) => b.id === 'fastest'));
  assert.ok(personalBests(after, round({ fastestMs: 3500, bestStreak: 9 })).some((b) => b.id === 'streak'));
});

test('פרופיל פגום או מגרסה ישנה לא מפיל את המשחק', async () => {
  const { loadProfile, saveProfile, emptyProfile } = await load();
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };

  assert.deepEqual(loadProfile(storage, 'א'), emptyProfile('א'));
  storage.setItem('hazira:profile', '{{{ לא JSON');
  assert.deepEqual(loadProfile(storage, 'א'), emptyProfile('א'));
  storage.setItem('hazira:profile', JSON.stringify({ version: 0, xp: 9999 }));
  assert.equal(loadProfile(storage, 'א').xp, 0, 'גרסה ישנה לא אמורה להישמר');

  const saved = saveProfile(storage, { ...emptyProfile('א'), xp: 420 });
  assert.equal(loadProfile(storage, 'א').xp, 420);
  assert.equal(saved.xp, 420);
});

test('אחסון שנכשל לא מפיל שמירה', async () => {
  const { saveProfile, emptyProfile } = await load();
  const storage = { getItem: () => null, setItem: () => { throw new Error('מצב פרטי'); } };
  assert.doesNotThrow(() => saveProfile(storage, emptyProfile('א')));
});

test('לכל גביע יש מזהה ייחודי, שם ותיאור', async () => {
  const { TROPHIES, trophyById } = await load();
  const ids = TROPHIES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'יש מזהה כפול');
  for (const t of TROPHIES) {
    assert.ok(t.name && t.desc && t.icon, `${t.id} חסר פרטים`);
    assert.equal(typeof t.check, 'function');
    assert.equal(trophyById(t.id), t);
  }
  assert.equal(trophyById('לא-קיים'), null);
});
