'use strict';

import { connect, playerColor, formatClock, toast } from './net.js';
import { createListener, speechSupported } from './speech.js';
import {
  TROPHIES, applyRound, loadProfile, saveProfile, levelProgress, personalBests, emptyProfile,
} from './profile.mjs';
import * as auth from './auth.mjs';
import { createSounds } from './sounds.mjs';

const $ = (id) => document.getElementById(id);
const sounds = createSounds();
const soundButton = $('sound-toggle');
function updateSoundButton() {
  soundButton.textContent = sounds.enabled ? '🔊' : '🔇';
  soundButton.setAttribute('aria-label', sounds.enabled ? 'השתקת צלילים' : 'הפעלת צלילים');
  soundButton.setAttribute('aria-pressed', String(sounds.enabled));
}
soundButton.addEventListener('click', () => { sounds.setEnabled(!sounds.enabled); updateSoundButton(); if(sounds.enabled) sounds.play('turn'); });
document.addEventListener('pointerdown', () => sounds.unlock(), {passive:true});
document.addEventListener('keydown', () => sounds.unlock());
updateSoundButton();
let soundPhase = null, soundTurn = null, countdownSecond = null, lowSecond = null;
const screens = {
  welcome: $('s-welcome'), auth: $('s-auth'), join: $('s-join'),
  wait: $('s-wait'), quickwait: $('s-quickwait'), intro: $('s-intro'), pick: $('s-pick'),
  watch: $('s-watch'), duel: $('s-duel'), decide: $('s-decide'), over: $('s-over'),
};

// שכבות שנפתחות מעל המשחק. הן לא חלק מזרימת המשחק, ולכן כפתור החזרה של
// הטלפון סוגר אותן במקום לצאת מהאפליקציה.
const overlays = {
  trophies: $('s-trophies'), history: $('s-history'), board: $('s-board'),
};

const STORAGE_KEY = 'hazira:session';

let net = null;
let state = null;
let me = null;
let colors = new Map();
let clock = { clocks: {}, activeId: null, at: 0, passLockMs: 0 };
let currentItem = null;
let micOn = false;
let lastActiveId = null;
let profile = loadProfile(window.localStorage);
let account = null;          // {id, username, displayName} כשמחוברים
let accountsAvailable = false;
let authMode = 'register';
let scoredDuelId = null;   // כדי שדו־קרב אחד לא ייספר פעמיים ברינדור חוזר
let lastStreak = 0;
let deadlineAt = 0;

// ------------------------------------------------------------- מיקרופון

let micWanted = false;

const listener = createListener({
  onTranscript: (text, isFinal) => net?.send({ t: 'speech', transcript: text, isFinal }),
  onState: (s) => {
    if (s === 'listening') { micOn = true; }
    if (s === 'idle') { micOn = false; }
    if (s === 'denied') {
      micWanted = false;
      micOn = false;
      toast('אין הרשאת מיקרופון — אפשר להקליד תשובות במקום');
    }
    if (s === 'unsupported') toast('הדפדפן לא תומך בזיהוי דיבור — הקלידו תשובות');
    updateMicUi();
  },
});

function setMic(on, { keepWanted = false } = {}) {
  if (on) {
    micWanted = true;
    listener.start();
  } else {
    if (!keepWanted) micWanted = false;
    listener.stop();
    micOn = false;
  }
  updateMicUi();
}

function updateMicUi() {
  const btn = $('btn-mic');
  btn.classList.toggle('on', micOn);
  btn.textContent = micOn ? '🎤 מאזין — הפסק' : '🎤 הפעלת מיקרופון';
  $('mic-dot').hidden = !micOn;
  $('mic-status').textContent = !speechSupported ? 'זיהוי דיבור לא נתמך — הקלידו'
    : micOn ? 'מאזינים… פשוט תגידו מה רואים'
    : micWanted ? 'המיקרופון ידלק כשיגיע התור שלך'
    : 'מיקרופון כבוי';
}

$('btn-mic').addEventListener('click', () => setMic(!micOn));
updateMicUi();

// ------------------------------------------------------------ טופס כניסה

const params = new URLSearchParams(location.search);
const quickMode = params.get('quick') === '1';
const stored = readStored();
$('f-code').value = (params.get('code') || stored.code || '').toUpperCase();
$('f-name').value = stored.name || '';
// במשחק מהיר אין קוד — היריב משובץ אוטומטית מול שחקן אקראי אחר שמחכה
if (quickMode) { $('code-field').hidden = true; $('f-code').required = false; }

fetch('/api/categories').then((r) => r.json()).then((cats) => {
  $('f-cat').innerHTML = '<option value="">שהמערכת תבחר בשבילי</option>' +
    cats.map((c) => `<option value="${c.id}">${c.name} (${c.size} פריטים)</option>`).join('');
});

$('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('f-code').value.trim().toUpperCase();
  const name = $('f-name').value.trim();
  if (!name) return;
  if (quickMode) return startQuickMatch(name, $('f-cat').value || null);
  if (!code) return;
  // מזהה שחקן נשמר רק אם חוזרים לאותה זירה — אחרת מצטרפים מחדש
  const playerId = stored.code === code ? stored.playerId : null;
  join({ code, name, categoryId: $('f-cat').value || null, playerId });
});

function join({ code, name, categoryId, playerId }) {
  net = connect({
    role: 'player',
    code, name, categoryId, playerId,
    on: {
      joined: (msg) => {
        writeStored({ code, name, playerId: msg.playerId });
        applyState(msg.state);
      },
      state: (msg) => applyState(msg.state),
      clock: (msg) => {
        clock = { clocks: msg.clocks, activeId: msg.activeId, at: performance.now(), passLockMs: msg.passLockMs };
      },
      live: (msg) => { if (msg.activeId === net.playerId) renderLive(msg.live, msg.transcript); },
      answer: (msg) => onAnswer(msg),
      status: (s) => $('conn-dot').classList.toggle('off', s !== 'connected'),
      error: (msg) => {
        if (msg.fatal) {
          show('join');
          $('join-error').textContent = msg.message;
          $('join-error').hidden = false;
          writeStored({});
        } else {
          toast(msg.message);
        }
      },
    },
  });
}

// --------------------------------------------------------- משחק מהיר

let quickTicket = null;
let quickTimer = null;
let quickJoin = null;

async function startQuickMatch(name, categoryId) {
  quickJoin = { name, categoryId };
  $('join-error').hidden = true;
  try {
    const res = await fetch('/api/quickmatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, categoryId }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'לא הצלחתי להצטרף לתור');
    if (out.status === 'matched') {
      return join({ code: out.code, name, categoryId, playerId: null });
    }
    quickTicket = out.ticket;
    show('quickwait');
    quickTimer = setInterval(pollQuickMatch, 2000);
  } catch (err) {
    $('join-error').textContent = err.message;
    $('join-error').hidden = false;
  }
}

async function pollQuickMatch() {
  if (!quickTicket || !quickJoin) return;
  try {
    const res = await fetch(`/api/quickmatch/${quickTicket}`);
    if (res.status === 404) return cancelQuickMatch(false);
    const out = await res.json();
    if (out.status === 'matched') {
      clearInterval(quickTimer);
      quickTimer = null;
      const { name, categoryId } = quickJoin;
      quickTicket = null;
      join({ code: out.code, name, categoryId, playerId: null });
    }
  } catch { /* תקלה ברשת — הסבב הבא ינסה שוב */ }
}

async function cancelQuickMatch(notify = true) {
  clearInterval(quickTimer);
  quickTimer = null;
  if (quickTicket && notify) {
    try { await fetch(`/api/quickmatch/${quickTicket}`, { method: 'DELETE' }); } catch { /* לא קריטי */ }
  }
  quickTicket = null;
  show('join');
}

$('quick-cancel').addEventListener('click', () => cancelQuickMatch());

// ------------------------------------------------------------ חשבון

/**
 * מחליט על מסך הפתיחה: חיבור חוזר לדו־קרב פתוח, חשבון קיים, או בחירה
 * בין הרשמה לאורח. מצב אורח חייב להישאר זמין תמיד — גם כשאין מסד נתונים.
 */
async function bootstrap() {
  accountsAvailable = await auth.accountsAvailable();

  const session = accountsAvailable ? await auth.me() : null;
  if (session) {
    account = session.user;
    profile = session.profile || emptyProfile(session.user.displayName);
    $('f-name').value = account.displayName;
  }

  if (stored.code && stored.playerId && stored.name) {
    return join({ code: stored.code, name: stored.name, playerId: stored.playerId });
  }
  if (account || auth.isGuest() || !accountsAvailable) {
    if (!accountsAvailable) auth.setGuest(true);
    return show('join');
  }
  $('welcome-guest-note').hidden = accountsAvailable;
  show('welcome');
}

$('go-register').addEventListener('click', () => openAuth('register'));
$('go-login').addEventListener('click', () => openAuth('login'));
$('go-guest').addEventListener('click', () => {
  auth.setGuest(true);
  show('join');
});
$('auth-back').addEventListener('click', () => show('welcome'));

function openAuth(mode) {
  authMode = mode;
  $('auth-title').textContent = mode === 'register' ? 'הרשמה' : 'כניסה';
  $('auth-submit').textContent = mode === 'register' ? 'הרשמה' : 'כניסה';
  $('a-pass').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  $('auth-error').hidden = true;
  show('auth');
}

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submit = $('auth-submit');
  const username = $('a-user').value.trim();
  const password = $('a-pass').value;
  submit.disabled = true;

  try {
    const out = authMode === 'register'
      ? await auth.register({ username, password, displayName: username })
      : await auth.login({ username, password });
    account = out.user;
    profile = out.profile || emptyProfile(out.user.displayName);
    $('f-name').value = account.displayName;
    show('join');
  } catch (err) {
    $('auth-error').textContent = err.message;
    $('auth-error').hidden = false;
  } finally {
    submit.disabled = false;
  }
});

bootstrap();

// ------------------------------------------------------------------ מצב

function applyState(next) {
  state = next;
  deadlineAt = performance.now() + (next.deadlineInMs || 0);
  me = next.me;
  if (!me) return;
  next.players.forEach((p, i) => { if (!colors.has(p.id)) colors.set(p.id, playerColor(i)); });

  if (state.duel) {
    clock = {
      clocks: state.duel.clocks,
      activeId: state.duel.activeId,
      at: performance.now(),
      passLockMs: state.duel.passLockMs,
    };
  }

  if (next.phase !== soundPhase) {
    if (next.phase === 'duel') sounds.play('start');
    if (next.phase === 'duel_result') sounds.play(next.lastResult?.winnerId === me.id ? 'win' : 'lose');
    soundPhase = next.phase;
  }
  if(next.phase === 'duel' && next.duel?.activeId !== soundTurn) {
    if(next.duel?.activeId === me.id) sounds.play('turn');
    soundTurn = next.duel?.activeId;
  }
  route();
}

function route() {
  if (state.mode === 'duel') return routeDuel();

  const inDuel = me.inDuel && state.phase === 'duel';
  if (state.phase === 'finished' || !me.alive) return renderOver();
  if (inDuel) return renderDuel();
  if (state.phase === 'pick' && state.controlId === me.id) return renderPick();
  if (state.phase === 'decision' && state.controlId === me.id) return renderDecide();
  if (state.phase === 'lobby') return renderWait();
  return renderWatch();
}

/** דו־קרב עצמאי: אין לוח ואין בחירת יריב, רק לובי ← זירה ← תוצאה. */
function routeDuel() {
  switch (state.phase) {
    case 'lobby':
    case 'duel_paused': return renderWait();
    case 'duel_intro': return renderIntro();
    case 'duel': return renderDuel();
    case 'duel_result':
    case 'finished': return renderOver();
    default: return renderWatch();
  }
}

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  if (name !== 'duel') setMic(false);
  // משתמש רשום משחק בשם החשבון שלו, כך שההיסטוריה והשיאים מתייחסים לאותו אדם
  $('name-field').hidden = !!account;
  $('open-account').hidden = !accountsAvailable;
  renderTopbar(name);
}

// ------------------------------------------------------ ניווט וחזרה אחורה

let openOverlay = null;

/**
 * פתיחת שכבה דוחפת מצב להיסטוריה, כך שכפתור החזרה של הטלפון סוגר אותה
 * במקום לזרוק את השחקן מהמשחק — וזה הריפלקס הטבעי בטלפון.
 */
function showOverlay(name) {
  if (openOverlay === name) return;
  openOverlay = name;
  for (const [key, el] of Object.entries(overlays)) el.hidden = key !== name;
  history.pushState({ overlay: name }, '');
}

function closeOverlay({ fromHistory = false } = {}) {
  if (!openOverlay) return;
  openOverlay = null;
  for (const el of Object.values(overlays)) el.hidden = true;
  if (!fromHistory) history.back();
}

window.addEventListener('popstate', () => {
  if (openOverlay) closeOverlay({ fromHistory: true });
});

$('open-trophies').addEventListener('click', () => {
  renderTrophies();
  showOverlay('trophies');
});
$('trophies-back').addEventListener('click', () => closeOverlay());

$('open-history').addEventListener('click', async () => {
  showOverlay('history');
  renderHistory(await fetchHistory());
});
$('history-back').addEventListener('click', () => closeOverlay());

$('open-board').addEventListener('click', async () => {
  showOverlay('board');
  renderLeaderboard(await fetchLeaderboard());
});
$('board-back').addEventListener('click', () => closeOverlay());

$('open-account').addEventListener('click', () => {
  renderTrophies();
  showOverlay('trophies');
});

/**
 * היסטוריה של משתמש רשום מגיעה מהשרת. אורח מקבל את מה שנשמר בטלפון —
 * פחות, אבל עדיף על מסך ריק שלא מסביר למה הוא ריק.
 */
async function fetchHistory() {
  if (!account) return { local: true, duels: readLocalHistory() };
  try {
    return { local: false, duels: (await auth.history(40)).duels };
  } catch (err) {
    return { local: false, duels: [], error: err.message };
  }
}

async function fetchLeaderboard() {
  if (!accountsAvailable) return { players: [], unavailable: true };
  try {
    return { players: (await auth.leaderboard(25)).players };
  } catch (err) {
    return { players: [], error: err.message };
  }
}

function renderHistory({ duels, local, error }) {
  const list = $('history-list');
  if (error) { list.innerHTML = `<p class="empty-note">${esc(error)}</p>`; return; }
  if (!duels.length) {
    list.innerHTML = `<p class="empty-note">${
      local ? 'עדיין אין דו־קרבות. הירשמו כדי לשמור היסטוריה מלאה בין מכשירים.'
            : 'עדיין אין דו־קרבות.'}</p>`;
    return;
  }

  list.innerHTML = duels.map((d) => {
    const when = new Date(d.playedAt).toLocaleDateString('he-IL', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const against = d.opponentName ? ` · מול ${esc(d.opponentName)}` : '';
    return `
      <div class="history-row ${d.won ? 'won' : 'lost'}">
        <span class="mark">${d.won ? '🏆' : '·'}</span>
        <span>
          <b>${esc(d.category || 'דו־קרב')}</b>
          <span>${when}${against} · ${d.correct} תשובות${d.passes ? `, ${d.passes} ויתורים` : ''}</span>
        </span>
        <span class="xp">+${d.xpGained || 0}</span>
      </div>`;
  }).join('');
}

function renderLeaderboard({ players, unavailable, error }) {
  const list = $('board-list');
  if (unavailable) {
    list.innerHTML = '<p class="empty-note">טבלת השיאים דורשת חשבון — היא אינה זמינה כרגע.</p>';
    return;
  }
  if (error) { list.innerHTML = `<p class="empty-note">${esc(error)}</p>`; return; }
  if (!players.length) {
    list.innerHTML = '<p class="empty-note">אף אחד עוד לא נרשם. תהיו הראשונים.</p>';
    return;
  }

  list.innerHTML = players.map((p) => `
    <div class="board-row ${p.rank <= 3 ? 'top' : ''} ${account && p.name === account.displayName ? 'me' : ''}">
      <span class="rank">${p.rank}</span>
      <span>
        <b>${esc(p.name)}</b>
        <span>${p.wins} ניצחונות · ${p.duels} דו־קרבות · 🏆 ${p.trophies}</span>
      </span>
      <span class="xp">${p.xp}</span>
    </div>`).join('');
}

// היסטוריה מקומית לאורחים — מה שהשרת שומר לרשומים
const LOCAL_HISTORY_KEY = 'hazira:history';

function readLocalHistory() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function pushLocalHistory(entry) {
  try {
    const rows = [entry, ...readLocalHistory()].slice(0, 40);
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(rows));
  } catch { /* מצב פרטי */ }
}

/** הסרגל מיותר בתוך דו־קרב — שם כל פיקסל שייך לתמונה ולשעון. */
function renderTopbar(screen) {
  // מוסתר רק בדו־קרב, שם כל פיקסל שייך לתמונה ולשעון, ובמסכי הכניסה
  // שעוד אין בהם למי להציג התקדמות
  const show_ = !['duel', 'welcome', 'auth'].includes(screen);
  $('topbar').hidden = !show_;
  if (!show_) return;

  const p = levelProgress(profile.xp);
  $('chip-level').textContent = `רמה ${p.level}`;
  $('chip-bar').style.width = `${Math.round(p.ratio * 100)}%`;
  $('chip-trophies').textContent = `🏆 ${Object.keys(profile.trophies).length}`;
}

function renderTrophies() {
  const owned = profile.trophies;
  const p = levelProgress(profile.xp);

  $('profile-summary').innerHTML = [
    ['רמה', p.level], ['ניצחונות', profile.wins], ['דו־קרבות', profile.duels],
    ['תשובות', profile.correct], ['רצף שיא', profile.bestStreak],
    ['הכי מהיר', profile.fastestMs === null ? '—' : `${(profile.fastestMs / 1000).toFixed(1)}ש׳`],
  ].map(([label, value]) => `<div><b>${esc(value)}</b><span>${label}</span></div>`).join('');

  $('account-row').innerHTML = account
    ? `<div>מחובר כ־<b>${esc(account.displayName)}</b></div>
       <button class="btn ghost block" id="btn-logout">יציאה מהחשבון</button>
       <button class="btn block danger" id="btn-delete-account">מחיקת החשבון לצמיתות</button>`
    : `<div class="muted">משחקים כאורח — ההתקדמות נשמרת רק בטלפון הזה.</div>${
        accountsAvailable ? '<button class="btn primary block" id="btn-signup">הרשמה לשמירה בענן</button>' : ''}`;

  $('btn-logout')?.addEventListener('click', async () => {
    await auth.logout();
    account = null;
    auth.setGuest(true);
    profile = loadProfile(window.localStorage);
    closeOverlay();
    show('join');
  });
  $('btn-delete-account')?.addEventListener('click', async () => {
    const sure = window.confirm('למחוק את החשבון לצמיתות? ההיסטוריה, הפרופיל וההתקדמות בענן יימחקו ואי אפשר לשחזר.');
    if (!sure) return;
    const twice = window.confirm('בטוח? הפעולה מוחקת גם את כל הדו־קרבות והגביעים שנשמרו בחשבון.');
    if (!twice) return;
    await auth.deleteAccount();
    try { await auth.logout(); } catch { /* החשבון כבר נמחק בשרת */ }
    account = null;
    auth.setGuest(true);
    profile = loadProfile(window.localStorage);
    closeOverlay();
    show('join');
  });
  $('btn-signup')?.addEventListener('click', () => {
    closeOverlay();
    openAuth('register');
  });

  $('trophy-grid').innerHTML = TROPHIES.map((t) => `
    <div class="trophy-card ${owned[t.id] ? '' : 'locked'}">
      <span class="ico">${t.icon}</span>
      <b>${esc(t.name)}</b>
      <span>${esc(t.desc)}</span>
    </div>`).join('');
}

const playerById = (id) => state.players.find((p) => p.id === id) || null;

// ------------------------------------------------------------------ לובי

function renderWait() {
  show('wait');
  $('wait-name').textContent = me.name;
  $('wait-cat').textContent = me.category;

  const duelMode = state.mode === 'duel';
  const ready = state.players.length >= 2 && state.players.every(p => p.connected);
  const mineReady = state.readiness?.playerIds.includes(me.id);
  const paused = state.phase === 'duel_paused';

  // בדו־קרב מזמינים את היריב מהמסך הזה, ומי שמוכן פותח
  $('invite').hidden = !duelMode || ready || paused;
  $('wait-start').hidden = !(duelMode && ready);
  $('wait-start').disabled = !!mineReady;
  $('wait-start').textContent = mineReady ? 'אישרת מוכנות — ממתינים ליריב' : paused ? 'חזרתי — מוכן להמשיך' : 'אני מוכן — מתחילים כששנינו מאשרים';
  if (duelMode && !ready && !paused) renderInvite();

  $('wait-note').textContent = duelMode
    ? (ready ? `${paused ? 'המשחק נעצר. ' : ''}מול ${opponent()?.name} · ${opponentCategory()} · נדרש אישור משניכם` : 'היריב לא מחובר — המשחק לא יתחיל')
    : (ready ? `${state.players.length} מתמודדים בזירה — ממתינים לפתיחה` : 'ממתינים למתמודדים נוספים…');

  renderMiniBoard($('wait-board'));
}

const opponent = () => state.players.find((p) => p.id !== me.id) || null;
const opponentCategory = () => opponent()?.category || '—';

let inviteDrawn = false;
let inviteUrl = null;

function renderInvite() {
  $('invite-code').textContent = state.code || '····';
  if (inviteDrawn || !state.code) return;
  inviteDrawn = true;

  // הקישור מגיע מהשרת ולא מ-location, כי מאחורי מנהרה או שרת מתארח
  // הכתובת שהיריב צריך אינה בהכרח זו שפתוחה אצלי
  fetch(`/api/rooms/${state.code}`)
    .then((r) => r.json())
    .then(({ joinUrl }) => {
      inviteUrl = joinUrl || `${location.origin}/player.html?code=${state.code}`;
      $('invite-link').textContent = inviteUrl;
    })
    .catch(() => {
      inviteUrl = `${location.origin}/player.html?code=${state.code}`;
      $('invite-link').textContent = inviteUrl;
    });

  fetch(`/api/rooms/${state.code}/qr.svg`)
    .then((r) => r.text())
    .then((svg) => { $('invite-qr').innerHTML = svg; })
    .catch(() => { inviteDrawn = false; });
}

/**
 * שיתוף ההזמנה. בטלפון navigator.share פותח את תפריט השיתוף של המערכת
 * (וואטסאפ, הודעות); בדפדפן שולחני נופלים להעתקה ללוח.
 */
$('invite-share').addEventListener('click', async () => {
  const url = inviteUrl || `${location.origin}/player.html?code=${state?.code || ''}`;
  const text = `בוא/י נשחק דו קרב תמונות — דו־קרב ראש בראש. הקישור שלך: ${url}`;
  const btn = $('invite-share');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'דו קרב תמונות', text });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return; // המשתמש סגר את תפריט השיתוף
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = 'הקישור הועתק ✓';
    setTimeout(() => { btn.textContent = 'שליחת הזמנה'; }, 2500);
  } catch {
    toast('העתיקו את הקישור שמופיע למטה');
  }
});

$('wait-start').addEventListener('click', (e) => {
  e.currentTarget.disabled = true;
  net.send({ t: state.phase === 'duel_paused' ? 'resume' : 'start', epoch: state.readiness?.epoch });
});

function renderIntro() {
  show('intro');
  const duel = state.duel;
  if (!duel) return;
  const iChallenge = duel.challengerId === me.id;
  $('intro-versus').textContent = `${me.name} נגד ${opponent()?.name || 'היריב'}`;
  $('intro-cat').textContent = duel.category;
  const role = iChallenge
    ? 'אתה המאתגר — אתה מתחיל, בקטגוריה שלו'
    : 'אתה המותקף — משחקים בקטגוריה שלך';
  $('intro-role').textContent = duel.decider
    ? `סיבוב מכריע בקטגוריה אקראית! ${role.replace('בקטגוריה שלו', 'בקטגוריה אקראית').replace('בקטגוריה שלך', 'בקטגוריה אקראית')}`
    : role;
}

function renderWatch() {
  show('watch');
  const controller = playerById(state.controlId);
  const labels = {
    pick: ['בחירת יריב', `${controller?.name || '—'} בוחר את מי לתקוף`],
    duel_intro: ['מתחיל דו־קרב', state.duel ? `${playerById(state.duel.challengerId)?.name} נגד ${playerById(state.duel.defenderId)?.name}` : '—'],
    duel: ['דו־קרב בעיצומו', state.duel ? `${state.duel.category}` : '—'],
    duel_result: ['הוכרע', state.lastResult ? `${playerById(state.lastResult.winnerId)?.name} ניצח` : '—'],
    decision: ['החלטה', `${controller?.name || '—'} מחליט אם לתקוף שוב`],
  };
  const [label, title] = labels[state.phase] || ['דו־קרב', '—'];
  $('watch-label').textContent = label;
  $('watch-title').textContent = title;
  renderMiniBoard($('watch-board'));

  $('watch-clocks').innerHTML = state.duel ? [state.duel.challengerId, state.duel.defenderId].map((id) => `
    <div><span>${playerById(id)?.name}</span><span class="clock" data-clock="${id}">--.-</span></div>`).join('') : '';
}

// ------------------------------------------------------------ בחירת יריב

function renderPick() {
  show('pick');
  $('pick-list').innerHTML = (state.options || []).map((o) => `
    <button class="opt" data-id="${o.id}" style="--opt-color:${colors.get(o.id)}">
      <b>${esc(o.name)}</b>
      <span class="cat">${esc(o.category)}</span>
      <span class="tiles">${o.tiles} משבצות</span>
    </button>`).join('');

  for (const btn of $('pick-list').children) {
    btn.addEventListener('click', () => {
      net.send({ t: 'challenge', defenderId: btn.dataset.id });
      btn.disabled = true;
    });
  }
}

function renderDecide() {
  show('decide');
  const r = state.lastResult;
  $('decide-note').textContent = r ? `הדחת את ${playerById(r.loserId)?.name} וזכית ב-${r.conquered} משבצות.` : '';
  for (const btn of document.querySelectorAll('[data-choice]')) {
    btn.onclick = () => net.send({ t: 'decide', choice: btn.dataset.choice });
  }
}

// ---------------------------------------------------------------- דו־קרב

function renderDuel() {
  show('duel');
  const duel = state.duel;
  const rivalId = duel.challengerId === me.id ? duel.defenderId : duel.challengerId;
  const myTurn = duel.activeId === me.id;

  const winsNow = state.series?.wins || {};
  $('duel-cat').textContent = duel.category + (duel.decider ? ' · מכריע אקראי' : '')
    + (state.series?.round ? ` · סיבוב ${state.series.round} · ${winsNow[me.id] || 0}:${winsNow[rivalId] || 0}` : '');
  if (duel.item?.credit) {
    $('d-credit').replaceChildren();
    const creditLink = document.createElement('a');
    creditLink.textContent = `תמונה: ${duel.item.credit}`;
    if (duel.item.source?.startsWith('https://commons.wikimedia.org/')) {
      creditLink.href = duel.item.source; creditLink.target = '_blank'; creditLink.rel = 'noopener noreferrer';
    }
    $('d-credit').append(creditLink);
    $('d-credit').hidden = false;
  } else {
    $('d-credit').hidden = true;
  }
  $('rival-name').textContent = playerById(rivalId)?.name || 'יריב';
  $('my-side').classList.toggle('active', myTurn);
  $('rival-side').classList.toggle('active', !myTurn);
  $('my-clock').dataset.clock = me.id;
  $('rival-clock').dataset.clock = rivalId;

  // תמונה חדשה — מאפסים את ההאזנה כדי שהתשובה הקודמת לא תיזקף לחדשה
  const src = duel.item?.image || duel.item?.text || null;
  if (src !== currentItem) {
    currentItem = src;
    if (duel.item?.image) {
      $('d-image').src = duel.item.image;
      $('d-image').hidden = false;
    } else {
      $('d-image').hidden = true;
    }
    $('d-text').textContent = duel.item?.text || '';
    $('d-text').hidden = !duel.item?.text;
    listener.reset();
    renderLive({ verdict: 'none', score: 0 }, '');
  }

  // המיקרופון פועל רק כשהתור שלי — אחרת אנחנו מקליטים סתם
  if (duel.activeId !== lastActiveId) {
    lastActiveId = duel.activeId;
    listener.reset();
    if (myTurn && micWanted) setMic(true);
    else if (!myTurn) setMic(false, { keepWanted: true });
  }

  renderLastTurn(duel.lastTurn);
  renderStreak(duel);
  $('d-veil').hidden = myTurn;
  $('d-veil-text').textContent = `התור של ${playerById(rivalId)?.name || 'היריב'}`;
  $('btn-pass').disabled = !myTurn;
  $('typed-input').disabled = !myTurn;
  $('typed-form').querySelector('button').disabled = !myTurn;
}

$('btn-pass').addEventListener('click', () => net.send({ t: 'pass' }));

$('btn-surrender').addEventListener('click', () => {
  if (confirm('להיכנע בדו־קרב? הניצחון בסיבוב הולך ליריב.')) {
    net.send({ t: 'surrender' });
  }
});

$('typed-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('typed-input').value.trim();
  if (!text) return;
  net.send({ t: 'answer', text });
  $('typed-input').value = '';
});

function renderLive(live, transcript) {
  const el = $('d-transcript');
  el.textContent = transcript?.trim() || '…';
  el.className = `transcript ${live?.verdict === 'correct' ? 'correct' : live?.verdict === 'near' ? 'near' : micOn ? 'listening' : ''}`;
  const bar = $('d-bar');
  bar.style.width = `${Math.round((live?.score || 0) * 100)}%`;
  bar.style.background = live?.verdict === 'correct' ? 'var(--good)'
    : live?.verdict === 'near' ? 'var(--warn)' : 'var(--line)';
}

/**
 * מה קרה בתור הקודם. הניסוח שהתקבל מוצג תמיד — גם כשהוא זהה לתשובה —
 * כדי שברור על מה בדיוק ניתנה הנקודה ומה המנוע שמע.
 */
function renderLastTurn(turn) {
  const box = $('d-last-turn');
  if (!turn) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `last-turn ${turn.outcome}`;

  const who = turn.playerId === me.id ? 'אתה' : (playerById(turn.playerId)?.name || 'היריב');
  const said = turn.transcript || turn.heard;
  const parts = [`<div class="lt-head">${turn.outcome === 'correct' ? '✓' : '✗'} ${esc(turn.answer)}</div>`];

  if (turn.outcome === 'correct') {
    parts.push(`<div class="lt-said">${esc(who)}: “${esc(said || turn.answer)}”</div>`);
    if (turn.matched && turn.matched !== turn.answer) {
      parts.push(`<div class="lt-note">התקבל כ“${esc(turn.matched)}”</div>`);
    }
    parts.push(`<div class="lt-note">${(turn.ms / 1000).toFixed(1)} שניות</div>`);
  } else {
    parts.push(`<div class="lt-said">${esc(who)} ויתר${said ? ` · נשמע: “${esc(said)}”` : ''}</div>`);
  }
  box.innerHTML = parts.join('');
}

/** הרצף הנוכחי שלי, מוצג רק כששווה להתרגש ממנו. */
function renderStreak(duel) {
  const mine = duel.streak?.[me.id] ?? 0;
  const chip = $('streak-chip');
  chip.hidden = mine < 2;
  if (mine >= 2) {
    chip.textContent = `🔥 ${mine} ברצף`;
    if (mine !== lastStreak) {
      // אנימציה מחדש בכל עלייה, אחרת הרצף מרגיש סטטי
      chip.style.animation = 'none';
      void chip.offsetWidth;
      chip.style.animation = '';
    }
  }
  lastStreak = mine;
}

function onAnswer(msg) {
  sounds.play(msg.correct ? 'correct' : 'wrong');
  const flash = $('flash');
  flash.className = `flash ${msg.correct ? 'correct' : 'pass'}`;
  setTimeout(() => { flash.className = 'flash'; }, 620);
  if (msg.playerId === me?.id && msg.correct && navigator.vibrate) {
    navigator.vibrate(msg.streak >= 3 ? [40, 50, 40] : 60);
  }
}

// ------------------------------------------------------------ סיום המשחק

function renderOver() {
  show('over');
  const duelMode = state.mode === 'duel';
  const result = state.lastResult;
  const won = duelMode ? result?.winnerId === me.id : state.winnerId === me.id;

  if (duelMode) {
    const matchWinnerId = state.matchWinnerId || null;
    const matchOver = !!matchWinnerId;
    const matchWon = matchWinnerId === me.id;
    $('over-title').textContent = matchOver
      ? (matchWon ? '🏆 ניצחת במשחק' : 'הפסדת במשחק')
      : (won ? '🏆 לקחת את הסיבוב' : 'הפסדת בסיבוב');
    const surrendered = result?.surrenderedBy
      ? ` · ${result.surrenderedBy === me.id ? 'נכנעת' : `${esc(playerById(result.surrenderedBy)?.name || 'היריב')} נכנע`}`
      : '';
    $('over-sub').innerHTML = result
      ? `${esc(result.categoryName)}${result.decider ? ' (מכריע אקראי)' : ''} · ${result.surrenderedBy ? 'הכרעה בהכנעה' : `השעון של ${esc(playerById(result.loserId)?.name || '')} נגמר`}`
        + (result.missedAnswer && !result.surrenderedBy ? `<br><span class="missed">התשובה הייתה: ${esc(result.missedAnswer)}</span>` : '')
      : '';
    renderSeries();
    renderReward(result);
    // ריאנץ' רק אחרי שהשרת סגר את הסיבוב, ורק כל עוד המשחק לא הוכרע
    $('btn-rematch').hidden = state.phase !== 'finished' || matchOver;
    $('btn-newmatch').hidden = state.phase !== 'finished' || !matchOver;
    const mineReady = state.readiness?.playerIds.includes(me.id);
    const bothConnected = state.players.every(p => p.connected);
    $('ready-note').textContent = !bothConnected ? 'היריב לא מחובר. ממתינים לחזרתו ולאישור משניכם.'
      : mineReady ? 'אישרת מוכנות. ממתינים לאישור היריב.'
      : state.readiness?.playerIds.length ? 'היריב מוכן. אשרו כדי להתחיל ספירה לאחור.'
      : 'נדרש אישור משניכם לפני הסיבוב הבא.';
    $('btn-newmatch').disabled = !!mineReady || !bothConnected;
    $('btn-newmatch').textContent = mineReady ? 'ממתינים לאישור היריב' : 'אני מוכן למשחק חדש מול אותו יריב';
    $('btn-rematch').disabled = !!mineReady || !bothConnected;
    // בסיבוב השני התפקידים מתחלפים; ב-1:1 מחכה סיבוב מכריע בקטגוריה אקראית
    $('btn-rematch').textContent = (state.series?.round || 1) >= 2
      ? 'סיבוב מכריע — קטגוריה אקראית'
      : (result?.challengerId === me.id
        ? 'סיבוב נוסף — הפעם בקטגוריה שלך'
        : `סיבוב נוסף — הפעם בקטגוריה של ${opponent()?.name || 'היריב'}`);
  } else {
    $('over-series').hidden = true;
    $('btn-rematch').hidden = true;
    $('btn-newmatch').hidden = true;
    $('over-title').textContent = state.phase === 'finished'
      ? (won ? '🏆 אלוף הדו־קרב' : 'נגמר המשחק')
      : 'הודחת מהמשחק';
    $('over-sub').textContent = state.phase === 'finished' && !won
      ? `הזוכה: ${playerById(state.winnerId)?.name || '—'}`
      : `${me.tiles} משבצות · ${me.category}`;
  }
  renderMiniBoard($('over-board'));

  const s = playerById(me.id)?.stats;
  if (!s) return;
  const rows = [
    [duelMode ? 'סיבובים' : 'דו־קרבות', s.duels],
    ['ניצחונות', s.duelsWon],
    ['תשובות נכונות', s.correct],
    ['ויתורים', s.passes],
    ['כמעט־פגיעות', s.nearMisses],
    ['רצף הכי ארוך', s.bestStreak],
    ['תשובות מתחת ל-5 שניות על השעון', s.clutch],
    ['זמן תגובה ממוצע', s.correct ? `${(s.totalAnswerMs / s.correct / 1000).toFixed(1)} שניות` : '—'],
    ['התשובה הכי מהירה', s.fastestMs === null ? '—' : `${(s.fastestMs / 1000).toFixed(1)} שניות`],
    ...(duelMode ? [] : [['משבצות שכבשת', s.tilesConquered]]),
  ];
  $('over-stats').innerHTML = rows
    .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
}

/**
 * מקפל את הדו־קרב לפרופיל ומציג את התגמול: ניסיון, רמה, שיאים וגביעים.
 * הקיפול קורה פעם אחת לכל דו־קרב — רינדור חוזר של אותו מסך לא יספור שוב.
 */
function renderReward(result) {
  const box = $('reward');
  if (!result || !result.perPlayer?.[me.id]) { box.hidden = true; return; }
  box.hidden = false;

  const rewardKey = `${account?.id || 'guest'}:${stored.code || state.code}:${me.id}:${result.duelId}`;
  const cachedReward = readRewardCache()[rewardKey];
  if (cachedReward) {
    scoredDuelId = result.duelId;
    box.dataset.render = JSON.stringify(cachedReward);
  }
  if (scoredDuelId !== result.duelId) {
    scoredDuelId = result.duelId;
    const mine = result.perPlayer[me.id];
    const round = {
      won: result.winnerId === me.id,
      correct: mine.correct,
      passes: mine.passes,
      bestStreak: mine.bestStreak,
      fastestMs: mine.fastestMs,
      clockLeftMs: result.clocks[me.id] ?? 0,
      totalMs: mine.totalMs,
      totalAnswers: (result.rounds || []).filter((r) => r.outcome === 'correct').length,
      categoryId: result.categoryId,
    };

    // מוצג מיד מחישוב מקומי, ומתוקן אם השרת מחזיר משהו אחר — כך המסך לא
    // ממתין לרשת, ומשתמש רשום עדיין מקבל את ההכרעה הסמכותית של השרת
    box.dataset.render = JSON.stringify(scoreLocally(round, result));
    cacheReward(rewardKey, JSON.parse(box.dataset.render));
    if (account) scoreOnServer(round, result, box);
  }

  const shown = JSON.parse(box.dataset.render || '{}');
  const p = levelProgress(profile.xp);

  $('xp-gained').textContent = `+${shown.xpGained ?? 0}`;
  $('reward-level').textContent = shown.levelUp ? `⬆ רמה ${p.level}!` : `רמה ${p.level}`;
  $('reward-next').textContent = `${p.into}/${p.need}`;
  // התחלה מאפס כדי שהפס יתמלא מול העיניים ולא יקפוץ
  $('reward-bar').style.width = '0%';
  requestAnimationFrame(() => {
    $('reward-bar').style.width = `${Math.round(p.ratio * 100)}%`;
  });

  $('reward-bests').innerHTML = (shown.bests || [])
    .map((b) => `<div>🏅 שיא אישי — ${esc(b.label)}: ${esc(b.value)}</div>`).join('');

  $('reward-unlocked').innerHTML = (shown.unlocked || []).map((t, i) => `
    <div class="trophy-pop" style="animation-delay:${i * 140 + 200}ms">
      <span class="ico">${t.icon}</span>
      <span><b>גביע חדש — ${esc(t.name)}</b><span>${esc(t.desc)}</span></span>
    </div>`).join('');

  renderTopbar('over');
}

/** קיפול מקומי — המסלול של אורח, וגם התצוגה המיידית לרשומים. */
function scoreLocally(round, result) {
  const bests = personalBests(profile, round);
  const outcome = applyRound(profile, round);
  profile = saveProfile(window.localStorage, outcome.profile);

  if (!account) {
    pushLocalHistory({
      playedAt: new Date().toISOString(),
      opponentName: opponent()?.name || null,
      category: result.categoryName,
      won: round.won,
      correct: round.correct,
      passes: round.passes,
      xpGained: outcome.xpGained,
    });
  }

  return {
    xpGained: outcome.xpGained,
    levelUp: outcome.levelAfter > outcome.levelBefore,
    unlocked: outcome.unlocked.map((t) => ({ icon: t.icon, name: t.name, desc: t.desc })),
    bests,
  };
}

/**
 * השרת הוא הסמכות למשתמש רשום: הוא שומר את הפרופיל, רושם את הדו־קרב
 * בהיסטוריה, ומזין את טבלת השיאים. כישלון רשת לא נוגע במסך — ההתקדמות
 * המקומית כבר מוצגת, והסנכרון יתפוס בדו־קרב הבא.
 */
async function scoreOnServer(round, result, box) {
  try {
    const out = await auth.submitDuel({
      round,
      opponentName: opponent()?.name || null,
      categoryName: result.categoryName,
    });
    profile = out.profile;
    box.dataset.render = JSON.stringify({
      xpGained: out.xpGained,
      levelUp: out.levelUp,
      unlocked: out.unlocked,
      bests: out.bests,
    });
    cacheReward(`${account?.id || 'guest'}:${stored.code || state.code}:${me.id}:${result.duelId}`, JSON.parse(box.dataset.render));
    if (!$('s-over').hidden) renderReward(state.lastResult);
    renderTopbar('over');
  } catch {
    toast('ההתקדמות נשמרה בטלפון — הסנכרון לשרת ייעשה בהמשך');
  }
}

/** תוצאת הסדרה — כמה סיבובים לקח כל אחד עד כה. */
function renderSeries() {
  const rival = opponent();
  if (!rival) return;
  const wins = state.series?.wins || {};
  const mine = wins[me.id] || 0;
  const theirs = wins[rival.id] || 0;

  $('over-series').hidden = false;
  $('over-series').innerHTML = `
    <div class="who ${mine >= theirs ? 'lead' : ''}"><span>${esc(me.name)}</span><span>${mine}</span></div>
    <div class="dash">:</div>
    <div class="who ${theirs >= mine ? 'lead' : ''}"><span>${esc(rival.name)}</span><span>${theirs}</span></div>`;
}

$('btn-rematch').addEventListener('click', (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  net.send({ t: 'rematch', epoch: state.readiness?.epoch });
  setTimeout(() => { button.disabled = false; }, 1500);
});

$('btn-newmatch').addEventListener('click', (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  net.send({ t: 'newmatch', epoch: state.readiness?.epoch });
  setTimeout(() => { button.disabled = false; }, 1500);
});

// ------------------------------------------------------------- לוח ושעון

function renderMiniBoard(el) {
  // בדו־קרב אין לוח — בלי ההסתרה הזו נשאר ריבוע ריק שתופס חצי מסך
  el.hidden = !state.gridSize;
  if (!state.gridSize) { el.innerHTML = ''; return; }
  if (el.childElementCount !== state.tiles.length) {
    el.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
    el.innerHTML = state.tiles.map(() => '<div></div>').join('');
  }
  [...el.children].forEach((cell, i) => {
    const owner = state.tiles[i];
    cell.style.background = owner ? colors.get(owner) : 'var(--panel)';
    cell.classList.toggle('mine', owner === me.id);
  });
}

function tickClocks() {
  requestAnimationFrame(tickClocks);
  if (state?.phase === 'duel_intro') {
    const second = Math.max(1, Math.ceil((deadlineAt - performance.now()) / 1000));
    if(second !== countdownSecond) { sounds.play('tick'); countdownSecond = second; }
    $('intro-countdown').textContent = `מתחילים בעוד ${second}`;
  }
  if (!state?.duel || state.phase !== 'duel') return;
  const elapsed = performance.now() - clock.at;

  for (const el of document.querySelectorAll('[data-clock]')) {
    const id = el.dataset.clock;
    const base = clock.clocks[id] ?? 0;
    const ms = id === clock.activeId ? Math.max(0, base - elapsed) : base;
    if(id === me.id && id === clock.activeId && ms <= 5000 && Math.ceil(ms/1000) !== lowSecond) { lowSecond=Math.ceil(ms/1000); sounds.play('tick'); }
    el.textContent = formatClock(ms);
    el.className = `clock ${ms <= 5000 ? 'critical' : ms <= 15000 ? 'low' : ''}`;
  }

  const lock = Math.max(0, clock.passLockMs - elapsed);
  $('d-lock').hidden = lock <= 0;
  if (lock > 0) $('d-lock-sec').textContent = Math.ceil(lock / 1000);
}
requestAnimationFrame(tickClocks);

// ------------------------------------------------------------------ עזר

// ההפעלה נשמרת ב-localStorage ולא ב-sessionStorage: יציאה בטעות (סגירת
// הלשונית, דפדפן שקרס) לא צריכה לזרוק את השחקן מהדו־קרב — בכניסה הבאה
// הוא יתחבר מחדש לאותו חדר עם אותו מזהה, כל עוד החדר חי.
function readStored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeStored(value) {
  try {
    if (value && value.code) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* מצב פרטי */ }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readRewardCache() {
  try { return JSON.parse(localStorage.getItem('hazira:scored-rounds') || '{}'); } catch { return {}; }
}
function cacheReward(key, reward) {
  try {
    const cache = readRewardCache(); cache[key] = reward;
    localStorage.setItem('hazira:scored-rounds', JSON.stringify(Object.fromEntries(Object.entries(cache).slice(-100))));
  } catch { /* storage unavailable */ }
}
// End of player module.
