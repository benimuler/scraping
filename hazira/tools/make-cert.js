'use strict';

/**
 * יוצר תעודה עצמית לשרת, כדי שהמשחק ירוץ ב-HTTPS ברשת מקומית.
 *
 * למה זה נחוץ: דפדפנים מאפשרים גישה למיקרופון רק בהקשר מאובטח. localhost נחשב
 * מאובטח, אבל http://192.168.x.x לא — ובלי זה ההאזנה החיה, שהיא לב המשחק,
 * פשוט לא תעבוד מהטלפונים. התעודה חתומה עצמית, ולכן בכניסה הראשונה כל טלפון
 * יציג אזהרה שצריך לאשר פעם אחת.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CERT_DIR = path.join(__dirname, '..', 'certs');

function lanAddresses() {
  const out = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) out.push(entry.address);
    }
  }
  return out.length ? out : ['127.0.0.1'];
}

function build() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const addresses = lanAddresses();
  const san = ['DNS:localhost', 'IP:127.0.0.1', ...addresses.map((a) => `IP:${a}`)].join(',');

  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825',
      '-subj', '/CN=hazira.local',
      '-addext', `subjectAltName=${san}`,
      '-keyout', path.join(CERT_DIR, 'key.pem'),
      '-out', path.join(CERT_DIR, 'cert.pem'),
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    console.error('יצירת התעודה נכשלה. צריך openssl מותקן.');
    console.error(String(err.stderr || err.message).trim());
    process.exit(1);
  }

  console.log(`נוצרה תעודה ב-${CERT_DIR}`);
  console.log(`כתובות מכוסות: ${addresses.join(', ')}`);
  console.log('הריצו עכשיו: npm start');
}

if (require.main === module) build();
module.exports = { build, lanAddresses, CERT_DIR };
