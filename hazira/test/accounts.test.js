'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../server/db');
const accounts = require('../server/accounts');

const TEST_DB = process.env.TEST_DATABASE_URL;

/**
 * הבדיקות שדורשות מסד נתונים רצות רק כשיש אחד. בלעדיו נבדקת ההתנהגות
 * החשובה לא פחות: שהמשחק ממשיך לעבוד במצב אורח כשאין חשבונות.
 */
const describeDb = TEST_DB ? test : test.skip;

test.before(async () => {
  if (TEST_DB) await db.init(TEST_DB);
});

test.after(async () => {
  if (TEST_DB) {
    await db.query('DROP TABLE IF EXISTS duels, profiles, sessions, users CASCADE').catch(() => {});
    await db.close();
  }
});

let counter = 0;
const uniq = (prefix) => `${prefix}${Date.now().toString(36)}${counter++}`;

// ------------------------------------------------------- בלי מסד נתונים

test('גיבוב סיסמה אינו חושף אותה, ואימות עובד בשני הכיוונים', async () => {
  const hash = await accounts.hashPassword('סיסמה-חזקה-123');
  assert.ok(!hash.includes('סיסמה-חזקה-123'), 'הסיסמה דלפה לגיבוב');
  assert.match(hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);

  assert.equal(await accounts.verifyPassword('סיסמה-חזקה-123', hash), true);
  assert.equal(await accounts.verifyPassword('סיסמה אחרת', hash), false);
});

test('שתי הרשמות לאותה סיסמה מייצרות גיבובים שונים', async () => {
  const a = await accounts.hashPassword('אותה סיסמה');
  const b = await accounts.hashPassword('אותה סיסמה');
  assert.notEqual(a, b, 'בלי מלח אקראי אפשר לזהות משתמשים עם אותה סיסמה');
});

test('גיבוב פגום נדחה בלי לזרוק', async () => {
  for (const bad of ['', 'לא-גיבוב', 'scrypt$רק-מלח', null, undefined, 'md5$a$b']) {
    assert.equal(await accounts.verifyPassword('כלשהו', bad), false, String(bad));
  }
});

test('כללי שם משתמש וסיסמה', () => {
  assert.equal(accounts.validate('דנה', 'סיסמה123'), null);
  assert.equal(accounts.validate('dana_99', 'abcdef'), null);
  assert.ok(accounts.validate('אב', 'סיסמה123'), 'שם קצר מדי אמור להידחות');
  assert.ok(accounts.validate('שם עם רווח', 'סיסמה123'), 'רווח אמור להידחות');
  assert.ok(accounts.validate('דנה', '123'), 'סיסמה קצרה מדי אמורה להידחות');
  assert.ok(accounts.validate('a'.repeat(21), 'abcdef'), 'שם ארוך מדי אמור להידחות');
});

// -------------------------------------------------------- עם מסד נתונים

describeDb('הרשמה, כניסה, ומושב שנשאר תקף', async () => {
  const username = uniq('דנה');
  const user = await accounts.register({ username, password: 'סיסמה123' });
  assert.equal(user.username, username);

  const token = await accounts.createSession(user.id);
  const fromToken = await accounts.userForToken(token);
  assert.equal(fromToken.id, user.id);

  const again = await accounts.login({ username, password: 'סיסמה123' });
  assert.equal(again.id, user.id);

  await accounts.endSession(token);
  assert.equal(await accounts.userForToken(token), null, 'מושב שנסגר עדיין תקף');
});

describeDb('שם משתמש תפוס נדחה, גם באותיות שונות', async () => {
  const username = uniq('Yossi');
  await accounts.register({ username, password: 'סיסמה123' });
  await assert.rejects(
    () => accounts.register({ username: username.toUpperCase(), password: 'אחרת123' }),
    /תפוס/,
  );
});

describeDb('סיסמה שגויה ומשתמש שלא קיים מחזירים את אותה שגיאה', async () => {
  const username = uniq('אבי');
  await accounts.register({ username, password: 'סיסמה123' });
  // אותה הודעה בדיוק, כדי שלא יהיה אפשר למפות אילו שמות קיימים
  await assert.rejects(() => accounts.login({ username, password: 'לא נכון' }), /שגויים/);
  await assert.rejects(() => accounts.login({ username: uniq('רפאים'), password: 'משהו' }), /שגויים/);
});

describeDb('טוקן שגוי לא מחזיר משתמש', async () => {
  assert.equal(await accounts.userForToken('לא-קיים'), null);
  assert.equal(await accounts.userForToken(''), null);
  assert.equal(await accounts.userForToken(null), null);
});

describeDb('פרופיל נשמר ונטען', async () => {
  const user = await accounts.register({ username: uniq('שרה'), password: 'סיסמה123' });
  assert.equal(await accounts.getProfile(user.id), null);

  await accounts.saveProfile(user.id, { xp: 120, wins: 2, trophies: { 'first-win': 'x' } });
  assert.equal((await accounts.getProfile(user.id)).xp, 120);

  await accounts.saveProfile(user.id, { xp: 300, wins: 4, trophies: {} });
  assert.equal((await accounts.getProfile(user.id)).xp, 300, 'שמירה חוזרת לא עדכנה');
});

describeDb('היסטוריית דו־קרבות נשמרת מהחדש לישן', async () => {
  const user = await accounts.register({ username: uniq('רון'), password: 'סיסמה123' });
  for (const [i, category] of ['יונקים', 'פירות', 'דגלי אירופה'].entries()) {
    await accounts.recordDuel(user.id, {
      opponentName: `יריב ${i}`, category, won: i % 2 === 0,
      correct: 5 + i, passes: i, bestStreak: 3, fastestMs: 1500, clockLeftMs: 9000, xpGained: 60,
    });
  }
  const rows = await accounts.history(user.id);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].category, 'דגלי אירופה', 'הסדר לא מהחדש לישן');
  assert.equal(rows[0].correct, 7);
  assert.equal(typeof rows[0].won, 'boolean');
});

describeDb('טבלת השיאים מדורגת לפי ניסיון', async () => {
  const names = [uniq('א'), uniq('ב'), uniq('ג')];
  const xps = [50, 900, 400];
  for (const [i, username] of names.entries()) {
    const u = await accounts.register({ username, password: 'סיסמה123' });
    await accounts.saveProfile(u.id, {
      xp: xps[i], wins: i, duels: 3, correct: 10, bestStreak: 2, fastestMs: 2000, trophies: {},
    });
  }
  const board = await accounts.leaderboard(100);
  const mine = board.filter((row) => names.includes(row.name));
  assert.deepEqual(mine.map((r) => r.xp), [900, 400, 50], 'הדירוג לא לפי ניסיון');
  assert.ok(board[0].rank === 1);
});

describeDb('מחיקת משתמש גוררת את כל מה שתלוי בו', async () => {
  const user = await accounts.register({ username: uniq('זמני'), password: 'סיסמה123' });
  await accounts.createSession(user.id);
  await accounts.saveProfile(user.id, { xp: 10 });
  await accounts.recordDuel(user.id, { won: true, correct: 1 });

  await db.query('DELETE FROM users WHERE id = $1', [user.id]);
  for (const table of ['sessions', 'profiles', 'duels']) {
    const left = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [user.id]);
    assert.equal(left.rows[0].n, 0, `נשארו שורות ב-${table}`);
  }
});
