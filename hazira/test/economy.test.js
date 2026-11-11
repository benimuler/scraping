'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const economy = require('../server/economy');

// כל הערכים הנבדקים כאן הם הערכים המתועדים במרכז המידע הרשמי של
// CleverGames. אם הם ישתנו שם — הבדיקות האלה צריכות להשתנות איתם.

test('ערכי החדרים המתועדים: קלאסי, מתקדם, אלופים', () => {
  const { classic, advanced, champions } = economy.ROOMS;
  assert.deepEqual(
    [classic.entryCoins, classic.winCoins, classic.winTrophies, classic.unlockTrophies],
    [50, 100, 30, 0],
  );
  assert.deepEqual(
    [advanced.entryCoins, advanced.winCoins, advanced.winTrophies, advanced.unlockTrophies],
    [250, 500, 125, 100],
  );
  assert.deepEqual(
    [champions.entryCoins, champions.winCoins, champions.winTrophies, champions.unlockTrophies],
    [2500, 5000, 400, 600],
  );
});

test('טבלות ההפסד המתועדות לפי מדרגות גביעים', () => {
  // קלאסי: ‎-5/-15/-20/-25/-36
  assert.equal(economy.lossFor('classic', 0), 5);
  assert.equal(economy.lossFor('classic', 3799), 5);
  assert.equal(economy.lossFor('classic', 3800), 15);
  assert.equal(economy.lossFor('classic', 8999), 15);
  assert.equal(economy.lossFor('classic', 9000), 20);
  assert.equal(economy.lossFor('classic', 17999), 20);
  assert.equal(economy.lossFor('classic', 18000), 25);
  assert.equal(economy.lossFor('classic', 29999), 25);
  assert.equal(economy.lossFor('classic', 30000), 36);
  assert.equal(economy.lossFor('classic', 999999), 36);
  // מתקדם: ‎-21/-63/-83/-104/-150
  assert.equal(economy.lossFor('advanced', 100), 21);
  assert.equal(economy.lossFor('advanced', 3800), 63);
  assert.equal(economy.lossFor('advanced', 9000), 83);
  assert.equal(economy.lossFor('advanced', 18000), 104);
  assert.equal(economy.lossFor('advanced', 30000), 150);
});

test('אלופים: טבלת ההפסד לא פורסמה — החדר סגור, אין ניחוש', () => {
  assert.equal(economy.lossFor('champions', 1000), null);
  assert.equal(economy.roomAvailable('champions'), false);
  // קלאסי ומתקדם סגורים גם הם כל עוד בונוס הרצף לא פורסם — סליקה חייבת
  // להיות מוגדרת מקצה לקצה לפני שאפשר לגבות דמי כניסה.
  assert.equal(economy.roomAvailable('classic'), false);
  assert.equal(economy.roomAvailable('advanced'), false);
  const out = economy.settleMatch('champions', { coins: 5000 }, { coins: 0, trophyPoints: 700 });
  assert.equal(out.settled, false);
  assert.ok(out.missing.includes('loss-trophies'));
});

test('בונוס רצף לא פורסם — סליקה נעצרת בלי לזוז', () => {
  const winner = { coins: 100, trophyPoints: 40, highestTrophyPoints: 40 };
  const loser = { coins: 0, trophyPoints: 10 };
  const out = economy.settleMatch('classic', winner, loser);
  assert.equal(out.settled, false);
  assert.ok(out.missing.includes('streak-bonus'));
  // ודא שלא זז דבר: הקלט לא עבר מוטציה ואין תוצרי סליקה
  assert.equal(winner.coins, 100);
  assert.equal(loser.trophyPoints, 10);
  assert.equal(out.winner, undefined);
  assert.equal(out.loser, undefined);
});

test('13 הליגות בספים המתועדים', () => {
  assert.equal(economy.LEAGUES.length, 13);
  assert.deepEqual(
    economy.LEAGUES.map((l) => l.threshold),
    [100, 1200, 2600, 3800, 5000, 6500, 9000, 12000, 15000, 18000, 22500, 26000, 30000],
  );
  assert.equal(economy.leagueFor(0), null);
  assert.equal(economy.leagueFor(99), null);
  assert.equal(economy.leagueFor(100).id, 'rookie-1');
  assert.equal(economy.leagueFor(2599).id, 'rookie-2');
  assert.equal(economy.leagueFor(3800).id, 'advanced-1');
  assert.equal(economy.leagueFor(29999).id, 'master-3');
  assert.equal(economy.leagueFor(30000).id, 'legend');
});

test('נעילת חדרים לפי שיא היסטורי — לא לפי יתרה נוכחית', () => {
  assert.equal(economy.roomUnlocked('advanced', 0), false);
  assert.equal(economy.roomUnlocked('advanced', 99), false);
  assert.equal(economy.roomUnlocked('advanced', 100), true);
  assert.equal(economy.roomUnlocked('champions', 599), false);
  assert.equal(economy.roomUnlocked('champions', 600), true);
});

test('חבילת פתיחה: 500 מטבעות, פעם אחת בלבד', () => {
  assert.equal(economy.WELCOME_COINS, 500);
  const first = economy.grantWelcome({});
  assert.equal(first.granted, true);
  assert.equal(first.profile.coins, 500);
  const second = economy.grantWelcome(first.profile);
  assert.equal(second.granted, false);
  assert.equal(second.profile.coins, 500);
});

test('גביית כניסה: דורסת רק כשיש כיסוי מלא', () => {
  // החדרים סגורים כל עוד בונוס הרצף לא פורסם; כאן מדמים פרסום כדי
  // לבדוק את הגבייה עצמה.
  economy._setStreakBonusForTest(10);
  try {
    const ok = economy.chargeEntry({ coins: 50 }, 'classic');
    assert.equal(ok.ok, true);
    assert.equal(ok.profile.coins, 0);
    const no = economy.chargeEntry({ coins: 49 }, 'classic');
    assert.equal(no.ok, false);
    assert.equal(no.reason, 'insufficient-coins');
    assert.equal(no.profile.coins, 49);
    // חדר סגור לא גובה
    const closed = economy.chargeEntry({ coins: 9999 }, 'champions');
    assert.equal(closed.ok, false);
    assert.equal(closed.reason, 'room-unavailable');
  } finally {
    economy._setStreakBonusForTest(null);
  }
});

test('החזר כניסה מלא בתיקו', () => {
  const out = economy.settleDraw('classic', { coins: 0 }, { coins: 25, rankedWinStreak: 3 });
  assert.equal(out.settled, true);
  assert.equal(out.a.profile.coins, 50);
  assert.equal(out.b.profile.coins, 75);
  assert.equal(out.b.profile.rankedWinStreak, 0); // תיקו מאפס רצף
});

test('withEconomy: יתרות לא שליליות ושיא שמור', () => {
  const p = economy.withEconomy({ coins: -5, trophyPoints: 100, highestTrophyPoints: 40 });
  assert.equal(p.coins, 0);
  assert.equal(p.highestTrophyPoints, 100);
});

test('הגדרות ציבוריות חושפות חדרים זמינים בלבד עם ערכים מלאים', () => {
  const cfg = economy.publicConfig();
  const byId = Object.fromEntries(cfg.rooms.map((r) => [r.id, r]));
  // בלי בונוס רצף מפורסם אף חדר לא נפתח, גם עם טבלת הפסדים מלאה
  assert.equal(byId.classic.available, false);
  assert.equal(byId.advanced.available, false);
  assert.equal(byId.champions.available, false);
  assert.equal(cfg.streakBonusPublished, false);
  economy._setStreakBonusForTest(10);
  try {
    const pub = economy.publicConfig();
    const open = Object.fromEntries(pub.rooms.map((r) => [r.id, r]));
    assert.equal(open.classic.available, true);
    assert.equal(open.advanced.available, true);
    assert.equal(open.champions.available, false);
  } finally {
    economy._setStreakBonusForTest(null);
  }
});
