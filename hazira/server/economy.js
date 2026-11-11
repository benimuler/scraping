'use strict';

/**
 * economy.js — מנגנון הגביעים והמטבעות, בהתאם לחוקים המתועדים של
 * "ראש בראש" (CleverGames) ממרכז המידע הרשמי שלהם.
 *
 * כל ערך כאן מסומן במקורו:
 *  - 'doc'    — פורסם במרכז המידע (clevergames.org/en/help/headtohead/...)
 *  - null     — לא פורסם בשום מקור ציבורי. חדר או מנגנון עם ערך חסר
 *               נשאר כבוי — אף פעם לא מנחשים מספר ואף פעם לא גובים או
 *               מזכים על בסיס ערך חסר.
 *
 * כללים מתועדים כלליים:
 *  - אין דמי כניסה בגביעים; גביעים זזים רק עם התוצאה.
 *  - תיקו: דמי הכניסה במטבעות מוחזרים, אין שינוי בגביעים.
 *  - יתרת גביעים אף פעם לא יורדת מתחת לאפס.
 *  - נעילת חדרים וליגות נקבעת לפי שיא הגביעים ההיסטורי — פעם שנפתח,
 *    נשאר פתוח לנצח.
 */

// מדרגות ההפסד בגביעים — אותן חמש מדרגות בכל החדרים (מתועד).
const LOSS_BRACKETS = [0, 3800, 9000, 18000, 30000];

const ROOMS = {
  classic: {
    id: 'classic',
    nameHe: 'קלאסי',        // מתועד: "Classic / קלאסי" (מחרוזות התרגום שלהם)
    entryCoins: 50,         // doc: rooms-entry-and-rewards
    winCoins: 100,          // doc
    winTrophies: 30,        // doc
    unlockTrophies: 0,      // doc: "Open to everyone from the start"
    lossTrophies: [5, 15, 20, 25, 36], // doc: trophies-and-points
  },
  advanced: {
    id: 'advanced',
    nameHe: 'מתקדם',        // doc: "Advanced / מתקדם"
    entryCoins: 250,        // doc
    winCoins: 500,          // doc
    winTrophies: 125,       // doc
    unlockTrophies: 100,    // doc
    lossTrophies: [21, 63, 83, 104, 150], // doc
  },
  champions: {
    id: 'champions',
    nameHe: 'אלופים',       // doc: "Champions / אלופים"
    entryCoins: 2500,       // doc
    winCoins: 5000,         // doc
    winTrophies: 400,       // doc
    unlockTrophies: 600,    // doc
    // לא פורסם: טבלת ההפסדים של אלופים. הטבלה החיה באתר שלהם מציגה
    // רק קלאסי ומתקדם. בלי הערכים האלה החדר נשאר סגור.
    lossTrophies: null,
  },
};

// בונוס רצף ניצחונות: קיים ומתועד, אבל הגובה לא פורסם ("מוצג על מסך
// הניצחון"). null = הרצף נספר ומוצג, אבל בונוס לא מחושב עד שיהיה ערך.
let STREAK_BONUS = null;

// לבדיקות בלבד: מדמה מצב שבו הערך פורסם. בקוד הייצור הערך משתנה רק
// בעריכת הקובץ, אחרי שהמספר מתועד ממקור מהימן.
function _setStreakBonusForTest(value) {
  STREAK_BONUS = value;
}

// חבילת פתיחה לחשבון חדש (מתועד: "currently starts with 500 coins").
// במשחק שלהם יש גם אבנים ואנרגיה — מחוץ לטווח הבקשה.
const WELCOME_COINS = 500;

// שלוש עשרה הליגות לפי שיא גביעים היסטורי (מתועד). שמות המשפחות
// בעברית הם תרגום שלנו; הספים עצמם מתועדים.
const LEAGUES = [
  { id: 'rookie-1', nameHe: 'רוקי 1', threshold: 100 },
  { id: 'rookie-2', nameHe: 'רוקי 2', threshold: 1200 },
  { id: 'rookie-3', nameHe: 'רוקי 3', threshold: 2600 },
  { id: 'advanced-1', nameHe: 'מתקדם 1', threshold: 3800 },
  { id: 'advanced-2', nameHe: 'מתקדם 2', threshold: 5000 },
  { id: 'advanced-3', nameHe: 'מתקדם 3', threshold: 6500 },
  { id: 'champion-1', nameHe: 'אלופים 1', threshold: 9000 },
  { id: 'champion-2', nameHe: 'אלופים 2', threshold: 12000 },
  { id: 'champion-3', nameHe: 'אלופים 3', threshold: 15000 },
  { id: 'master-1', nameHe: 'מאסטר 1', threshold: 18000 },
  { id: 'master-2', nameHe: 'מאסטר 2', threshold: 22500 },
  { id: 'master-3', nameHe: 'מאסטר 3', threshold: 26000 },
  { id: 'legend', nameHe: 'אגדי', threshold: 30000 },
];

// ------------------------------------------------------------- שאילתות

/**
 * האם לחדר יש את כל הערכים הנדרשים לסליקה מלאה. בלי זה הוא סגור.
 * בונוס הרצף חובה גם הוא: דמי כניסה נגבים בפתיחת המשחק, וסליקה שלא
 * יכולה להסתיים הייתה משאירה שחקן ששילם בלי הכרעה מוגדרת. לכן אף חדר
 * לא נפתח עד שכל הערכים שסליקה צריכה פורסמו.
 */
function roomAvailable(roomId) {
  const room = ROOMS[roomId];
  return !!room && Array.isArray(room.lossTrophies) && STREAK_BONUS !== null;
}

/** מדרגת ההפסד לפי יתרת הגביעים הנוכחית של המפסיד. */
function bracketIndex(trophies) {
  const t = Math.max(0, trophies | 0);
  let idx = 0;
  for (let i = 0; i < LOSS_BRACKETS.length; i++) {
    if (t >= LOSS_BRACKETS[i]) idx = i;
  }
  return idx;
}

/**
 * עלות הפסד בגביעים בחדר נתון ויתרה נתונה.
 * @returns {number|null} null כשהערך לא פורסם — אסור לנחש.
 */
function lossFor(roomId, trophies) {
  const room = ROOMS[roomId];
  if (!room || !Array.isArray(room.lossTrophies)) return null;
  return room.lossTrophies[bracketIndex(trophies)];
}

/** בונוס רצף לניצחון. @returns {number|null} null כשלא פורסם. */
function streakBonusFor(/* winStreak */) {
  return STREAK_BONUS;
}

/** הליגה לפי שיא הגביעים ההיסטורי (מתחת ל-100 — עוד לפני הליגה הראשונה). */
function leagueFor(highestTrophies) {
  const t = Math.max(0, highestTrophies | 0);
  let current = null;
  for (const league of LEAGUES) {
    if (t >= league.threshold) current = league;
  }
  return current;
}

/** האם החדר פתוח לשחקן — לפי שיא הגביעים ההיסטורי, לא היתרה הנוכחית. */
function roomUnlocked(roomId, highestTrophies) {
  const room = ROOMS[roomId];
  if (!room) return false;
  return Math.max(0, highestTrophies | 0) >= room.unlockTrophies;
}

// ------------------------------------------------------- שדות כלכלה בפרופיל

/** ברירות המחדל הכלכליות שמתווספות לפרופיל (בלי לדרוס קיים). */
function economyDefaults() {
  return {
    coins: 0,
    trophyPoints: 0,
    highestTrophyPoints: 0,
    rankedWins: 0,
    rankedLosses: 0,
    rankedWinStreak: 0,
    bestRankedWinStreak: 0,
    welcomeGranted: false,
  };
}

/** ממלא שדות כלכלה חסרים בפרופיל קיים (או יוצר בסיס לחדש). */
function withEconomy(profile) {
  const p = { ...economyDefaults(), ...(profile || {}) };
  p.coins = Math.max(0, p.coins | 0);
  p.trophyPoints = Math.max(0, p.trophyPoints | 0);
  p.highestTrophyPoints = Math.max(p.trophyPoints, p.highestTrophyPoints | 0);
  return p;
}

/** חבילת הפתיחה — פעם אחת לחשבון. אידמפוטנטי. */
function grantWelcome(profile) {
  const p = withEconomy(profile);
  if (p.welcomeGranted) return { profile: p, granted: false };
  p.coins += WELCOME_COINS;
  p.welcomeGranted = true;
  return { profile: p, granted: true };
}

// ------------------------------------------------------------ גביית כניסה

/**
 * גובה דמי כניסה במטבעות. כישלון בכיסוי אינו גובה חלקית ואינו משנה
 * את היתרה — אין ניכוי מקרי.
 */
function chargeEntry(profile, roomId) {
  const room = ROOMS[roomId];
  if (!room) return { ok: false, reason: 'unknown-room' };
  if (!roomAvailable(roomId)) return { ok: false, reason: 'room-unavailable' };
  const p = withEconomy(profile);
  if (p.coins < room.entryCoins) return { ok: false, reason: 'insufficient-coins', profile: p };
  p.coins -= room.entryCoins;
  return { ok: true, profile: p, charged: room.entryCoins };
}

/** החזר דמי כניסה (תיקו, או משחק שלא הושלם מסיבה שאינה אשמת השחקן). */
function refundEntry(profile, roomId) {
  const room = ROOMS[roomId];
  if (!room) return { profile: withEconomy(profile) };
  const p = withEconomy(profile);
  p.coins += room.entryCoins;
  return { profile: p };
}

// ------------------------------------------------------------- סליקת משחק

/**
 * מסלק משחק מדורג שהוכרע.
 *
 * @param {string} roomId
 * @param {object} winnerProfile פרופיל המנצח (אחרי withEconomy או גולמי)
 * @param {object} loserProfile פרופיל המפסיד
 * @returns {{
 *   settled: boolean,
 *   missing: string[],          // ערכים חסרים שמנעו סליקה מלאה
 *   winner?: object,            // {profile, delta:{coins,trophies}, streak, leagueBefore, leagueAfter, streakBonusApplied}
 *   loser?: object,             // {profile, delta:{trophies}}
 * }}
 *
 * עקרון הבטיחות: אם חסר ערך כלשהו (למשל טבלת ההפסדים של החדר) לא זז
 * אף מטבע ואף גביע — settled:false, והמנגנון ממשיך לחייב תשובה מדויקת
 * במקום לנחש.
 */
function settleMatch(roomId, winnerProfile, loserProfile) {
  const room = ROOMS[roomId];
  if (!room) return { settled: false, missing: ['unknown-room'] };

  const winner = withEconomy(winnerProfile);
  const loser = withEconomy(loserProfile);
  const loss = lossFor(roomId, loser.trophyPoints);
  const streakBonus = streakBonusFor(winner.rankedWinStreak + 1);

  const missing = [];
  if (loss === null) missing.push('loss-trophies');
  if (streakBonus === null) missing.push('streak-bonus');
  if (missing.length) return { settled: false, missing };

  const leagueBefore = leagueFor(winner.highestTrophyPoints);

  // המנצח: מטבעות הזכייה + גביעי החדר + בונוס רצף (רק ניצחון מדורג)
  winner.coins += room.winCoins;
  winner.trophyPoints += room.winTrophies + streakBonus;
  winner.highestTrophyPoints = Math.max(winner.highestTrophyPoints, winner.trophyPoints);
  winner.rankedWins += 1;
  winner.rankedWinStreak += 1;
  winner.bestRankedWinStreak = Math.max(winner.bestRankedWinStreak, winner.rankedWinStreak);

  // המפסיד: דמי הכניסה כבר נגבו בפתיחת המשחק; כאן יורדים רק גביעים,
  // אף פעם לא מתחת לאפס.
  loser.trophyPoints = Math.max(0, loser.trophyPoints - loss);
  loser.rankedLosses += 1;
  loser.rankedWinStreak = 0;

  const leagueAfter = leagueFor(winner.highestTrophyPoints);

  return {
    settled: true,
    missing: [],
    winner: {
      profile: winner,
      delta: { coins: room.winCoins, trophies: room.winTrophies + streakBonus },
      streak: winner.rankedWinStreak,
      streakBonusApplied: streakBonus > 0,
      leagueBefore,
      leagueAfter,
    },
    loser: {
      profile: loser,
      delta: { coins: 0, trophies: -loss },
      streak: 0,
    },
  };
}

/** סליקת תיקו: דמי הכניסה חוזרים לשני הצדדים, הגביעים לא זזים. */
function settleDraw(roomId, profileA, profileB) {
  const room = ROOMS[roomId];
  if (!room) return { settled: false, missing: ['unknown-room'] };
  const a = refundEntry(profileA, roomId).profile;
  const b = refundEntry(profileB, roomId).profile;
  a.rankedWinStreak = 0;
  b.rankedWinStreak = 0;
  return {
    settled: true,
    missing: [],
    a: { profile: a, delta: { coins: room.entryCoins, trophies: 0 } },
    b: { profile: b, delta: { coins: room.entryCoins, trophies: 0 } },
  };
}

/** תצוגה ציבורית של ההגדרות — מה שהלקוח צריך כדי לצייר את כרטיסי החדרים. */
function publicConfig() {
  return {
    rooms: Object.values(ROOMS).map((r) => ({
      id: r.id,
      nameHe: r.nameHe,
      entryCoins: r.entryCoins,
      winCoins: r.winCoins,
      winTrophies: r.winTrophies,
      unlockTrophies: r.unlockTrophies,
      available: roomAvailable(r.id),
    })),
    leagues: LEAGUES,
    welcomeCoins: WELCOME_COINS,
    streakBonusPublished: STREAK_BONUS !== null,
  };
}

module.exports = {
  ROOMS, LOSS_BRACKETS, LEAGUES, WELCOME_COINS,
  roomAvailable, bracketIndex, lossFor, streakBonusFor, leagueFor, roomUnlocked,
  economyDefaults, withEconomy, grantWelcome,
  chargeEntry, refundEntry, settleMatch, settleDraw, publicConfig,
  _setStreakBonusForTest,
};
