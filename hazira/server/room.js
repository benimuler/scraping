'use strict';

const { Game } = require('./game');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // בלי תווים שמתבלבלים
const CODE_LENGTH = 4;

/** חדר משחק אחד: מצב + כל החיבורים הפתוחים אליו. */
class Room {
  constructor(code, content, config) {
    this.code = code;
    this.createdAt = Date.now();
    this.sockets = new Set();
    this.game = new Game({
      content,
      config,
      emit: (event) => this.dispatch(event),
    });
    this.game.code = code;
  }

  attach(ws) {
    this.sockets.add(ws);
  }

  detach(ws) {
    this.sockets.delete(ws);
    if (ws.playerId) this.game.setConnected(ws.playerId, false);
  }

  send(ws, payload) {
    if (ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* חיבור שנסגר באמצע — מתעלמים */
    }
  }

  /**
   * שידור לכל החיבורים. עדכוני שעון וזיהוי-דיבור נשלחים כמסרים קלים,
   * כדי לא לדחוף תמונת מצב מלאה עשר פעמים בשנייה.
   */
  dispatch(event) {
    if (event.type === 'answer') {
      for (const ws of this.sockets) this.send(ws, { t: 'answer', ...event });
      return;
    }
    const duel = this.game.duel;
    if (event.kind === 'clock' && duel) {
      const light = {
        t: 'clock',
        activeId: duel.activeId,
        clocks: duel.clocks,
        passLockMs: Math.max(0, duel.passLockUntil - Date.now()),
      };
      for (const ws of this.sockets) this.send(ws, light);
      return;
    }
    if (event.kind === 'live' && duel) {
      const light = {
        t: 'live',
        activeId: duel.activeId,
        live: duel.live,
        transcript: duel.transcripts[duel.activeId] || '',
      };
      for (const ws of this.sockets) this.send(ws, light);
      return;
    }
    this.broadcastState();
  }

  broadcastState() {
    for (const ws of this.sockets) {
      this.send(ws, { t: 'state', state: this.game.snapshot(ws.playerId) });
    }
  }

  get empty() {
    return this.sockets.size === 0;
  }

  dispose() {
    this.game.dispose();
    for (const ws of this.sockets) {
      try { ws.close(); } catch { /* כבר סגור */ }
    }
    this.sockets.clear();
  }
}

class RoomRegistry {
  constructor(content, config = {}) {
    this.content = content;
    this.config = config;
    this.rooms = new Map();
  }

  newCode() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = Array.from({ length: CODE_LENGTH }, () =>
        CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('לא הצלחתי לייצר קוד חדר פנוי');
  }

  create(config = {}) {
    const code = this.newCode();
    const room = new Room(code, this.content, { ...this.config, ...config });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(String(code || '').toUpperCase()) || null;
  }

  /** מנקה חדרים ריקים וישנים, כדי שהשרת לא יצבור מצב לנצח. */
  sweep(maxIdleMs = 6 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.empty && now - room.createdAt > maxIdleMs) {
        room.dispose();
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { Room, RoomRegistry, CODE_ALPHABET, CODE_LENGTH };
