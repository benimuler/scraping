'use strict';

import { connect, playerColor, formatClock, toast } from './net.js';
import { createListener, speechSupported } from './speech.js';

const $ = (id) => document.getElementById(id);
const screens = {
  join: $('s-join'), wait: $('s-wait'), intro: $('s-intro'), pick: $('s-pick'),
  watch: $('s-watch'), duel: $('s-duel'), decide: $('s-decide'), over: $('s-over'),
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

// חיבור חוזר אוטומטי אחרי רענון או נעילת מסך
if (stored.code && stored.playerId && stored.name) {
  join({ code: stored.code, name: stored.name, playerId: stored.playerId });
} else {
  show('join');
}

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
function renderInvite() {
  $('invite-code').textContent = state.code || '····';
  if (inviteDrawn || !state.code) return;
  inviteDrawn = true;
  fetch(`/api/rooms/${state.code}/qr.svg`)
    .then((r) => r.text())
    .then((svg) => { $('invite-qr').innerHTML = svg; })
    .catch(() => { inviteDrawn = false; });
}

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

function onAnswer(msg) {
  const flash = $('flash');
  flash.className = `flash ${msg.correct ? 'correct' : 'pass'}`;
  setTimeout(() => { flash.className = 'flash'; }, 620);
  if (msg.playerId === me?.id && msg.correct && navigator.vibrate) navigator.vibrate(60);
}

// ------------------------------------------------------------ סיום המשחק

function renderOver() {
  show('over');
  const duelMode = state.mode === 'duel';
  const result = state.lastResult;
  const won = duelMode ? result?.winnerId === me.id : state.winnerId === me.id;

  if (duelMode) {
    $('over-title').textContent = won ? '🏆 ניצחת' : 'הפסדת';
    $('over-sub').textContent = result
      ? `${result.categoryName} · השעון של ${playerById(result.loserId)?.name} נגמר`
      : '';
    renderSeries();
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
