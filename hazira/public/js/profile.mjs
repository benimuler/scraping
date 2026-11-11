/**
 * profile.mjs — התקדמות שנשמרת בין משחקים.
 *
 * המצב נשמר בטלפון עצמו ולא בשרת, משתי סיבות: השרת מחזיק את מצב המשחק
 * בזיכרון בלבד ומאבד אותו בכל הפעלה מחדש, ואין כאן חשבונות משתמש. הטלפון
 * הוא ממילא המכשיר האישי, ולכן הוא המקום הנכון לאסוף בו ניסיון וגביעים.
 *
 * הקובץ מיוצא כמודול טהור בלי גישה ישירה לאחסון, כדי שאפשר יהיה לבדוק
 * את חישוב הניסיון והגביעים בלי דפדפן.
 */

export const PROFILE_VERSION = 1;

// ------------------------------------------------------------ רמות וניסיון

/** סך הניסיון הדרוש כדי להגיע לרמה. רמה 1 מתחילה באפס. */
export const levelThreshold = (level) => 50 * (level - 1) * level;

export function levelFor(xp) {
  let level = 1;
  while (levelThreshold(level + 1) <= xp) level++;
  return level;
}

/** ההתקדמות בתוך הרמה הנוכחית — לפס ההתקדמות על המסך. */
export function levelProgress(xp) {
  const level = levelFor(xp);
  const from = levelThreshold(level);
  const to = levelThreshold(level + 1);
  return { level, from, to, into: xp - from, need: to - from, ratio: (xp - from) / (to - from) };
}

/**
 * ניסיון על דו־קרב אחד. הבסיס הוא תשובות נכונות, כך שגם מי שהפסיד מתקדם —
 * אחרת סדרה של הפסדים הייתה מרגישה כמו עמידה במקום.
 */
export function xpForRound(round) {
  let xp = round.correct * 10;
  if (round.won) xp += 50;
  if (round.won && round.passes === 0) xp += 15;
  if (round.won && round.clockLeftMs < 5000) xp += 20;
  if (round.bestStreak >= 5) xp += 15;
  return xp;
}

// ------------------------------------------------------------------ גביעים

export const TROPHIES = [
  { id: 'first-win', icon: '🥇', name: 'ניצחון ראשון', desc: 'לנצח בדו־קרב',
    check: (p) => p.wins >= 1 },
  { id: 'clean', icon: '✨', name: 'ללא רבב', desc: 'לנצח בלי לוותר על אף תמונה',
    check: (p, r) => r.won && r.passes === 0 && r.correct >= 3 },
  { id: 'lightning', icon: '⚡', name: 'ברק', desc: 'לענות בפחות משתי שניות',
    check: (p, r) => r.fastestMs !== null && r.fastestMs < 2000 },
  { id: 'streak5', icon: '🔥', name: 'רצף חמש', desc: 'חמש תשובות נכונות ברצף',
    check: (p, r) => r.bestStreak >= 5 },
  { id: 'clutch', icon: '🧊', name: 'קור רוח', desc: 'לנצח עם פחות מחמש שניות על השעון',
    check: (p, r) => r.won && r.clockLeftMs < 5000 },
  { id: 'hattrick', icon: '🎩', name: 'שלושער', desc: 'שלושה ניצחונות ברצף',
    check: (p) => p.winStreak >= 3 },
  { id: 'comeback', icon: '🔄', name: 'קאמבק', desc: 'לנצח מיד אחרי הפסד',
    check: (p, r) => r.won && r.afterLoss },
  { id: 'speedster', icon: '🏃', name: 'זריז', desc: 'ממוצע תגובה מתחת לארבע שניות',
    check: (p, r) => r.correct >= 5 && r.totalMs / r.correct < 4000 },
  { id: 'perfect10', icon: '🎯', name: 'עשר נקי', desc: 'עשר תשובות בדו־קרב בלי ויתור',
    check: (p, r) => r.correct >= 10 && r.passes === 0 },
  { id: 'marathon', icon: '🕐', name: 'מרתון', desc: 'דו־קרב עם עשרים תשובות',
    check: (p, r) => r.totalAnswers >= 20 },
  { id: 'century', icon: '💯', name: 'מאה', desc: 'מאה תשובות נכונות בסך הכול',
    check: (p) => p.correct >= 100 },
  { id: 'veteran', icon: '🎖️', name: 'ותיק', desc: 'עשרים וחמישה דו־קרבות',
    check: (p) => p.duels >= 25 },
  { id: 'polymath', icon: '🧠', name: 'רב־תחומי', desc: 'לנצח בחמש קטגוריות שונות',
    check: (p) => p.categoriesWon.length >= 5 },
  { id: 'explorer', icon: '🗺️', name: 'תייר', desc: 'לשחק בעשר קטגוריות שונות',
    check: (p) => p.categoriesPlayed.length >= 10 },
];

const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));
export const trophyById = (id) => TROPHY_BY_ID.get(id) || null;

// ------------------------------------------------------------------ פרופיל

export function emptyProfile(name = '') {
  return {
    version: PROFILE_VERSION,
    name,
    xp: 0,
    duels: 0,
    wins: 0,
    losses: 0,
    correct: 0,
    passes: 0,
    winStreak: 0,
    bestWinStreak: 0,
    bestStreak: 0,
    fastestMs: null,
    categoriesWon: [],
    categoriesPlayed: [],
    trophies: {},
    updatedAt: null,
  };
}

/** מגן מפני נתונים ישנים או פגומים באחסון המקומי. */
function normalize(raw, name) {
  const base = emptyProfile(name);
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return base;
  const merged = { ...base, ...raw };
  merged.categoriesWon = Array.isArray(raw.categoriesWon) ? raw.categoriesWon : [];
  merged.categoriesPlayed = Array.isArray(raw.categoriesPlayed) ? raw.categoriesPlayed : [];
  merged.trophies = raw.trophies && typeof raw.trophies === 'object' ? raw.trophies : {};
  if (name) merged.name = name;
  return merged;
}

/**
 * מקפל תוצאת דו־קרב לתוך הפרופיל.
 *
 * @param {object} profile  הפרופיל לפני הדו־קרב
 * @param {object} round    {won, correct, passes, bestStreak, fastestMs,
 *                           clockLeftMs, totalMs, totalAnswers, categoryId}
 * @returns {{profile, xpGained, levelBefore, levelAfter, unlocked}}
 */
export function applyRound(profile, round) {
  const before = normalize(profile, profile?.name);
  const levelBefore = levelFor(before.xp);
  const afterLoss = before.winStreak === 0 && before.duels > 0;

  const next = { ...before };
  next.duels += 1;
  next.correct += round.correct;
  next.passes += round.passes;
  next.bestStreak = Math.max(next.bestStreak, round.bestStreak || 0);
  if (round.fastestMs !== null && round.fastestMs !== undefined) {
    next.fastestMs = next.fastestMs === null
      ? round.fastestMs
      : Math.min(next.fastestMs, round.fastestMs);
  }

  if (round.won) {
    next.wins += 1;
    next.winStreak = before.winStreak + 1;
    next.bestWinStreak = Math.max(next.bestWinStreak, next.winStreak);
    if (round.categoryId && !next.categoriesWon.includes(round.categoryId)) {
      next.categoriesWon = [...next.categoriesWon, round.categoryId];
    }
  } else {
    next.losses += 1;
    next.winStreak = 0;
  }

  if (round.categoryId && !next.categoriesPlayed.includes(round.categoryId)) {
    next.categoriesPlayed = [...next.categoriesPlayed, round.categoryId];
  }

  const xpGained = xpForRound(round);
  next.xp = before.xp + xpGained;
  next.updatedAt = new Date().toISOString();

  // הגביעים נבדקים מול הפרופיל המעודכן, כדי ש"מאה תשובות" ייפתח בדו־קרב
  // שבו המאה הושלמה ולא בזה שאחריו
  const context = { ...round, afterLoss };
  const unlocked = [];
  for (const trophy of TROPHIES) {
    if (next.trophies[trophy.id]) continue;
    if (trophy.check(next, context)) {
      next.trophies[trophy.id] = next.updatedAt;
      unlocked.push(trophy);
    }
  }

  return { profile: next, xpGained, levelBefore, levelAfter: levelFor(next.xp), unlocked };
}

/** שיאים אישיים שנשברו בדו־קרב — הבסיס להודעת "שיא חדש". */
export function personalBests(before, round) {
  const bests = [];
  const prior = normalize(before, before?.name);
  if (round.fastestMs != null && (prior.fastestMs === null || round.fastestMs < prior.fastestMs)) {
    bests.push({ id: 'fastest', label: 'תשובה הכי מהירה', value: `${(round.fastestMs / 1000).toFixed(1)} שניות` });
  }
  if ((round.bestStreak || 0) > prior.bestStreak) {
    bests.push({ id: 'streak', label: 'רצף הכי ארוך', value: `${round.bestStreak}` });
  }
  return bests;
}

// ------------------------------------------------------------------ אחסון

const KEY = 'hazira:profile';

export function loadProfile(storage, name = '') {
  try {
    return normalize(JSON.parse(storage.getItem(KEY) || 'null'), name);
  } catch {
    return emptyProfile(name);
  }
}

export function saveProfile(storage, profile) {
  try {
    storage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* מצב פרטי או אחסון מלא — ההתקדמות פשוט לא נשמרת */
  }
  return profile;
}
