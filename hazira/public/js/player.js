'use strict';

import { connect, playerColor, formatClock, toast } from './net.js';
import { createListener, speechSupported } from './speech.js';
import {
  TROPHIES, applyRound, loadProfile, saveProfile, levelProgress, personalBests, emptyProfile,
} from './profile.mjs';
import * as auth from './auth.mjs';

const $ = (id) => document.getElementById(id);
const screens = {
  welcome: $('s-welcome'), auth: $('s-auth'), join: $('s-join'),
  wait: $('s-wait'), intro: $('s-intro'), pick: $('s-pick'),
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

const stored = readStored();
$('f-code').value = (new URLSearchParams(location.search).get('code') || stored.code || '').toUpperCase();
$('f-name').value = stored.name || '';

fetch('/api/categories').then((r) => r.json()).then((cats) => {
  $('f-cat').innerHTML = '<option value="">שהזירה תבחר בשבילי</option>' +
    cats.map((c) => `<option value="${c.id}">${c.name} (${c.size} פריטים)</option>`).join('');
});

$('join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = $('f-code').value.trim().toUpperCase();
  const name = $('f-name').value.trim();
  if (!code || !name) return;
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
    case 'lobby': return renderWait();
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
       <button class="btn ghost block" id="btn-logout">יציאה מהחשבון</button>`
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
  const ready = state.players.length >= 2;

  // בדו־קרב מזמינים את היריב מהמסך הזה, ומי שמוכן פותח
  $('invite').hidden = !duelMode || ready;
  $('wait-start').hidden = !(duelMode && ready);
  $('wait-start').disabled = false;
  if (duelMode && !ready) renderInvite();

  $('wait-note').textContent = duelMode
    ? (ready ? `מול ${opponent()?.name} · ${opponentCategory()}` : 'ממתינים ליריב…')
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
  const text = `בוא/י נשחק הזירה — דו־קרב ראש בראש. הקישור שלך: ${url}`;
  const btn = $('invite-share');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'הזירה', text });
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
  net.send({ t: 'start' });
});

function renderIntro() {
  show('intro');
  const duel = state.duel;
  if (!duel) return;
  const iChallenge = duel.challengerId === me.id;
  $('intro-versus').textContent = `${me.name} נגד ${opponent()?.name || 'היריב'}`;
  $('intro-cat').textContent = duel.category;
  $('intro-role').textContent = iChallenge
    ? 'אתה המאתגר — אתה מתחיל, בקטגוריה שלו'
    : 'אתה המותקף — משחקים בקטגוריה שלך';
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
  const [label, title] = labels[state.phase] || ['הזירה', '—'];
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

  $('duel-cat').textContent = duel.category;
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
  const said = turn.heard || turn.transcript;
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
    $('over-title').textContent = won ? '🏆 ניצחת' : 'הפסדת';
    $('over-sub').innerHTML = result
      ? `${esc(result.categoryName)} · השעון של ${esc(playerById(result.loserId)?.name || '')} נגמר`
        + (result.missedAnswer ? `<br><span class="missed">התשובה הייתה: ${esc(result.missedAnswer)}</span>` : '')
      : '';
    renderSeries();
    renderReward(result);
    // ריאנץ' רק אחרי שהשרת סגר את הסיבוב — בחלון התוצאה עוד אי אפשר
    $('btn-rematch').hidden = state.phase !== 'finished';
    // בסיבוב הבא התפקידים מתחלפים, ולכן משחקים בקטגוריה של מי שאתגר עכשיו
    $('btn-rematch').textContent = result?.challengerId === me.id
      ? 'סיבוב נוסף — הפעם בקטגוריה שלך'
      : `סיבוב נוסף — הפעם בקטגוריה של ${opponent()?.name || 'היריב'}`;
  } else {
    $('over-series').hidden = true;
    $('btn-rematch').hidden = true;
    $('over-title').textContent = state.phase === 'finished'
      ? (won ? '🏆 אלוף הזירה' : 'נגמר המשחק')
      : 'הודחת מהזירה';
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
  e.currentTarget.disabled = true;
  net.send({ t: 'rematch' });
  setTimeout(() => { e.currentTarget.disabled = false; }, 1500);
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
  if (!state?.duel) return;
  const elapsed = performance.now() - clock.at;

  for (const el of document.querySelectorAll('[data-clock]')) {
    const id = el.dataset.clock;
    const base = clock.clocks[id] ?? 0;
    const ms = id === clock.activeId ? Math.max(0, base - elapsed) : base;
    el.textContent = formatClock(ms);
    el.className = `clock ${ms <= 5000 ? 'critical' : ms <= 15000 ? 'low' : ''}`;
  }

  const lock = Math.max(0, clock.passLockMs - elapsed);
  $('d-lock').hidden = lock <= 0;
  if (lock > 0) $('d-lock-sec').textContent = Math.ceil(lock / 1000);
}
requestAnimationFrame(tickClocks);

// ------------------------------------------------------------------ עזר

function readStored() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function writeStored(value) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* מצב פרטי */ }
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
