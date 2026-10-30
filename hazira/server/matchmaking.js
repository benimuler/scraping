'use strict';

const { randomUUID } = require('crypto');

const TICKET_TTL_MS = 10 * 60 * 1000;

/**
 * תור משחק מהיר: מי שמחפש יריב אקראי מקבל כרטיס, וכשיש שניים בתור
 * נפתח להם חדר דו־קרב רגיל שמתחיל לבד כששניהם בפנים.
 *
 * בלי שחקנים מדומים: מי שמחכה לבד בתור פשוט מחכה ליריב אמיתי,
 * והלקוח אומר את זה במפורש.
 */
class Matchmaker {
  constructor(rooms, now = () => Date.now()) {
    this.rooms = rooms;
    this.now = now;
    this.tickets = new Map();
  }

  /** מצטרף לתור. אם מישהו כבר מחכה — משבץ את שניהם לחדר חדש. */
  join({ name, categoryId = null }) {
    this.sweep();
    for (const waiting of this.tickets.values()) {
      if (waiting.code) continue; // כבר שובץ לחדר, ממתין שהלקוח יתחבר
      const room = this.rooms.create({ mode: 'duel', autoStart: true, quick: true });
      waiting.code = room.code;
      const ticket = randomUUID();
      this.tickets.set(ticket, { name, categoryId, code: room.code, createdAt: this.now() });
      return { ticket, status: 'matched', code: room.code };
    }
    const ticket = randomUUID();
    this.tickets.set(ticket, { name, categoryId, code: null, createdAt: this.now() });
    return { ticket, status: 'waiting' };
  }

  status(ticket) {
    this.sweep();
    const entry = this.tickets.get(ticket);
    if (!entry) return null;
    return entry.code ? { status: 'matched', code: entry.code } : { status: 'waiting' };
  }

  leave(ticket) {
    this.tickets.delete(ticket);
  }

  /** מנקה כרטיסים ישנים — טלפון שנסגר באמצע ההמתנה לא יתפוס מקום לנצח. */
  sweep() {
    const cutoff = this.now() - TICKET_TTL_MS;
    for (const [ticket, entry] of this.tickets) {
      if (entry.createdAt < cutoff) this.tickets.delete(ticket);
    }
  }
}

module.exports = { Matchmaker, TICKET_TTL_MS };
