'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { ContentLibrary } = require('../server/content');
const { Matchmaker } = require('../server/matchmaking');

const content = new ContentLibrary();

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeDuel(config = {}) {
  const game = new Game({ content, config, rand: seeded() });
  const ids = ['דנה', 'יוסי'].map((name) => game.addPlayer({ name }));
  return { game, ids };
}

function fastForward(game) {
  assert.ok(game._deadline, 'ציפיתי לדדליין ממתין');
  game._deadline.at = Date.now() - 1;
  game._tick();
}

/** מכריע את הסיבוב הנוכחי: playerId מפסיד על השעון, ומקדם עד finished. */
function loseRound(game, loserId) {
  if (game.phase === 'duel_intro') fastForward(game);
  game.duel.activeId = loserId;
  game.duel.clocks[loserId] = 0;
  game._lastTickAt = Date.now();
  game._tick();
  fastForward(game); // duel_result → finished
}

test('ניצחון 2:0 מסיים את המשחק — אין ריאנץ׳, אלא משחק חדש', () => {
  const { game, ids } = makeDuel();
  const [a, b] = ids;
  game.start();
  loseRound(game, b); // 1:0 ל-a
  game.rematch();
  loseRound(game, b); // 2:0

  assert.equal(game.series.wins[a], 2);
  assert.equal(game.matchWinnerId, a);
  assert.equal(game.lastResult.matchOver, true);
  assert.throws(() => game.rematch(), /הוכרע/);

  game.newMatch();
  assert.equal(game.matchWinnerId, null);
  assert.equal(game.series.round, 1);
  assert.deepEqual(game.series.wins, { [a]: 0, [b]: 0 });
  assert.ok(game.duel, 'משחק חדש פותח סיבוב ראשון');
  game.dispose();
});

test('אי אפשר לפתוח משחק חדש לפני שהמשחק הוכרע', () => {
  const { game, ids } = makeDuel();
  const [, b] = ids;
  game.start();
  loseRound(game, b); // רק 1:0
  assert.throws(() => game.newMatch(), /לא הוכרע/);
  game.dispose();
});

test('1:1 מוביל לסיבוב מכריע בקטגוריה אקראית שלא של אף מתמודד', () => {
  const { game, ids } = makeDuel();
  const [a, b] = ids;
  game.start();
  const catA = game.players.get(a).categoryId;
  const catB = game.players.get(b).categoryId;

  loseRound(game, b); // 1:0
  game.rematch();
  assert.equal(game.series.round, 2);
  assert.equal(game.duel.decider, false, 'סיבוב שני רגיל, לא מכריע');
  loseRound(game, a); // 1:1

  game.rematch();
  assert.equal(game.series.round, 3);
  assert.equal(game.duel.decider, true);
  assert.ok(![catA, catB].includes(game.duel.categoryId), 'הקטגוריה המכריעה אקראית ולא של מתמודד');
  game.dispose();
});

test('הכנעה מסיימת את הדו־קרב בניצחון היריב ונרשמת בתוצאה', () => {
  const { game, ids } = makeDuel();
  const [a, b] = ids;
  game.start();
  fastForward(game);

  game.surrender(a);
  assert.equal(game.lastResult.winnerId, b);
  assert.equal(game.lastResult.surrenderedBy, a);
  assert.equal(game.series.wins[b], 1);
  game.dispose();
});

test('אי אפשר להיכנע כשאין דו־קרב פעיל, וצופים לא יכולים להיכנע', () => {
  const { game, ids } = makeDuel();
  assert.throws(() => game.surrender(ids[0]), /אין דו־קרב פעיל/);
  game.start();
  fastForward(game);
  assert.throws(() => game.surrender('random-id'), /משתתפי הדו־קרב/);
  game.dispose();
});

test('משחק מהיר משבץ שני ממתינים לאותו חדר, ומכבד ביטול ופקיעה', () => {
  const created = [];
  const rooms = { create: (config) => { const r = { code: 'WXYZ', config }; created.push(r); return r; } };
  let now = 1_000;
  const mm = new Matchmaker(rooms, () => now);

  const first = mm.join({ name: 'דנה', categoryId: null });
  assert.equal(first.status, 'waiting');
  assert.deepEqual(mm.status(first.ticket), { status: 'waiting' });

  const second = mm.join({ name: 'יוסי', categoryId: null });
  assert.equal(second.status, 'matched');
  assert.equal(second.code, 'WXYZ');
  assert.deepEqual(mm.status(first.ticket), { status: 'matched', code: 'WXYZ' });
  assert.equal(created.length, 1);
  assert.equal(created[0].config.autoStart, true, 'חדר משחק מהיר מתחיל אוטומטית');

  // כרטיס ישן שנשאר בתור פג ולא חוסם שיבוץ חדש
  now += 11 * 60 * 1000;
  const stale = mm.join({ name: 'ישן', categoryId: null });
  assert.equal(stale.status, 'waiting', 'רק הכרטיס החדש בתור — הישנים פגו');
  mm.leave(stale.ticket);
  assert.equal(mm.status(stale.ticket), null);
});

test('קטגוריות התמונות נטענות עם תמונה אמיתית וקרדיט', () => {
  const photoCats = content.list().filter((c) => c.id.startsWith('photo-'));
  assert.ok(photoCats.length >= 15, `ציפיתי להרחבה משמעותית, נמצאו ${photoCats.length}`);

  for (const { id } of photoCats) {
    const cat = content.category(id);
    for (const item of cat.items) {
      assert.ok(item.image?.startsWith('https://'), `${id}: תמונה אמיתית ולא כיתוב — ${item.answer}`);
      assert.ok(item.credit, `${id}: קרדיט חסר — ${item.answer}`);
    }
  }
});
