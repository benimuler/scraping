'use strict';

/**
 * חיבור WebSocket עמיד: מתחבר מחדש אחרי ניתוק (מסך שננעל בטלפון הוא המקרה
 * הנפוץ), ומריץ handler לכל סוג הודעה.
 */
export function connect({ role, code, name, categoryId, playerId, on }) {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let ws = null;
  let closed = false;
  let backoff = 500;
  let currentPlayerId = playerId || null;

  const api = {
    send(payload) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(payload));
    },
    close() {
      closed = true;
      if (ws) ws.close();
    },
    get playerId() { return currentPlayerId; },
    get ready() { return !!ws && ws.readyState === 1; },
  };

  function open() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      backoff = 500;
      ws.send(JSON.stringify({ t: 'hello', role, code, name, categoryId, playerId: currentPlayerId }));
      on.status?.('connected');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.t === 'joined' && msg.playerId) currentPlayerId = msg.playerId;
      if (msg.t === 'error' && msg.fatal) closed = true;
      on[msg.t]?.(msg);
    };

    ws.onclose = () => {
      on.status?.('disconnected');
      if (closed) return;
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 8000);
    };

    ws.onerror = () => ws.close();
  }

  open();
  return api;
}

/** צבע קבוע למתמודד לפי מיקומו ברשימה. */
export function playerColor(index) {
  return `var(--p${index % 8})`;
}

export function formatClock(ms) {
  const total = Math.max(0, ms) / 1000;
  return total >= 10 ? total.toFixed(1) : total.toFixed(2);
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
