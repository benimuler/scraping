/**
 * auth.mjs — חשבון המשתמש בצד הלקוח.
 *
 * שני מצבים, ושניהם נתמכים במלואם:
 *  - **רשום** — ההתקדמות נשמרת בשרת, ולכן היא עוברת בין מכשירים ונכנסת
 *    לטבלת השיאים. ההכרעה על ניסיון וגביעים נעשית בשרת.
 *  - **אורח** — ההתקדמות נשמרת בטלפון בלבד. עובד גם כשאין מסד נתונים.
 *
 * התוקן נשמר ב-localStorage ולא בעוגייה, כי הבקשות יוצאות מ-fetch ומ-JS
 * ולא מטפסים — וכך גם אין צורך בהגנת CSRF.
 */

const TOKEN_KEY = 'hazira:token';
const GUEST_KEY = 'hazira:guest';

const read = (key) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* מצב פרטי */ }
};

export const getToken = () => read(TOKEN_KEY);
export const setToken = (token) => write(TOKEN_KEY, token);
export const isGuest = () => read(GUEST_KEY) === '1';
export const setGuest = (on) => write(GUEST_KEY, on ? '1' : null);

async function call(path, { method = 'GET', body, token = getToken() } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* גוף ריק */ }
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `שגיאה ${res.status}`), { status: res.status });
  }
  return data;
}

/** האם השרת בכלל תומך בחשבונות. בלי מסד נתונים נשארים באורח בלבד. */
export async function accountsAvailable() {
  try {
    return (await call('/api/auth/status')).accounts === true;
  } catch {
    return false;
  }
}

export async function register({ username, password, displayName }) {
  const out = await call('/api/auth/register', {
    method: 'POST', body: { username, password, displayName }, token: null,
  });
  setToken(out.token);
  setGuest(false);
  return out;
}

export async function login({ username, password }) {
  const out = await call('/api/auth/login', {
    method: 'POST', body: { username, password }, token: null,
  });
  setToken(out.token);
  setGuest(false);
  return out;
}

export async function logout() {
  try { await call('/api/auth/logout', { method: 'POST' }); } catch { /* מושב כבר סגור */ }
  setToken(null);
}

/** @returns {{user, profile}|null} null כשאין מושב תקף. */
export async function me() {
  if (!getToken()) return null;
  try {
    return await call('/api/me');
  } catch (err) {
    // מושב שפג — מנקים כדי שלא ננסה שוב בכל טעינה
    if (err.status === 401) setToken(null);
    return null;
  }
}

export const submitDuel = (payload) => call('/api/me/duel', { method: 'POST', body: payload });
export const history = (limit = 30) => call(`/api/me/history?limit=${limit}`);
export const leaderboard = (limit = 25) => call(`/api/leaderboard?limit=${limit}`);
