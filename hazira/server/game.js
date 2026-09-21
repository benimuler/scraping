'use strict';

const { randomUUID } = require('crypto');
const { judge } = require('./judge');
const { shuffle } = require('./shuffle');

/**
 * game.js — מכונת המצבים של "הזירה".
 *
 * חוקי הפורמט (The Floor / הזירה בכאן 11):
 *  - כל שחקן ניצב על טריטוריה בלוח ריבועי ומחזיק קטגוריה אחת.
 *  - "הזירה" בוחרת מתמודד אקראי; הוא רואה את הקטגוריות של כל מי שגובל בו
 *    ובוחר יריב אחד לדו-קרב.
 *  - הדו-קרב מתנהל בקטגוריה של המותקף (וזה מה שהופך תקיפה למסוכנת).
 *  - לכל אחד שעון של 45 שניות; רק שעון אחד רץ בכל רגע, והמאתגר מתחיל.
 *  - תשובה נכונה עוצרת את השעון שלך ומעבירה את השליטה ליריב.
 *  - ניחושים ללא הגבלה ובלי עונש; אפשר לוותר על תמונה, אבל השעון ממשיך לרוץ
 *    שלוש שניות עד שמגיעה תמונה חדשה.
 *  - מי שהשעון שלו נגמר ראשון מודח ומוסר את כל הטריטוריה שלו למנצח.
 *  - ניצח המאתגר — הוא שומר על הקטגוריה שלו. ניצח המותקף — הוא יורש את
 *    הקטגוריה של המאתגר.
 *  - המנצח בוחר אם לתקוף שוב מיד, או להחזיר את הבחירה לזירה.
 */

const DEFAULTS = {
  clockMs: 45_000,
  passLockMs: 3_000,
  pickTimeoutMs: 30_000,
  decisionTimeoutMs: 15_000,
  tickMs: 100,
  minGrid: 4,
  maxGrid: 9,
};

const PHASES = {
  LOBBY: 'lobby',
  PICK: 'pick',
  DUEL_INTRO: 'duel_intro',
  DUEL: 'duel',
  DUEL_RESULT: 'duel_result',
  DECISION: 'decision',
  FINISHED: 'finished',
};

class Game {
  /**
   * @param {object} opts
   * @param {import('./content').ContentLibrary} opts.content
   * @param {(event:object)=>void} opts.emit  שידור לכל הלקוחות
   */
  constructor({ content, emit, config = {}, rand = Math.random } = {}) {
    this.content = content;
    this.emit = emit || (() => {});
    this.config = { ...DEFAULTS, ...config };
    this.rand = rand;

    // 'duel' — דו־קרב עצמאי בין שני טלפונים, בלי לוח ובלי כיבוש.
    // 'board' — משחק הכיבוש המלא על לוח המשבצות.
    this.mode = config.mode === 'board' ? 'board' : 'duel';
    this.code = null;
    this.phase = PHASES.LOBBY;
    this.players = new Map();
    this.series = { round: 0, wins: {} };
    this.gridSize = 0;
    this.tiles = [];
    this.controlId = null;
    this.duel = null;
    this.lastResult = null;
    this.winnerId = null;
    this.history = [];
    this._timer = null;
    this._deadline = null;
    this._lastTickAt = null;
  }

  // ---------------------------------------------------------------- שחקנים

  addPlayer({ name, categoryId }) {
    if (this.phase !== PHASES.LOBBY) throw new Error('המשחק כבר התחיל');
    const capacity = this.mode === 'duel' ? 2 : this.config.maxGrid ** 2;
    if (this.players.size >= capacity) {
      throw new Error(this.mode === 'duel' ? 'הדו־קרב מלא — שני מתמודדים' : 'הזירה מלאה');
    }
    const id = randomUUID();
    const taken = new Set([...this.players.values()].map((p) => p.categoryId));
    // המזהה מגיע מהלקוח, ולכן הוא נבדק מול התוכן שנטען בפועל: בלי זה
    // בקשה עם קטגוריה שלא קיימת (לקוח ישן, או קישור שנשמר) מפילה את
    // הדו־קרב ברגע שמנסים לבנות ממנה חפיסה.
    const requested = categoryId && this.content.category(categoryId) && !taken.has(categoryId)
      ? categoryId
      : null;
    const category = requested || this.content.pickCategory(taken, this.rand);
    if (!category) throw new Error('נגמרו הקטגוריות הפנויות');

    this.players.set(id, {
      id,
      name: String(name || 'מתמודד').slice(0, 24).trim() || 'מתמודד',
      categoryId: category,
      alive: true,
      connected: true,
      tiles: new Set(),
      stats: this._emptyStats(),
    });
    this._publish();
    return id;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.phase === PHASES.LOBBY) this.players.delete(id);
    else p.connected = false;
    this._publish();
  }

  setConnected(id, connected) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = connected;
    this._publish();
  }

  _emptyStats() {
    return {
      duels: 0, duelsWon: 0, correct: 0, passes: 0, nearMisses: 0,
      totalAnswerMs: 0, fastestMs: null, bestStreak: 0, clutch: 0,
      tilesConquered: 0, timeLeftMs: null,
    };
  }

  // ------------------------------------------------------------ פתיחת משחק

  start() {
    if (this.phase !== PHASES.LOBBY) throw new Error('המשחק כבר התחיל');
    if (this.players.size < 2) throw new Error('צריך לפחות שני מתמודדים');

    if (this.mode === 'duel') {
      if (this.players.size !== 2) throw new Error('דו־קרב הוא בין שני מתמודדים בדיוק');
      // אין לוח ואין בחירת יריב — מגרילים מי מאתגר, והשני מגן על הקטגוריה שלו
      const [challenger, defender] = shuffle([...this.players.keys()], this.rand);
      this.series.round = 1;
      for (const id of this.players.keys()) this.series.wins[id] = 0;
      this._log({ type: 'game_start', mode: 'duel', players: 2 });
      return this._beginDuel(challenger, defender);
    }

    this.gridSize = this._chooseGridSize(this.players.size);
    this._buildBoard();
    this.phase = PHASES.PICK;
    this.controlId = shuffle([...this.players.keys()], this.rand)[0];
    this._startDeadline(this.config.pickTimeoutMs, () => this._autoPick());
    this._log({ type: 'game_start', gridSize: this.gridSize, players: this.players.size });
    this._publish();
  }

  _chooseGridSize(playerCount) {
    if (this.config.gridSize) return this.config.gridSize;
    const n = Math.ceil(Math.sqrt(playerCount * 4));
    return Math.max(this.config.minGrid, Math.min(this.config.maxGrid, n));
  }

  /** מחלק את הלוח לאזורים רציפים — זרע לכל שחקן, ואז הצפה לסירוגין. */
  _buildBoard() {
    const size = this.gridSize;
    const total = size * size;
    this.tiles = Array.from({ length: total }, (_, i) => ({
      index: i, row: Math.floor(i / size), col: i % size, ownerId: null,
    }));

    const ids = shuffle([...this.players.keys()], this.rand);
    const seeds = this._spreadSeeds(ids.length);
    const frontiers = new Map();
    ids.forEach((id, i) => {
      const tile = this.tiles[seeds[i]];
      tile.ownerId = id;
      this.players.get(id).tiles.add(tile.index);
      frontiers.set(id, [tile.index]);
    });

    let assigned = ids.length;
    while (assigned < total) {
      let progressed = false;
      for (const id of ids) {
        if (assigned >= total) break;
        const frontier = frontiers.get(id);
        let claimed = null;
        while (frontier.length && claimed === null) {
          const from = frontier[0];
          const free = this._neighbors(from).filter((n) => this.tiles[n].ownerId === null);
          if (free.length === 0) { frontier.shift(); continue; }
          claimed = free[Math.floor(this.rand() * free.length)];
        }
        if (claimed === null) continue;
        this.tiles[claimed].ownerId = id;
        this.players.get(id).tiles.add(claimed);
        frontier.push(claimed);
        assigned++;
        progressed = true;
      }
      if (!progressed) {
        // שאריות מבודדות — מצמידים לשכן הקרוב ביותר שכבר תפוס
        for (const tile of this.tiles) {
          if (tile.ownerId !== null) continue;
          const owner = this._neighbors(tile.index)
            .map((n) => this.tiles[n].ownerId).find(Boolean) || ids[0];
          tile.ownerId = owner;
          this.players.get(owner).tiles.add(tile.index);
          assigned++;
        }
      }
    }
  }

  _spreadSeeds(count) {
    const size = this.gridSize;
    const candidates = shuffle(this.tiles.map((t) => t.index), this.rand);
    const seeds = [];
    const dist = (a, b) => Math.abs(Math.floor(a / size) - Math.floor(b / size))
      + Math.abs((a % size) - (b % size));
    for (const c of candidates) {
      if (seeds.length === count) break;
      if (seeds.every((s) => dist(s, c) >= Math.max(1, Math.floor(size / count)))) seeds.push(c);
    }
    for (const c of candidates) {
      if (seeds.length === count) break;
      if (!seeds.includes(c)) seeds.push(c);
    }
    return seeds;
  }

  _neighbors(index) {
    const size = this.gridSize;
    const row = Math.floor(index / size);
    const col = index % size;
    const out = [];
    if (row > 0) out.push(index - size);
    if (row < size - 1) out.push(index + size);
    if (col > 0) out.push(index - 1);
    if (col < size - 1) out.push(index + 1);
    return out;
  }

  /** שחקנים שגובלים בטריטוריה של השחקן הנתון. */
  challengeableBy(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.alive) return [];
    const found = new Set();
    for (const tile of player.tiles) {
      for (const n of this._neighbors(tile)) {
        const owner = this.tiles[n].ownerId;
        if (owner && owner !== playerId && this.players.get(owner).alive) found.add(owner);
      }
    }
    return [...found];
  }

  // ------------------------------------------------------------- בחירת יריב

  challenge(challengerId, defenderId) {
    if (this.phase !== PHASES.PICK) throw new Error('לא שלב הבחירה');
    if (challengerId !== this.controlId) throw new Error('הבחירה לא אצלך');
    if (!this.challengeableBy(challengerId).includes(defenderId)) {
      throw new Error('היריב הזה לא גובל בטריטוריה שלך');
    }
    this._beginDuel(challengerId, defenderId);
  }

  _autoPick() {
    if (this.phase !== PHASES.PICK) return;
    const options = this.challengeableBy(this.controlId);
    if (options.length === 0) return this._finish();
    this._beginDuel(this.controlId, options[Math.floor(this.rand() * options.length)]);
  }

  _beginDuel(challengerId, defenderId) {
    const defender = this.players.get(defenderId);
    const categoryId = defender.categoryId;
    const deck = this.content.deck(categoryId, this.rand);

    this.duel = {
      id: randomUUID(),
      challengerId,
      defenderId,
      categoryId,
      category: this.content.category(categoryId),
      deck,
      cursor: 0,
      item: null,
      clocks: { [challengerId]: this.config.clockMs, [defenderId]: this.config.clockMs },
      activeId: challengerId,
      passLockUntil: 0,
      itemShownAt: 0,
      transcripts: { [challengerId]: '', [defenderId]: '' },
      live: { verdict: 'none', heard: null, score: 0 },
      lastTurn: null,
      rounds: [],
      perPlayer: {
        [challengerId]: { correct: 0, passes: 0, nearMisses: 0, streak: 0, bestStreak: 0, totalMs: 0, fastestMs: null, clutch: 0 },
        [defenderId]: { correct: 0, passes: 0, nearMisses: 0, streak: 0, bestStreak: 0, totalMs: 0, fastestMs: null, clutch: 0 },
      },
    };

    this.players.get(challengerId).stats.duels++;
    defender.stats.duels++;

    this.phase = PHASES.DUEL_INTRO;
    this._log({ type: 'duel_start', challengerId, defenderId, categoryId });
    this._publish();

    this._startDeadline(3_000, () => {
      this.phase = PHASES.DUEL;
      this._nextItem();
      this._lastTickAt = Date.now();
      this._startTicking();
      this._publish();
    });
  }

  _nextItem() {
    const duel = this.duel;
    if (duel.cursor >= duel.deck.length) {
      duel.deck = duel.deck.concat(this.content.deck(duel.categoryId, this.rand));
    }
    duel.item = duel.deck[duel.cursor++];
    duel.itemShownAt = Date.now();
    duel.live = { verdict: 'none', heard: null, score: 0 };
    duel.transcripts[duel.activeId] = '';
  }

  // ------------------------------------------------------- האזנה חיה והכרעה

  /**
   * תמלול חי מהטלפון. רק השחקן שהשליטה אצלו נשמע.
   * @returns {{verdict:string}|null}
   */
  speech(playerId, transcript, isFinal = false) {
    const duel = this.duel;
    if (this.phase !== PHASES.DUEL || !duel) return null;
    if (playerId !== duel.activeId) return null;
    if (Date.now() < duel.passLockUntil) return null;

    duel.transcripts[playerId] = isFinal
      ? `${duel.transcripts[playerId]} ${transcript}`.trim().slice(-300)
      : transcript;

    const result = judge(duel.transcripts[playerId], duel.item);
    duel.live = { verdict: result.verdict, heard: result.heard, score: result.score };

    if (result.verdict === 'correct') {
      this._scoreCorrect(playerId, result);
      return { verdict: 'correct' };
    }
    if (result.verdict === 'near') {
      duel.perPlayer[playerId].nearMisses++;
      this._publish('live');
      return { verdict: 'near' };
    }
    this._publish('live');
    return { verdict: 'none' };
  }

  /** קלט חלופי: תשובה מוקלדת (כשאין מיקרופון או כשהוא נכשל). */
  submitText(playerId, text) {
    return this.speech(playerId, text, true);
  }

  _scoreCorrect(playerId, result) {
    const duel = this.duel;
    this._tick();
    const elapsed = Date.now() - duel.itemShownAt;
    const p = duel.perPlayer[playerId];
    p.correct++;
    p.streak++;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    p.totalMs += elapsed;
    p.fastestMs = p.fastestMs === null ? elapsed : Math.min(p.fastestMs, elapsed);
    if (duel.clocks[playerId] <= 5_000) p.clutch++;

    duel.rounds.push({
      playerId, item: duel.item.answer, ms: elapsed,
      heard: result.heard, score: result.score, outcome: 'correct',
    });

    // מה שהתקבל נשמר במצב ולא רק כאירוע, כך שהוא נשאר על המסך עד התור הבא
    // ומגיע גם למי שהתחבר מחדש באמצע.
    duel.lastTurn = {
      playerId,
      outcome: 'correct',
      answer: duel.item.answer,
      matched: result.matched,
      heard: result.heard,
      transcript: (duel.transcripts[playerId] || '').trim() || null,
      ms: elapsed,
    };

    this.emit({
      type: 'answer',
      playerId,
      correct: true,
      answer: duel.item.answer,
      matched: result.matched,
      heard: result.heard,
      ms: elapsed,
      streak: p.streak,
      clockLeftMs: duel.clocks[playerId],
    });

    // תשובה נכונה עוצרת את השעון ומעבירה שליטה
    duel.activeId = playerId === duel.challengerId ? duel.defenderId : duel.challengerId;
    this._nextItem();
    this._publish();
  }

  /** ויתור על תמונה — השעון ממשיך לרוץ שלוש שניות עד התמונה הבאה. */
  pass(playerId) {
    const duel = this.duel;
    if (this.phase !== PHASES.DUEL || !duel) throw new Error('אין דו-קרב פעיל');
    if (playerId !== duel.activeId) throw new Error('התור לא אצלך');
    if (Date.now() < duel.passLockUntil) return;

    this._tick();
    const p = duel.perPlayer[playerId];
    p.passes++;
    p.streak = 0;
    duel.rounds.push({
      playerId, item: duel.item.answer, ms: Date.now() - duel.itemShownAt,
      heard: duel.transcripts[playerId] || null, score: 0, outcome: 'pass',
    });
    duel.lastTurn = {
      playerId,
      outcome: 'pass',
      answer: duel.item.answer,
      matched: null,
      heard: null,
      transcript: (duel.transcripts[playerId] || '').trim() || null,
      ms: Date.now() - duel.itemShownAt,
    };
    duel.passLockUntil = Date.now() + this.config.passLockMs;
    this.emit({ type: 'answer', playerId, correct: false, answer: duel.item.answer, passed: true });
    this._publish();
  }

  // ----------------------------------------------------------------- שעונים

  _startTicking() {
    this._stopTimer();
    this._timer = setInterval(() => this._tick(), this.config.tickMs);
    if (this._timer.unref) this._timer.unref();
  }

  _tick() {
    const now = Date.now();
    if (this.phase === PHASES.DUEL && this.duel) {
      const delta = now - (this._lastTickAt || now);
      this._lastTickAt = now;
      const active = this.duel.activeId;
      this.duel.clocks[active] = Math.max(0, this.duel.clocks[active] - delta);

      if (this.duel.passLockUntil && now >= this.duel.passLockUntil) {
        this.duel.passLockUntil = 0;
        this._nextItem();
        this._publish();
      }
      if (this.duel.clocks[active] === 0) return this._endDuel(active);
      this._publish('clock');
      return;
    }
    if (this._deadline && now >= this._deadline.at) {
      const fn = this._deadline.fn;
      this._deadline = null;
      fn();
    }
  }

  _startDeadline(ms, fn) {
    this._deadline = { at: Date.now() + ms, fn };
    this._stopTimer();
    this._timer = setInterval(() => this._tick(), this.config.tickMs);
    if (this._timer.unref) this._timer.unref();
  }

  _stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  // ------------------------------------------------------------- סיום דו-קרב

  _endDuel(loserId) {
    const duel = this.duel;
    const winnerId = loserId === duel.challengerId ? duel.defenderId : duel.challengerId;
    // הפריט שהיה על המסך כשהשעון נגמר — נחשף בתוצאה
    duel.missedAnswer = duel.item ? duel.item.answer : null;
    if (this.mode === 'duel') return this._endStandaloneDuel(winnerId, loserId);

    const winner = this.players.get(winnerId);
    const loser = this.players.get(loserId);

    // המנצח בולע את כל הטריטוריה של המודח
    const conquered = loser.tiles.size;
    for (const tile of loser.tiles) {
      this.tiles[tile].ownerId = winnerId;
      winner.tiles.add(tile);
    }
    loser.tiles.clear();
    loser.alive = false;
    loser.stats.timeLeftMs = 0;

    // ניצח המותקף — הוא יורש את הקטגוריה של המאתגר
    let inheritedCategory = null;
    if (winnerId === duel.defenderId) {
      inheritedCategory = this.players.get(duel.challengerId).categoryId;
      winner.categoryId = inheritedCategory;
    }

    this._mergeStats(winnerId);
    this._mergeStats(loserId);
    winner.stats.duelsWon++;
    winner.stats.tilesConquered += conquered;
    winner.stats.timeLeftMs = duel.clocks[winnerId];

    this.lastResult = {
      duelId: duel.id,
      winnerId,
      loserId,
      conquered,
      categoryId: duel.categoryId,
      categoryName: duel.category.name,
      inheritedCategory,
      missedAnswer: duel.missedAnswer,
      lastTurn: duel.lastTurn,
      clocks: { ...duel.clocks },
      perPlayer: duel.perPlayer,
      rounds: duel.rounds,
    };
    this.history.push(this.lastResult);
    this._log({ type: 'duel_end', winnerId, loserId, conquered });

    this.duel = null;
    this.controlId = winnerId;

    const alive = [...this.players.values()].filter((p) => p.alive);
    if (alive.length <= 1) {
      this.phase = PHASES.DUEL_RESULT;
      this._publish();
      return this._startDeadline(4_000, () => this._finish());
    }

    this.phase = PHASES.DUEL_RESULT;
    this._publish();
    this._startDeadline(5_000, () => {
      this.phase = PHASES.DECISION;
      this._publish();
      this._startDeadline(this.config.decisionTimeoutMs, () => this.decide(winnerId, 'attack'));
    });
  }

  /** סיום דו־קרב עצמאי: אין טריטוריה ואין הדחה — רק מי לקח את הסיבוב. */
  _endStandaloneDuel(winnerId, loserId) {
    const duel = this.duel;
    const winner = this.players.get(winnerId);

    this._mergeStats(winnerId);
    this._mergeStats(loserId);
    winner.stats.duelsWon++;
    winner.stats.timeLeftMs = duel.clocks[winnerId];
    this.players.get(loserId).stats.timeLeftMs = 0;
    this.series.wins[winnerId] = (this.series.wins[winnerId] || 0) + 1;

    this.lastResult = {
      duelId: duel.id,
      winnerId,
      loserId,
      challengerId: duel.challengerId,
      defenderId: duel.defenderId,
      conquered: 0,
      round: this.series.round,
      categoryId: duel.categoryId,
      categoryName: duel.category.name,
      inheritedCategory: null,
      missedAnswer: duel.missedAnswer,
      lastTurn: duel.lastTurn,
      clocks: { ...duel.clocks },
      perPlayer: duel.perPlayer,
      rounds: duel.rounds,
    };
    this.history.push(this.lastResult);
    this._log({ type: 'duel_end', winnerId, loserId });

    this.duel = null;
    this.winnerId = winnerId;
    this.controlId = winnerId;
    this.phase = PHASES.DUEL_RESULT;
    this._publish();
    this._startDeadline(4_000, () => {
      this._stopTimer();
      this._deadline = null;
      this.phase = PHASES.FINISHED;
      this._publish();
    });
  }

  /**
   * סיבוב נוסף. התפקידים מתחלפים, כך שהפעם משחקים בקטגוריה של מי שהגן קודם —
   * בלי זה אותה קטגוריה הייתה חוזרת שוב ושוב.
   */
  rematch() {
    if (this.mode !== 'duel') throw new Error('ריאנץ׳ קיים רק בדו־קרב');
    if (this.phase !== PHASES.FINISHED) throw new Error('הדו־קרב עוד לא נגמר');
    const previous = this.history[this.history.length - 1];
    if (!previous) throw new Error('אין דו־קרב קודם');

    this.series.round++;
    this.winnerId = null;
    this.lastResult = null;
    // מי שהגן קודם מאתגר עכשיו — כך הסיבוב הבא מתנהל בקטגוריה השנייה
    this._beginDuel(previous.defenderId, previous.challengerId);
  }

  _mergeStats(playerId) {
    const src = this.duel.perPlayer[playerId];
    const dst = this.players.get(playerId).stats;
    dst.correct += src.correct;
    dst.passes += src.passes;
    dst.nearMisses += src.nearMisses;
    dst.clutch += src.clutch;
    dst.totalAnswerMs += src.totalMs;
    dst.bestStreak = Math.max(dst.bestStreak, src.bestStreak);
    if (src.fastestMs !== null) {
      dst.fastestMs = dst.fastestMs === null ? src.fastestMs : Math.min(dst.fastestMs, src.fastestMs);
    }
  }

  /** המנצח בוחר: לתקוף שוב, או להחזיר את הבחירה לזירה. */
  decide(playerId, choice) {
    if (this.phase !== PHASES.DECISION) throw new Error('לא שלב ההחלטה');
    if (playerId !== this.controlId) throw new Error('ההחלטה לא אצלך');

    if (choice === 'yield') {
      const alive = [...this.players.values()].filter((p) => p.alive && this.challengeableBy(p.id).length);
      const pool = alive.length ? alive : [...this.players.values()].filter((p) => p.alive);
      this.controlId = shuffle(pool, this.rand)[0].id;
    }
    if (this.challengeableBy(this.controlId).length === 0) return this._finish();

    this.phase = PHASES.PICK;
    this._startDeadline(this.config.pickTimeoutMs, () => this._autoPick());
    this._publish();
  }

  _finish() {
    this._stopTimer();
    this._deadline = null;
    const alive = [...this.players.values()].filter((p) => p.alive);
    this.winnerId = alive.length ? alive.sort((a, b) => b.tiles.size - a.tiles.size)[0].id : null;
    this.phase = PHASES.FINISHED;
    this._log({ type: 'game_end', winnerId: this.winnerId });
    this._publish();
  }

  // ------------------------------------------------------------ דוח וניתוח

  /** דוח סיכום — נשען על הסטטיסטיקות שנאספו בכל דו-קרב. */
  report() {
    const players = [...this.players.values()].map((p) => {
      const answers = p.stats.correct || 1;
      return {
        name: p.name,
        categoryId: p.categoryId,
        category: this.content.category(p.categoryId)?.name || p.categoryId,
        alive: p.alive,
        tiles: p.tiles.size,
        ...p.stats,
        avgAnswerMs: p.stats.correct ? Math.round(p.stats.totalAnswerMs / answers) : null,
        accuracy: p.stats.correct + p.stats.passes
          ? Number((p.stats.correct / (p.stats.correct + p.stats.passes)).toFixed(3))
          : null,
      };
    }).sort((a, b) => b.tiles - a.tiles || b.duelsWon - a.duelsWon);

    return {
      finishedAt: new Date().toISOString(),
      mode: this.mode,
      gridSize: this.gridSize || undefined,
      rounds: this.mode === 'duel' ? this.series.round : undefined,
      winner: this.winnerId ? this.players.get(this.winnerId).name : null,
      duels: this.history.length,
      players,
      timeline: this.history.map((h) => ({
        round: h.round,
        winner: this.players.get(h.winnerId)?.name,
        loser: this.players.get(h.loserId)?.name,
        category: h.categoryName,
        conquered: h.conquered || undefined,
        clockLeftMs: h.clocks[h.winnerId],
        rounds: h.rounds.length,
      })),
      log: this.history.length ? this.log : undefined,
    };
  }

  _log(entry) {
    this.log = this.log || [];
    this.log.push({ at: Date.now(), ...entry });
  }

  // ------------------------------------------------------------------ שידור

  /**
   * מצב ציבורי ללוח הגדול. `forPlayerId` מוסיף את מה שרק אותו שחקן רואה.
   */
  snapshot(forPlayerId = null) {
    const duel = this.duel;
    const state = {
      phase: this.phase,
      mode: this.mode,
      series: this.series,
      code: this.code,
      gridSize: this.gridSize,
      tiles: this.tiles.map((t) => t.ownerId),
      controlId: this.controlId,
      winnerId: this.winnerId,
      deadlineInMs: this._deadline ? Math.max(0, this._deadline.at - Date.now()) : null,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        alive: p.alive,
        connected: p.connected,
        tiles: p.tiles.size,
        categoryId: p.categoryId,
        category: this.content.category(p.categoryId)?.name || p.categoryId,
        stats: p.stats,
      })),
      lastResult: this.lastResult,
    };

    if (this.phase === PHASES.PICK && this.controlId) {
      state.options = this.challengeableBy(this.controlId).map((id) => {
        const p = this.players.get(id);
        return { id, name: p.name, category: this.content.category(p.categoryId)?.name, tiles: p.tiles.size };
      });
    }

    if (duel) {
      state.duel = {
        id: duel.id,
        challengerId: duel.challengerId,
        defenderId: duel.defenderId,
        category: duel.category.name,
        categoryHint: duel.category.hint || null,
        activeId: duel.activeId,
        clocks: duel.clocks,
        passLockMs: Math.max(0, duel.passLockUntil - Date.now()),
        live: duel.live,
        lastTurn: duel.lastTurn,
        transcript: duel.transcripts[duel.activeId] || '',
        item: duel.item ? { image: duel.item.image, text: duel.item.text || null } : null,
        score: {
          [duel.challengerId]: duel.perPlayer[duel.challengerId].correct,
          [duel.defenderId]: duel.perPlayer[duel.defenderId].correct,
        },
        streak: {
          [duel.challengerId]: duel.perPlayer[duel.challengerId].streak,
          [duel.defenderId]: duel.perPlayer[duel.defenderId].streak,
        },
      };
    }

    if (forPlayerId && this.players.has(forPlayerId)) {
      const me = this.players.get(forPlayerId);
      state.me = {
        id: me.id,
        name: me.name,
        alive: me.alive,
        tiles: me.tiles.size,
        category: this.content.category(me.categoryId)?.name,
        isMyTurn: duel ? duel.activeId === forPlayerId : this.controlId === forPlayerId,
        inDuel: !!duel && (duel.challengerId === forPlayerId || duel.defenderId === forPlayerId),
      };
    }
    return state;
  }

  _publish(kind = 'state') {
    this.emit({ type: 'state', kind });
  }

  dispose() {
    this._stopTimer();
  }
}

Game.PHASES = PHASES;
Game.DEFAULTS = DEFAULTS;
module.exports = { Game, PHASES };
