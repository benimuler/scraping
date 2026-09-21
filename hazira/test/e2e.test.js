'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');

const { server, content } = require('../server/index');

/**
 * בדיקת קצה־לקצה: שרת אמיתי, שלושה חיבורי WebSocket אמיתיים —
 * מסך גדול ושני "טלפונים" — ודו־קרב שמוכרע על השעון.
 */

let base;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

/** לקוח דק שצובר הודעות ויודע להמתין לתנאי. */
function client(role, opts = {}) {
  const ws = new WebSocket(`ws://${base}/ws`);
  const inbox = [];
  const waiters = [];
  let state = null;
  let playerId = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.t === 'joined') playerId = msg.playerId;
    if (msg.state) state = msg.state;
    inbox.push(msg);
    for (const w of [...waiters]) {
      if (w.test(msg, state)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve({ msg, state });
      }
    }
  });

  const api = {
    ws,
    get state() { return state; },
    get playerId() { return playerId; },
    send: (payload) => ws.send(JSON.stringify(payload)),
    until(test_, timeoutMs = 6000) {
      if (state && test_(inbox[inbox.length - 1] || {}, state)) {
        return Promise.resolve({ msg: inbox[inbox.length - 1], state });
      }
      return new Promise((resolve, reject) => {
        const waiter = { test: test_, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const i = waiters.indexOf(waiter);
          if (i >= 0) { waiters.splice(i, 1); reject(new Error('פג הזמן בהמתנה למצב')); }
        }, timeoutMs).unref();
      });
    },
    close: () => ws.close(),
  };

  ws.on('open', () => api.send({ t: 'hello', role, ...opts }));
  return api;
}

/** התשובה הנכונה לפריט שמוצג — הלקוחות לא מקבלים אותה, הבדיקה שולפת מהתוכן. */
function answerFor(image) {
  for (const category of content.categories.values()) {
    const item = category.items.find((i) => i.image === image);
    if (item) return item.answer;
  }
  throw new Error(`לא נמצאה תשובה לתמונה ${image}`);
}

test('דו־קרב מלא: הצטרפות, אתגור, תשובה בדיבור והכרעה על השעון', async () => {
  const res = await fetch(`http://${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config: { clockMs: 2000, gridSize: 4 } }),
  });
  const { code } = await res.json();
  assert.match(code, /^[A-Z0-9]{4}$/);

  const board = client('board', { code });
  const dana = client('player', { code, name: 'דנה' });
  const yossi = client('player', { code, name: 'יוסי' });

  await board.until((_, s) => s.players.length === 2);
  assert.deepEqual(board.state.players.map((p) => p.name).sort(), ['דנה', 'יוסי']);

  // כל מתמודד מקבל קטגוריה אחרת
  const cats = board.state.players.map((p) => p.categoryId);
  assert.equal(new Set(cats).size, 2);

  board.send({ t: 'start' });
  await board.until((_, s) => s.phase === 'pick');

  const controller = [dana, yossi].find((c) => c.playerId === board.state.controlId);
  const rival = [dana, yossi].find((c) => c.playerId !== board.state.controlId);
  assert.ok(controller && rival);

  // הדו־קרב מתנהל בקטגוריה של המותקף
  const defenderCategory = board.state.players.find((p) => p.id === rival.playerId).categoryId;
  controller.send({ t: 'challenge', defenderId: rival.playerId });
  await board.until((_, s) => s.phase === 'duel' && s.duel?.item);
  assert.equal(
    content.list().find((c) => c.name === board.state.duel.category).id,
    defenderCategory,
  );
  assert.equal(board.state.duel.activeId, controller.playerId);

  // המאתגר אומר את התשובה בקול — השליטה עוברת ליריב
  const spoken = answerFor(board.state.duel.item.image);
  controller.send({ t: 'speech', transcript: `אהh רגע זה ${spoken}`, isFinal: true });
  const { msg } = await board.until((m) => m.t === 'answer' && m.correct);
  assert.equal(msg.answer, spoken);
  assert.equal(msg.playerId, controller.playerId);

  await board.until((_, s) => s.duel?.activeId === rival.playerId);

  // היריב שותק — השעון שלו נגמר, הוא מודח, וכל הלוח עובר למנצח
  await board.until((_, s) => s.phase === 'duel_result', 8000);
  assert.equal(board.state.lastResult.winnerId, controller.playerId);
  assert.equal(board.state.lastResult.loserId, rival.playerId);
  assert.equal(
    board.state.players.find((p) => p.id === controller.playerId).tiles,
    16,
  );

  await board.until((_, s) => s.phase === 'finished', 8000);
  assert.equal(board.state.winnerId, controller.playerId);

  const report = await fetch(`http://${base}/api/rooms/${code}/report`).then((r) => r.json());
  assert.equal(report.duels, 1);
  assert.equal(report.winner, board.state.players.find((p) => p.id === controller.playerId).name);

  for (const c of [board, dana, yossi]) c.close();
});

test('הודעת דיבור ממי שאינו בתורו לא משפיעה', async () => {
  const { code } = await fetch(`http://${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ config: { clockMs: 45000, gridSize: 4 } }),
  }).then((r) => r.json());

  const board = client('board', { code });
  const a = client('player', { code, name: 'א' });
  const b = client('player', { code, name: 'ב' });
  await board.until((_, s) => s.players.length === 2);

  board.send({ t: 'start' });
  await board.until((_, s) => s.phase === 'pick');
  const controller = [a, b].find((c) => c.playerId === board.state.controlId);
  const rival = [a, b].find((c) => c.playerId !== board.state.controlId);

  controller.send({ t: 'challenge', defenderId: rival.playerId });
  await board.until((_, s) => s.phase === 'duel' && s.duel?.item);

  const spoken = answerFor(board.state.duel.item.image);
  rival.send({ t: 'speech', transcript: spoken, isFinal: true });
  await new Promise((r) => setTimeout(r, 300));

  assert.equal(board.state.duel.activeId, controller.playerId, 'התור עבר בלי שהייתה תשובה חוקית');
  assert.equal(board.state.duel.score[rival.playerId], 0);

  for (const c of [board, a, b]) c.close();
});

test('צופה לא יכול לבצע פעולות של מתמודד', async () => {
  const { code } = await fetch(`http://${base}/api/rooms`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  }).then((r) => r.json());

  const board = client('board', { code });
  await board.until((m) => m.t === 'joined');
  board.send({ t: 'pass' });
  const { msg } = await board.until((m) => m.t === 'error');
  assert.match(msg.message, /מתמודד/);
  board.close();
});

test('קוד חדר שגוי נדחה', async () => {
  const ghost = client('board', { code: 'ZZZZ' });
  const { msg } = await ghost.until((m) => m.t === 'error');
  assert.equal(msg.fatal, true);
  ghost.close();
});
