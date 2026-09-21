'use strict';

import { connect, playerColor, formatClock } from './net.js';

const params = new URLSearchParams(location.search);
const code = (params.get('code') || '').toUpperCase();
if (!code) location.replace('/');

const $ = (id) => document.getElementById(id);
const views = {
  lobby: $('view-lobby'),
  pick: $('view-pick'),
  duel_intro: $('view-intro'),
  duel: $('view-duel'),
  duel_result: $('view-result'),
  decision: $('view-decision'),
  finished: $('view-finished'),
};

let state = null;
let colors = new Map();           // playerId -> צבע קבוע לכל המשחק
let currentItemSrc = null;
let clock = { clocks: {}, activeId: null, at: 0, passLockMs: 0 };

// ------------------------------------------------------------------ חיבור

const net = connect({
  role: 'board',
  code,
  on: {
    joined: (msg) => applyState(msg.state),
    state: (msg) => applyState(msg.state),
    clock: (msg) => {
      clock = { clocks: msg.clocks, activeId: msg.activeId, at: performance.now(), passLockMs: msg.passLockMs };
    },
    live: (msg) => renderLive(msg.live, msg.transcript),
    answer: (msg) => onAnswer(msg),
    error: (msg) => {
      if (msg.fatal) document.body.innerHTML = `<div class="wrap center"><h1>${msg.message}</h1></div>`;
    },
  },
});

$('start').addEventListener('click', () => net.send({ t: 'start' }));

// ------------------------------------------------------------------ מצב

function applyState(next) {
  const prevPhase = state?.phase;
  state = next;
  assignColors();
  renderGrid();
  renderLegend();
  showView(state.phase);

  if (state.phase === 'lobby') renderLobby();
  if (state.phase === 'pick') renderPick();
  if (state.phase === 'duel_intro') renderIntro();
  if (state.phase === 'duel') renderDuel(prevPhase !== 'duel');
  if (state.phase === 'duel_result') renderResult();
  if (state.phase === 'decision') renderDecision();
  if (state.phase === 'finished') renderFinished();

  if (state.duel) {
    clock = {
      clocks: state.duel.clocks,
      activeId: state.duel.activeId,
      at: performance.now(),
      passLockMs: state.duel.passLockMs,
    };
  }
}

function assignColors() {
  state.players.forEach((p, i) => {
    if (!colors.has(p.id)) colors.set(p.id, playerColor(i));
  });
}

function showView(phase) {
  for (const [name, el] of Object.entries(views)) el.hidden = name !== phase;
}

const playerById = (id) => state.players.find((p) => p.id === id) || null;

// ------------------------------------------------------------------ הלוח

function renderGrid() {
  const grid = $('grid');
  if (!state.gridSize) { grid.innerHTML = ''; return; }
  if (grid.childElementCount !== state.tiles.length) {
    grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
    grid.innerHTML = state.tiles.map(() => '<div class="tile"></div>').join('');
  }
  const duelists = state.duel ? [state.duel.challengerId, state.duel.defenderId] : [];
  [...grid.children].forEach((tile, i) => {
    const owner = state.tiles[i];
    const color = owner ? colors.get(owner) : null;
    const next = color || 'var(--panel)';
    const first = !tile.style.background;
    if (tile.style.background !== next) {
      tile.style.background = next;
      // הצביעה הראשונה של הלוח אינה כיבוש — רק שינוי בעלות אמיתי מתהפך
      if (owner && !first) {
        tile.classList.add('just-taken');
        setTimeout(() => tile.classList.remove('just-taken'), 600);
      }
    }
    tile.classList.toggle('dueling', duelists.includes(owner));
  });
}

function renderLegend() {
  $('legend').innerHTML = state.players
    .slice()
    .sort((a, b) => b.tiles - a.tiles)
    .map((p) => `
      <li class="${p.alive ? '' : 'out'} ${p.id === state.controlId ? 'control' : ''}">
        <span class="swatch" style="background:${colors.get(p.id)}"></span>
        <span>
          <span class="who">${esc(p.name)}</span>
          ${p.connected ? '' : '<span class="offline"> ניתוק</span>'}
          <br><span class="cat">${esc(p.category)}</span>
        </span>
        <span class="tiles">${p.tiles}</span>
      </li>`)
    .join('');
}

// ------------------------------------------------------------------ לובי

let qrLoaded = false;
function renderLobby() {
  $('code').textContent = code;
  if (!qrLoaded) {
    qrLoaded = true;
    fetch(`/api/rooms/${code}/qr.svg`).then((r) => r.text()).then((svg) => { $('qr').innerHTML = svg; });
    fetch(`/api/rooms/${code}`).then(() => {
      $('join-url').textContent = `${location.host}/player.html?code=${code}`;
    });
  }

  $('roster').innerHTML = state.players.map((p) => `
    <div class="seat" style="--seat-color:${colors.get(p.id)}">
      <b>${esc(p.name)}</b>
      <span>${esc(p.category)}</span>
    </div>`).join('');

  const ready = state.players.length >= 2;
  $('start').disabled = !ready;
  $('lobby-hint').textContent = ready
    ? `${state.players.length} מתמודדים בזירה`
    : 'צריך לפחות שני מתמודדים';
}

// ------------------------------------------------------------ בחירת יריב

function renderPick() {
  const controller = playerById(state.controlId);
  $('pick-title').textContent = controller ? controller.name : '—';
  $('pick-options').innerHTML = (state.options || []).map((o) => `
    <div class="option" style="--opt-color:${colors.get(o.id)}">
      <b>${esc(o.name)}</b>
      <span class="cat">${esc(o.category)}</span>
      <span class="tiles">${o.tiles} משבצות</span>
    </div>`).join('') || '<p class="muted">אין יריבים גובלים</p>';
}

function renderIntro() {
  const a = playerById(state.duel.challengerId);
  const b = playerById(state.duel.defenderId);
  $('intro-versus').innerHTML =
    `<span style="color:${colors.get(a.id)}">${esc(a.name)}</span>` +
    `<span class="vs">נגד</span>` +
    `<span style="color:${colors.get(b.id)}">${esc(b.name)}</span>`;
  $('intro-category').textContent = `${state.duel.category} — הקטגוריה של ${b.name}`;
}

// ---------------------------------------------------------------- דו־קרב

function renderDuel(fresh) {
  const duel = state.duel;
  if (!duel) return;
  $('duel-category').textContent = duel.category;
  renderFighter($('fighter-a'), duel.challengerId, duel, 'מאתגר');
  renderFighter($('fighter-b'), duel.defenderId, duel, 'מותקף');

  const img = $('item-image');
  const caption = $('item-text');
  if (duel.item?.image && duel.item.image !== currentItemSrc) {
    currentItemSrc = duel.item.image;
    img.src = duel.item.image;
    img.hidden = false;
    caption.hidden = true;
  }
  if (duel.item?.text) {
    caption.textContent = duel.item.text;
    caption.hidden = false;
    img.hidden = !duel.item.image;
  }

  if (fresh) renderLive(duel.live, duel.transcript);
  $('listen-who').textContent = `מאזינים ל${playerById(duel.activeId)?.name || '—'}`;
  renderLastTurn(duel.lastTurn);
}

function renderFighter(el, playerId, duel, role) {
  const p = playerById(playerId);
  const active = duel.activeId === playerId;
  el.style.setProperty('--f-color', colors.get(playerId));
  el.classList.toggle('active', active);
  el.innerHTML = `
    <div class="name">${esc(p.name)}</div>
    <div class="meta">${role} · ${p.tiles} משבצות · ${duel.score[playerId]} תשובות</div>
    <div class="clock" data-clock="${playerId}">--.-</div>
    <div class="clock-bar" data-bar="${playerId}"><i></i></div>
    <div class="turn-tag">${active ? 'התור שלו' : ''}</div>`;
}

/** הצגת ההאזנה החיה: מה נשמע, וכמה זה קרוב לתשובה. */
function renderLive(live, transcript) {
  const el = $('transcript');
  el.textContent = transcript?.trim() || '…';
  el.className = `transcript ${live?.verdict === 'correct' ? 'correct' : live?.verdict === 'near' ? 'near' : 'listening'}`;

  const score = live?.score || 0;
  const bar = $('verdict-bar');
  bar.style.width = `${Math.round(score * 100)}%`;
  bar.style.background = live?.verdict === 'correct' ? 'var(--good)'
    : live?.verdict === 'near' ? 'var(--warn)' : 'var(--line)';

  $('verdict-note').textContent = live?.verdict === 'near'
    ? `קרוב — "${live.heard}" (${Math.round(score * 100)}% התאמה)`
    : live?.verdict === 'correct' ? 'נכון!' : '';
}

/**
 * מה קרה בתור הקודם: התשובה הנכונה, ולצידה הניסוח המדויק שהתקבל.
 * הניסוח מוצג תמיד — גם כשהוא זהה לתשובה — כדי ששני השחקנים יראו בדיוק
 * על מה ניתנה הנקודה, ולא יצטרכו לנחש מה המנוע שמע.
 */
function renderLastTurn(turn) {
  const box = $('last-turn');
  if (!turn) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `last-turn ${turn.outcome}`;

  const who = playerById(turn.playerId)?.name || '';
  const said = turn.heard || turn.transcript;

  const lines = [
    `<div class="lt-head">${turn.outcome === 'correct' ? '✓' : '✗'} ${esc(turn.answer)}</div>`,
  ];
  if (turn.outcome === 'correct') {
    lines.push(`<div class="lt-said">${esc(who)} אמר: “${esc(said || turn.answer)}”</div>`);
    // כשההתאמה נעשתה מול מילה נרדפת, ראוי שיהיה ברור מה התקבל ולמה
    if (turn.matched && turn.matched !== turn.answer) {
      lines.push(`<div class="lt-note">התקבל כ“${esc(turn.matched)}”</div>`);
    }
    lines.push(`<div class="lt-note">${(turn.ms / 1000).toFixed(1)} שניות</div>`);
  } else {
    lines.push(`<div class="lt-said">${esc(who)} ויתר${said ? ` · נשמע: “${esc(said)}”` : ''}</div>`);
  }
  box.innerHTML = lines.join('');
}

function onAnswer(msg) {
  const flash = $('flash');
  flash.className = `flash ${msg.correct ? 'correct' : 'pass'}`;
  setTimeout(() => { flash.className = 'flash'; }, 620);
  if (msg.correct) $('transcript').className = 'transcript correct';
}

// שעונים: השרת משדר עשר פעמים בשנייה, והאנימציה משלימה את מה שביניהן
function tickClocks() {
  requestAnimationFrame(tickClocks);
  if (!state?.duel) return;
  const elapsed = performance.now() - clock.at;

  for (const id of [state.duel.challengerId, state.duel.defenderId]) {
    const el = document.querySelector(`[data-clock="${id}"]`);
    const bar = document.querySelector(`[data-bar="${id}"]`);
    if (!el) continue;
    const base = clock.clocks[id] ?? 0;
    const ms = id === clock.activeId ? Math.max(0, base - elapsed) : base;
    el.textContent = formatClock(ms);
    const level = ms <= 5000 ? 'critical' : ms <= 15000 ? 'low' : '';
    el.className = `clock ${level}`;
    if (bar) {
      bar.className = `clock-bar ${level}`;
      bar.firstElementChild.style.width = `${Math.max(0, Math.min(100, (ms / 45000) * 100))}%`;
    }
  }

  const lock = Math.max(0, clock.passLockMs - elapsed);
  const lockEl = $('pass-lock');
  lockEl.hidden = lock <= 0;
  if (lock > 0) $('pass-lock-sec').textContent = Math.ceil(lock / 1000);
}
requestAnimationFrame(tickClocks);

// ------------------------------------------------------------ תוצאה וסיום

function renderResult() {
  const r = state.lastResult;
  if (!r) return;
  const winner = playerById(r.winnerId);
  const loser = playerById(r.loserId);
  $('result-title').innerHTML =
    `<span style="color:${colors.get(r.winnerId)}">${esc(winner.name)}</span> הדיח את ${esc(loser.name)}`;

  const lines = [
    ...(r.missedAnswer ? [`התשובה שנשארה על המסך: ${r.missedAnswer}`] : []),
    `נשארו על השעון: ${formatClock(r.clocks[r.winnerId])} שניות`,
    `${r.rounds.filter((x) => x.outcome === 'correct').length} תשובות נכונות בדו־קרב`,
  ];
  // רק במשחק הלוח עוברת טריטוריה ויורשים קטגוריה
  if (state.mode !== 'duel') {
    lines.unshift(`${r.conquered} משבצות עברו ידיים`);
    if (r.inheritedCategory) lines.push('המותקף ניצח — והקטגוריה של המאתגר עברה אליו');
  } else {
    const wins = state.series?.wins || {};
    lines.push(`הסדרה: ${state.players.map((p) => `${p.name} ${wins[p.id] || 0}`).join(' · ')}`);
  }
  $('result-lines').innerHTML = lines.map((l) => `<div>${esc(l)}</div>`).join('');
}

function renderDecision() {
  $('decision-name').textContent = playerById(state.controlId)?.name || '—';
}

async function renderFinished() {
  $('champion').textContent = playerById(state.winnerId)?.name || '—';
  const report = await fetch(`/api/rooms/${code}/report`).then((r) => r.json());

  const duelMode = report.mode === 'duel';
  $('report').innerHTML = `
    <table>
      <thead><tr>
        <th>מתמודד</th>${duelMode ? '' : '<th>משבצות</th>'}<th>${duelMode ? 'סיבובים' : 'דו־קרבות'}</th><th>ניצחונות</th>
        <th>תשובות</th><th>ויתורים</th><th>דיוק</th><th>זמן תגובה</th><th>רצף</th><th>בלחץ</th>
      </tr></thead>
      <tbody>${report.players.map((p) => `
        <tr>
          <td class="name">${esc(p.name)}</td>
          ${duelMode ? '' : `<td>${p.tiles}</td>`}
          <td>${p.duels}</td>
          <td>${p.duelsWon}</td>
          <td>${p.correct}</td>
          <td>${p.passes}</td>
          <td>${p.accuracy === null ? '—' : Math.round(p.accuracy * 100) + '%'}</td>
          <td>${p.avgAnswerMs === null ? '—' : (p.avgAnswerMs / 1000).toFixed(1) + 'ש׳'}</td>
          <td>${p.bestStreak}</td>
          <td>${p.clutch}</td>
        </tr>`).join('')}</tbody>
    </table>`;

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  $('report-link').href = URL.createObjectURL(blob);
}

// ------------------------------------------------------------------ עזר

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
