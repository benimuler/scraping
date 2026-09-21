'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const { ContentLibrary } = require('./content');
const { RoomRegistry } = require('./room');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MEDIA_DIR = path.join(__dirname, '..', 'content', 'media');
const CERT_DIR = path.join(__dirname, '..', 'certs');

const content = new ContentLibrary();
const rooms = new RoomRegistry(content, {
  clockMs: Number(process.env.CLOCK_MS || 45_000),
  passLockMs: Number(process.env.PASS_LOCK_MS || 3_000),
});
setInterval(() => rooms.sweep(), 15 * 60 * 1000).unref();

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '1h' }));

// ממשקים וירטואליים (Docker, VPN, מכונות וירטואליות) — לטלפון אין דרך להגיע
// אליהם, ולכן הם יורדים לתחתית הרשימה ולא נבחרים כל עוד יש חלופה אמיתית.
const VIRTUAL_IFACE = /^(docker|br-|veth|virbr|vmnet|vboxnet|utun|tun|tap|zt|tailscale|wg|awdl|llw)/i;
const PHYSICAL_IFACE = /^(en|eth|wl|wlan|wlp|enp|eno)/i;

/**
 * מדרג כתובת לפי הסיכוי שטלפון באותה רשת Wi-Fi יוכל להגיע אליה.
 * ציון גבוה = מועמדת טובה יותר.
 */
function scoreAddress(name, address) {
  let score = 0;
  if (VIRTUAL_IFACE.test(name)) score -= 100;
  if (PHYSICAL_IFACE.test(name)) score += 10;
  if (address.startsWith('192.168.')) score += 30;
  else if (address.startsWith('10.')) score += 20;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) score += 15;
  if (address.startsWith('169.254.')) score -= 50; // link-local, בלי DHCP
  return score;
}

/** כל כתובות ה-IPv4 החיצוניות, מהמועמדת הסבירה ביותר ומטה. */
function lanAddresses() {
  const found = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        found.push({ name, address: entry.address, score: scoreAddress(name, entry.address) });
      }
    }
  }
  return found.sort((a, b) => b.score - a.score);
}

/**
 * הכתובת שהטלפונים יקבלו בקוד ה-QR. אפשר לכפות אותה עם HOST_IP כשהניחוש
 * האוטומטי שגוי — מה שקורה בקלות במחשב עם Docker או VPN פעיל.
 */
function lanAddress() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  return lanAddresses()[0]?.address || 'localhost';
}

app.get('/api/categories', (_req, res) => res.json(content.list()));

const joinUrl = (code) => `${secure ? 'https' : 'http'}://${lanAddress()}:${PORT}/player.html?code=${code}`;

app.post('/api/rooms', (req, res) => {
  const room = rooms.create(req.body?.config || {});
  res.json({ code: room.code, joinUrl: joinUrl(room.code) });
});

app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  res.json({ code: room.code, phase: room.game.phase, players: room.game.players.size });
});

app.get('/api/rooms/:code/qr.svg', async (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).end();
  const svg = await QRCode.toString(joinUrl(room.code), { type: 'svg', margin: 1, width: 320 });
  res.type('image/svg+xml').send(svg);
});

app.get('/api/rooms/:code/report', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) return res.status(404).json({ error: 'חדר לא נמצא' });
  res.json(room.game.report());
});

/**
 * הדפדפן נותן גישה למיקרופון רק בהקשר מאובטח, ו-http://192.168.x.x אינו כזה.
 * לכן אם קיימת תעודה מקומית (npm run cert) מרימים HTTPS — אחרת HTTP רגיל,
 * שמספיק לפיתוח ב-localhost ולמשחק עם הקלדה במקום דיבור.
 */
function createServer() {
  const key = path.join(CERT_DIR, 'key.pem');
  const cert = path.join(CERT_DIR, 'cert.pem');
  if (process.env.HTTP_ONLY !== '1' && fs.existsSync(key) && fs.existsSync(cert)) {
    return {
      server: https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, app),
      secure: true,
    };
  }
  return { server: http.createServer(app), secure: false };
}

const { server, secure } = createServer();
const wss = new WebSocketServer({ server, path: '/ws' });

/** פעולות שהלקוח יכול לבקש, ומי מורשה לבקש אותן. */
const ACTIONS = {
  start: (room) => room.game.start(),
  challenge: (room, ws, msg) => room.game.challenge(ws.playerId, msg.defenderId),
  pass: (room, ws) => room.game.pass(ws.playerId),
  decide: (room, ws, msg) => room.game.decide(ws.playerId, msg.choice),
  rematch: (room) => room.game.rematch(),
  answer: (room, ws, msg) => room.game.submitText(ws.playerId, msg.text || ''),
  speech: (room, ws, msg) => room.game.speech(ws.playerId, msg.transcript || '', !!msg.isFinal),
};
const PLAYER_ONLY = new Set(['challenge', 'pass', 'decide', 'answer', 'speech', 'rematch']);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { t: 'error', message: 'הודעה לא תקינה' });
    }

    if (msg.t === 'hello') return handleHello(ws, msg);

    const room = ws.room;
    if (!room) return send(ws, { t: 'error', message: 'לא מחוברים לחדר' });

    const action = ACTIONS[msg.t];
    if (!action) return send(ws, { t: 'error', message: `פעולה לא מוכרת: ${msg.t}` });
    if (PLAYER_ONLY.has(msg.t) && !ws.playerId) {
      return send(ws, { t: 'error', message: 'רק מתמודד יכול לבצע את הפעולה הזו' });
    }

    try {
      action(room, ws, msg);
    } catch (err) {
      send(ws, { t: 'error', message: err.message });
    }
  });

  ws.on('close', () => {
    if (ws.room) ws.room.detach(ws);
  });
});

function handleHello(ws, msg) {
  const room = rooms.get(msg.code);
  if (!room) return send(ws, { t: 'error', message: 'קוד חדר לא נמצא', fatal: true });

  ws.room = room;
  room.attach(ws);

  if (msg.role === 'player') {
    // חיבור חוזר: הטלפון זוכר את המזהה שלו, כדי לשרוד רענון או נעילת מסך
    if (msg.playerId && room.game.players.has(msg.playerId)) {
      ws.playerId = msg.playerId;
      room.game.setConnected(ws.playerId, true);
    } else {
      try {
        ws.playerId = room.game.addPlayer({ name: msg.name, categoryId: msg.categoryId });
      } catch (err) {
        return send(ws, { t: 'error', message: err.message, fatal: true });
      }
    }
  }

  send(ws, {
    t: 'joined',
    code: room.code,
    playerId: ws.playerId || null,
    role: msg.role || 'board',
    state: room.game.snapshot(ws.playerId),
  });
  room.broadcastState();
}

function send(ws, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify(payload));
}

// חיבורים מטלפון נופלים בשקט כשהמסך ננעל — ping מזהה את זה
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
heartbeat.unref();

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const scheme = secure ? 'https' : 'http';
    const host = lanAddress();
    const others = lanAddresses().filter((a) => a.address !== host);

    console.log('');
    console.log(`  🏟️  הזירה עלתה לאוויר (${secure ? 'HTTPS' : 'HTTP'})`);
    console.log('');
    console.log(`  פתחו בשני הטלפונים:  ${scheme}://${host}:${PORT}`);
    console.log(`  (על המחשב הזה:       ${scheme}://localhost:${PORT})`);
    console.log('');
    console.log('  הטלפונים חייבים להיות על אותה רשת Wi-Fi כמו המחשב הזה.');

    if (secure) {
      console.log('  בכניסה הראשונה כל טלפון יציג אזהרת אבטחה — זו התעודה');
      console.log('  המקומית שלכם. אשרו אותה פעם אחת בכל מכשיר.');
    } else {
      console.log('');
      console.log('  ⚠️  ב-HTTP הדפדפן חוסם את המיקרופון מחוץ ל-localhost,');
      console.log('     אז אפשר יהיה רק להקליד תשובות.');
      console.log('     להאזנה חיה:  npm run cert  ואז  npm start');
    }

    if (others.length) {
      console.log('');
      console.log('  אם הטלפונים לא מצליחים להתחבר, נסו כתובת אחרת:');
      for (const a of others) console.log(`     HOST_IP=${a.address} npm start      (${a.name})`);
    }
    console.log('');
  });
}

module.exports = { app, server, rooms, content, lanAddress, lanAddresses, secure };
