'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { ContentLibrary } = require('../server/content');

const content = new ContentLibrary();

function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** דו־קרב עצמאי הוא ברירת המחדל — אין צורך לבקש אותו. */
function makeDuel(names = ['דנה', 'יוסי'], config = {}) {
  const game = new Game({ content, config, rand: seeded() });
  const ids = names.map((name) => game.addPlayer({ name }));
  return { game, ids };
}

function fastForward(game) {
  assert.ok(game._deadline, 'ציפיתי לדדליין ממתין');
  game._deadline.at = Date.now() - 1;
  game._tick();
}

/** מריץ את השעון של הפעיל עד אפס, ומחזיר את מי שהודח. */
function runOutClock(game, playerId) {
  game.duel.activeId = playerId;
  game.duel.clocks[playerId] = 0;
  game._lastTickAt = Date.now();
  game._tick();
}

test('שני מתמודדים יורדים ישר לזירה, בלי לוח ובלי בחירת יריב', () => {
  const { game } = makeDuel();
  game.start();

  assert.equal(game.mode, 'duel');
  assert.equal(game.phase, 'duel_intro');
  assert.equal(game.tiles.length, 0, 'בדו־קרב אין לוח');
  assert.equal(game.gridSize, 0);
  assert.equal(game.series.round, 1);
  assert.ok(game.duel, 'הדו־קרב היה אמור להתחיל מיד');
  game.dispose();
});

test('מתמודד שלישי נדחה', () => {
  const { game } = makeDuel();
  assert.throws(() => game.addPlayer({ name: 'שלישי' }), /שני מתמודדים/);
  game.dispose();
});

test('גם כאן הדו־קרב מתנהל בקטגוריה של המותקף, והמאתגר מתחיל', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);

  const { challengerId, defenderId } = game.duel;
  assert.equal(game.phase, 'duel');
  assert.equal(game.duel.categoryId, game.players.get(defenderId).categoryId);
  assert.equal(game.duel.activeId, challengerId);
  assert.equal(game.duel.clocks[challengerId], 45_000);
  assert.equal(game.duel.clocks[defenderId], 45_000);
  game.dispose();
});

test('תשובה נכונה מעבירה תור — בדיוק כמו במשחק הלוח', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);

  const { challengerId, defenderId } = game.duel;
  const result = game.speech(challengerId, game.duel.item.answer, true);

  assert.equal(result.verdict, 'correct');
  assert.equal(game.duel.activeId, defenderId);
  game.dispose();
});

test('שעון שנגמר מכריע את הדו־קרב, בלי טריטוריה ובלי הדחה', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  const { challengerId, defenderId } = game.duel;

  runOutClock(game, challengerId);

  assert.equal(game.phase, 'duel_result');
  assert.equal(game.lastResult.winnerId, defenderId);
  assert.equal(game.lastResult.conquered, 0);
  assert.equal(game.lastResult.inheritedCategory, null);
  // שני המתמודדים נשארים — סיבוב שהפסדת אינו הדחה
  assert.ok(game.players.get(challengerId).alive);
  assert.ok(game.players.get(defenderId).alive);
  game.dispose();
});

test('אחרי חלון התוצאה הדו־קרב נגמר ויש מנצח', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  const { challengerId, defenderId } = game.duel;

  runOutClock(game, challengerId);
  fastForward(game);

  assert.equal(game.phase, 'finished');
  assert.equal(game.winnerId, defenderId);
  assert.equal(game.series.wins[defenderId], 1);
  assert.equal(game.series.wins[challengerId], 0);
  game.dispose();
});

test('ריאנץ׳ מחליף תפקידים, כדי שתשוחק הקטגוריה השנייה', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  const first = { challenger: game.duel.challengerId, defender: game.duel.defenderId };
  const firstCategory = game.duel.categoryId;

  runOutClock(game, first.challenger);
  fastForward(game);
  game.rematch();

  assert.equal(game.phase, 'duel_intro');
  assert.equal(game.series.round, 2);
  assert.equal(game.winnerId, null);
  assert.equal(game.duel.challengerId, first.defender, 'מי שהגן קודם מאתגר עכשיו');
  assert.equal(game.duel.defenderId, first.challenger);
  assert.equal(game.duel.categoryId, game.players.get(first.challenger).categoryId);
  assert.notEqual(game.duel.categoryId, firstCategory);
  game.dispose();
});

test('ניצחונות נצברים לאורך הסדרה', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  const a = game.duel.challengerId;
  const b = game.duel.defenderId;

  runOutClock(game, a);        // b לוקח סיבוב ראשון
  fastForward(game);
  game.rematch();
  fastForward(game);
  // אחרי הריאנץ' b הוא המאתגר — כדי ש-a ייקח את הסיבוב, השעון של b נגמר
  runOutClock(game, game.duel.challengerId);
  fastForward(game);

  assert.equal(game.series.round, 2);
  assert.equal(game.series.wins[a], 1);
  assert.equal(game.series.wins[b], 1);
  assert.equal(game.history.length, 2);
  game.dispose();
});

test('אי אפשר לבקש ריאנץ׳ באמצע דו־קרב', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  assert.throws(() => game.rematch(), /עוד לא נגמר/);
  game.dispose();
});

test('הדוח של דו־קרב מסכם סיבובים ולא משבצות', () => {
  const { game } = makeDuel();
  game.start();
  fastForward(game);
  const { challengerId, defenderId } = game.duel;

  game.speech(challengerId, game.duel.item.answer, true);
  runOutClock(game, defenderId);
  fastForward(game);

  const report = game.report();
  assert.equal(report.mode, 'duel');
  assert.equal(report.rounds, 1);
  assert.equal(report.gridSize, undefined);
  assert.equal(report.winner, game.players.get(challengerId).name);
  assert.equal(report.timeline[0].conquered, undefined);
  assert.equal(report.timeline[0].round, 1);

  const winnerRow = report.players.find((p) => p.name === game.players.get(challengerId).name);
  assert.equal(winnerRow.correct, 1);
  assert.equal(winnerRow.duelsWon, 1);
  game.dispose();
});
