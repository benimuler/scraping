'use strict';

/**
 * accounts.js — הרשמה, כניסה, והתקדמות ששמורה בצד השרת.
 *
 * הסיסמאות נשמרות כגיבוב scrypt עם מלח אקראי לכל משתמש. scrypt מגיע
 * מובנה ב-Node, ולכן אין כאן תלות חיצונית לניהול סודות — וההשוואה נעשית
 * בזמן קבוע, כדי שלא יהיה אפשר ללמוד מהזמן אם הגיבוב קרוב.
 */

const crypto = require('crypto');
const { promisify } = require('util');
const db = require('./db');

const scrypt = promisify(crypto.scrypt);
const KEYLEN = 64;
const SESSION_DAYS = 90;

// ------------------------------------------------------------------ סיסמה

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hex) return false;
  const derived = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(hex, 'hex');
  // אורך שונה יפיל את timingSafeEqual, ולכן נבדק קודם
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

// ------------------------------------------------------------------ תקינות

const USERNAME_RE = /^[a-zA-Z0-9֐-׿_.-]{3,20}$/;

/** @returns {string|null} הודעת שגיאה, או null אם תקין. */
function validate(username, password) {
  if (!USERNAME_RE.test(String(username || '').trim())) {
    return 'שם משתמש: 3 עד 20 תווים, אותיות, ספרות, נקודה, מקף או קו תחתון';
  }
  if (String(password || '').length < 6) return 'הסיסמה צריכה להיות באורך 6 תווים לפחות';
  return null;
}

// ----------------------------------------------------------------- הרשמה

async function register({ username, password, displayName }) {
  const problem = validate(username, password);
  if (problem) throw Object.assign(new Error(problem), { status: 400 });

  const name = String(username).trim();
  const key = name.toLowerCase();
  const exists = await db.query('SELECT 1 FROM users WHERE lower(username) = $1', [key]);
  if (exists.rowCount) {
    throw Object.assign(new Error('שם המשתמש כבר תפוס'), { status: 409 });
  }

  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO users (id, username, display_name, password_hash) VALUES ($1, $2, $3, $4)',
    [id, name, String(displayName || name).slice(0, 24), await hashPassword(password)],
  );
  return { id, username: name, displayName: String(displayName || name).slice(0, 24) };
}

async function login({ username, password }) {
  const invalid = () => Object.assign(new Error('שם משתמש או סיסמה שגויים'), { status: 401 });
  const found = await db.query(
    'SELECT id, username, display_name, password_hash FROM users WHERE lower(username) = $1',
    [String(username || '').trim().toLowerCase()],
  );
  const row = found.rows[0];
  // גם כשאין משתמש מריצים גיבוב, כדי שזמן התשובה לא יסגיר מי קיים
  const ok = await verifyPassword(password, row ? row.password_hash : 'scrypt$00$00');
  if (!row || !ok) throw invalid();
  return { id: row.id, username: row.username, displayName: row.display_name };
}

// ---------------------------------------------------------------- מושבים

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

async function userForToken(token) {
  if (!token) return null;
  const found = await db.query(
    `SELECT u.id, u.username, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.last_seen > now() - interval '${SESSION_DAYS} days'`,
    [token],
  );
  const row = found.rows[0];
  if (!row) return null;
  db.query('UPDATE sessions SET last_seen = now() WHERE token = $1', [token]).catch(() => {});
  return { id: row.id, username: row.username, displayName: row.display_name };
}

async function endSession(token) {
  if (token) await db.query('DELETE FROM sessions WHERE token = $1', [token]);
}

// --------------------------------------------------------- פרופיל והיסטוריה

async function getProfile(userId) {
  const found = await db.query('SELECT data FROM profiles WHERE user_id = $1', [userId]);
  return found.rows[0]?.data || null;
}

async function saveProfile(userId, profile) {
  await db.query(
    `INSERT INTO profiles (user_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
    [userId, profile],
  );
  return profile;
}

async function recordDuel(userId, duel) {
  await db.query(
    `INSERT INTO duels (id, user_id, opponent_name, category, won, correct, passes,
                        best_streak, fastest_ms, clock_left_ms, xp_gained)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      crypto.randomUUID(), userId, duel.opponentName || null, duel.category || null,
      !!duel.won, duel.correct | 0, duel.passes | 0, duel.bestStreak | 0,
      duel.fastestMs ?? null, duel.clockLeftMs ?? null, duel.xpGained | 0,
    ],
  );
}

async function history(userId, limit = 30) {
  const found = await db.query(
    `SELECT played_at, opponent_name, category, won, correct, passes,
            best_streak, fastest_ms, clock_left_ms, xp_gained
       FROM duels WHERE user_id = $1 ORDER BY played_at DESC LIMIT $2`,
    [userId, Math.min(100, Math.max(1, limit))],
  );
  return found.rows.map((r) => ({
    playedAt: r.played_at,
    opponentName: r.opponent_name,
    category: r.category,
    won: r.won,
    correct: r.correct,
    passes: r.passes,
    bestStreak: r.best_streak,
    fastestMs: r.fastest_ms,
    clockLeftMs: r.clock_left_ms,
    xpGained: r.xp_gained,
  }));
}

/**
 * טבלת השיאים. הדירוג לפי ניסיון, כי הוא המדד היחיד שמאחד גם ותק וגם
 * איכות — מי ששיחק הרבה והפסיד לא יעקוף את מי ששיחק מעט וניצח הכול.
 */
async function leaderboard(limit = 25) {
  const found = await db.query(
    `SELECT u.display_name, p.data
       FROM profiles p JOIN users u ON u.id = p.user_id
      ORDER BY (p.data->>'xp')::int DESC NULLS LAST
      LIMIT $1`,
    [Math.min(100, Math.max(1, limit))],
  );
  return found.rows.map((r, i) => {
    const d = r.data || {};
    return {
      rank: i + 1,
      name: r.display_name,
      xp: d.xp || 0,
      wins: d.wins || 0,
      duels: d.duels || 0,
      correct: d.correct || 0,
      bestStreak: d.bestStreak || 0,
      fastestMs: d.fastestMs ?? null,
      trophies: Object.keys(d.trophies || {}).length,
    };
  });
}

module.exports = {
  hashPassword, verifyPassword, validate,
  register, login, createSession, userForToken, endSession,
  getProfile, saveProfile, recordDuel, history, leaderboard,
};
