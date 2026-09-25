'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('../server/game');
const { ContentLibrary } = require('../server/content');

const content = new ContentLibrary();

/** מקור אקראיות דטרמיניסטי, כדי שהבדיקות יהיו יציבות. */
function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** בדיקות הקובץ הזה עוסקות במשחק הלוח, ולכן מבקשות אותו במפורש. */
function makeGame(names = ['דנה', 'יוסי'], config = {}) {
  const game = new Game({ content, config: { mode: 'board', gridSize: 4, ...config }, rand: seeded() });
  const ids = names.map((name) => game.addPlayer({ name }));
  return { game, ids };
}

/** מדלג קדימה על דדליין ממתין (פתיח דו־קרב, תוצאה, החלטה). */
function fastForward(game) {
  assert.ok(game._deadline, 'ציפיתי לדדליין ממתין');
  game._deadline.at = Date.now() - 1;
  game._tick();
}

function enterDuel(game, ids) {
  game.start();
  const challenger = game.controlId;
  const defender = game.challengeableBy(challenger)[0];
  game.challenge(challenger, defender);
  fastForward(game);
  return { challenger, defender };
}

test.afterEach(() => { /* הטיימרים ב-unref, לא מחזיקים את התהליך */ });

test('כל משבצת מוקצית, והטריטוריה של כל שחקן רציפה', () => {
  const { game, ids } = makeGame(['א', 'ב', 'ג']);
  game.start();

  assert.equal(game.tiles.length, 16);
  assert.ok(game.tiles.every((t) => t.ownerId !== null), 'נשארה משבצת בלי בעלים');
  assert.equal([...game.players.values()].reduce((s, p) => s + p.tiles.size, 0), 16);

  for (const id of ids) {
    const owned = [...game.players.get(id).tiles];
    const seen = new Set([owned[0]]);
    const queue = [owned[0]];
    while (queue.length) {
      for (const n of game._neighbors(queue.pop())) {
        if (game.tiles[n].ownerId === id && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    assert.equal(seen.size, owned.length, `הטריטוריה של ${id} מפוצלת`);
  }
  game.dispose();
});

test('אפשר לאתגר רק יריב גובל', () => {
  const { game } = makeGame(['א', 'ב', 'ג', 'ד']);
  game.start();
  const options = game.challengeableBy(game.controlId);
  assert.ok(options.length >= 1);
  for (const id of options) assert.notEqual(id, game.controlId);
  game.dispose();
});

test('הדו־קרב מתנהל בקטגוריה של המותקף, והמאתגר מתחיל', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  assert.equal(game.phase, 'duel');
  assert.equal(game.duel.categoryId, game.players.get(defender).categoryId);
  assert.equal(game.duel.activeId, challenger);
  assert.equal(game.duel.clocks[challenger], 45_000);
  game.dispose();
});

test('תשובה נכונה עוצרת את השעון ומעבירה שליטה', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  const before = game.duel.clocks[challenger];
  const result = game.speech(challenger, game.duel.item.answer, true);

  assert.equal(result.verdict, 'correct');
  assert.equal(game.duel.activeId, defender);
  assert.ok(game.duel.clocks[challenger] <= before);
  assert.equal(game.duel.perPlayer[challenger].correct, 1);
  game.dispose();
});

test('רק מי שהתור שלו נשמע', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  assert.equal(game.speech(defender, game.duel.item.answer, true), null);
  assert.equal(game.duel.activeId, challenger, 'התור עבר בלי שהייתה תשובה');
  game.dispose();
});

test('ויתור נועל את התמונה לשלוש שניות ולא מעביר תור', () => {
  const { game, ids } = makeGame();
  const { challenger } = enterDuel(game, ids);

  game.pass(challenger);
  assert.equal(game.duel.activeId, challenger, 'ויתור לא אמור להעביר תור');
  assert.ok(game.duel.passLockUntil > Date.now());
  assert.equal(game.duel.perPlayer[challenger].passes, 1);
  game.dispose();
});

test('שעון שנגמר מדיח, והטריטוריה כולה עוברת למנצח', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  const defenderTiles = game.players.get(defender).tiles.size;
  const challengerTiles = game.players.get(challenger).tiles.size;

  game.duel.clocks[challenger] = 0;
  game._lastTickAt = Date.now();
  game._tick();

  assert.equal(game.players.get(challenger).alive, false);
  assert.equal(game.players.get(challenger).tiles.size, 0);
  assert.equal(game.players.get(defender).tiles.size, defenderTiles + challengerTiles);
  assert.equal(game.lastResult.winnerId, defender);
  assert.equal(game.lastResult.conquered, challengerTiles);
  game.dispose();
});

test('ניצח המותקף — הוא יורש את הקטגוריה של המאתגר', () => {
  const { game, ids } = makeGame(['א', 'ב', 'ג']);
  const { challenger, defender } = enterDuel(game, ids);
  const challengerCategory = game.players.get(challenger).categoryId;

  game.duel.clocks[challenger] = 0;
  game._lastTickAt = Date.now();
  game._tick();

  assert.equal(game.players.get(defender).categoryId, challengerCategory);
  assert.equal(game.lastResult.inheritedCategory, challengerCategory);
  game.dispose();
});

test('ניצח המאתגר — הוא שומר על הקטגוריה שלו', () => {
  const { game, ids } = makeGame(['א', 'ב', 'ג']);
  const { challenger, defender } = enterDuel(game, ids);
  const challengerCategory = game.players.get(challenger).categoryId;

  game.duel.clocks[defender] = 0;
  game.duel.activeId = defender;
  game._lastTickAt = Date.now();
  game._tick();

  assert.equal(game.players.get(challenger).categoryId, challengerCategory);
  assert.equal(game.lastResult.inheritedCategory, null);
  game.dispose();
});

test('כשנשאר מתמודד אחד — המשחק נגמר והוא האלוף', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  game.duel.clocks[challenger] = 0;
  game._lastTickAt = Date.now();
  game._tick();
  fastForward(game); // חלון התוצאה

  assert.equal(game.phase, 'finished');
  assert.equal(game.winnerId, defender);
  assert.equal(game.players.get(defender).tiles.size, 16);
  game.dispose();
});

test('המנצח מחליט: להחזיר את הבחירה לזירה', () => {
  const { game, ids } = makeGame(['א', 'ב', 'ג', 'ד']);
  const { challenger, defender } = enterDuel(game, ids);

  game.duel.clocks[challenger] = 0;
  game._lastTickAt = Date.now();
  game._tick();
  fastForward(game); // תוצאה -> החלטה
  assert.equal(game.phase, 'decision');

  game.decide(defender, 'attack');
  assert.equal(game.phase, 'pick');
  assert.equal(game.controlId, defender);
  game.dispose();
});

test('דוח הסיכום מסכם את מה שקרה בפועל', () => {
  const { game, ids } = makeGame();
  const { challenger, defender } = enterDuel(game, ids);

  game.speech(challenger, game.duel.item.answer, true);
  game.duel.clocks[defender] = 0;
  game.duel.activeId = defender;
  game._lastTickAt = Date.now();
  game._tick();
  fastForward(game);

  const report = game.report();
  assert.equal(report.duels, 1);
  assert.equal(report.winner, game.players.get(challenger).name);
  assert.equal(report.timeline.length, 1);
  const winnerRow = report.players.find((p) => p.name === game.players.get(challenger).name);
  assert.equal(winnerRow.correct, 1);
  assert.equal(winnerRow.duelsWon, 1);
  game.dispose();
});

test('לא מתחילים משחק עם מתמודד אחד', () => {
  const game = new Game({ content, config: { mode: 'board' }, rand: seeded() });
  game.addPlayer({ name: 'לבד' });
  assert.throws(() => game.start(), /שני מתמודדים/);
  game.dispose();
});

test('שני מתמודדים לא מקבלים את אותה קטגוריה', () => {
  const { game } = makeGame(['א', 'ב', 'ג', 'ד', 'ה']);
  const cats = [...game.players.values()].map((p) => p.categoryId);
  assert.equal(new Set(cats).size, cats.length);
  game.dispose();
});
