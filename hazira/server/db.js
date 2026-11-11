'use strict';

/**
 * db.js — אחסון מתמיד למשתמשים, להתקדמות ולהיסטוריה.
 *
 * המשחק חייב לעבוד גם בלי מסד נתונים: בפיתוח מקומי, וגם אם החיבור נופל
 * בהרצה. לכן כל הקובץ מתנהג כשכבה אופציונלית — `enabled` אומר אם יש חיבור,
 * וכשאין, המשחק ממשיך במצב אורח בלבד ואפשרות ההרשמה פשוט לא מוצעת.
 */

const { Pool } = require('pg');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY,
    username      text UNIQUE NOT NULL,
    display_name  text NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS duels (
    id            uuid PRIMARY KEY,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    played_at     timestamptz NOT NULL DEFAULT now(),
    opponent_name text,
    category      text,
    won           boolean NOT NULL,
    correct       integer NOT NULL DEFAULT 0,
    passes        integer NOT NULL DEFAULT 0,
    best_streak   integer NOT NULL DEFAULT 0,
    fastest_ms    integer,
    clock_left_ms integer,
    xp_gained     integer NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS duels_by_user ON duels (user_id, played_at DESC);
  CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id);
`;

let pool = null;
let ready = false;

/**
 * מתחבר ומוודא שהסכמה קיימת. כישלון אינו מפיל את השרת — הוא רק משאיר
 * את המשחק במצב אורח, וזה עדיף על אתר שלא עולה בכלל.
 */
async function init(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    console.log('  ℹ️  אין DATABASE_URL — המשחק ירוץ במצב אורח בלבד (בלי הרשמה).');
    return false;
  }
  try {
    pool = new Pool({
      connectionString,
      // ספקים מנוהלים (Neon, Render) מנפיקים תעודה משלהם; בלי זה החיבור נדחה
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    await pool.query(SCHEMA);
    ready = true;
    console.log('  ✓ מסד נתונים מחובר — חשבונות, היסטוריה וטבלת שיאים פעילים.');
    return true;
  } catch (err) {
    console.error(`  ⚠️  מסד הנתונים לא זמין (${err.message}) — המשחק ירוץ במצב אורח בלבד.`);
    pool = null;
    ready = false;
    return false;
  }
}

const enabled = () => ready;

async function query(text, params = []) {
  if (!ready) throw new Error('מסד הנתונים לא זמין');
  return pool.query(text, params);
}

async function close() {
  if (pool) await pool.end();
  pool = null;
  ready = false;
}

module.exports = { init, enabled, query, close, SCHEMA };
