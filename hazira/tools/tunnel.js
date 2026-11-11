'use strict';

/**
 * מרים את המשחק ופותח לו מנהרה ציבורית, כדי לשחק מול מישהו שלא נמצא
 * באותה רשת Wi-Fi.
 *
 * למה מנהרה ולא סתם כתובת ה-LAN: הכתובת המקומית של המחשב אינה נגישה
 * מחוץ לבית, ותעודה חתומה עצמית מציגה למי שמקבל את הקישור מסך אזהרה
 * מבהיל. המנהרה נותנת כתובת HTTPS אמיתית — בלי אזהרות, ועם מיקרופון
 * שעובד, שזה הלב של המשחק.
 *
 * דורש cloudflared מותקן:
 *   macOS:    brew install cloudflared
 *   Windows:  winget install Cloudflare.cloudflared
 *   Linux:    https://github.com/cloudflare/cloudflared/releases
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const URL_PATTERN = /https:\/\/[-a-z0-9]+\.trycloudflare\.com/i;

function hasCloudflared() {
  const probe = spawnSync('cloudflared', ['--version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

function explainMissing() {
  console.error('');
  console.error('  לא נמצא cloudflared — הוא מה שפותח את הכתובת הציבורית.');
  console.error('');
  console.error('  התקנה:');
  console.error('    macOS:    brew install cloudflared');
  console.error('    Windows:  winget install Cloudflare.cloudflared');
  console.error('    Linux:    https://github.com/cloudflare/cloudflared/releases');
  console.error('');
  console.error('  לחלופין, אם שניכם על אותה רשת Wi-Fi:  npm run cert && npm start');
  console.error('');
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    const proc = spawn('cloudflared', [
      'tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const timer = setTimeout(() => {
      reject(new Error('המנהרה לא הגיבה בתוך 30 שניות'));
    }, 30_000);

    // cloudflared מדפיס את הכתובת ל-stderr, לא ל-stdout
    const scan = (chunk) => {
      const match = String(chunk).match(URL_PATTERN);
      if (match) {
        clearTimeout(timer);
        resolve({ url: match[0], proc });
      }
    };
    proc.stdout.on('data', scan);
    proc.stderr.on('data', scan);

    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`cloudflared נסגר עם קוד ${code}`));
    });
  });
}

async function main() {
  if (!hasCloudflared()) {
    explainMissing();
    process.exit(1);
  }

  console.log('  פותח מנהרה ציבורית…');
  let tunnel;
  try {
    tunnel = await startTunnel();
  } catch (err) {
    console.error(`  פתיחת המנהרה נכשלה: ${err.message}`);
    process.exit(1);
  }

  // המנהרה מדברת עם השרת ב-HTTP מקומי; ה-HTTPS נגמר אצל cloudflare
  const game = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    stdio: 'inherit',
    env: { ...process.env, HTTP_ONLY: '1', PUBLIC_URL: tunnel.url, PORT: String(PORT) },
  });

  console.log('');
  console.log('  ───────────────────────────────────────────────');
  console.log(`  הקישור למשחק:  ${tunnel.url}`);
  console.log('  ───────────────────────────────────────────────');
  console.log('');
  console.log('  פתחו אותו אצלכם, לחצו "פתיחת דו־קרב", ואז');
  console.log('  "שליחת הזמנה" כדי לשלוח ליריב את הקישור שלו.');
  console.log('');
  console.log('  הכתובת חיה כל עוד החלון הזה פתוח. Ctrl+C לסיום.');
  console.log('');

  const shutdown = () => {
    game.kill();
    tunnel.proc.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  game.on('exit', shutdown);
}

if (require.main === module) main();
module.exports = { hasCloudflared, URL_PATTERN };
