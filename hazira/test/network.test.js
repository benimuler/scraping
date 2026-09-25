'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');

/**
 * בחירת כתובת ה-LAN היא נקודת הכשל הנפוצה בהרצה על שני מכשירים: אם השרת
 * מפרסם כתובת של Docker או VPN, קוד ה-QR מוביל לשום מקום והטלפון השני
 * פשוט לא מתחבר — בלי שום הודעת שגיאה מועילה.
 */
const iface = (address, internal = false) => [{ family: 'IPv4', address, internal }];

function withInterfaces(interfaces, fn) {
  const original = os.networkInterfaces;
  os.networkInterfaces = () => interfaces;
  delete require.cache[require.resolve('../server/index.js')];
  try {
    return fn(require('../server/index.js'));
  } finally {
    os.networkInterfaces = original;
    delete require.cache[require.resolve('../server/index.js')];
  }
}

test('Wi-Fi אמיתי מנצח את Docker ואת ה-VPN', () => {
  withInterfaces({
    lo: iface('127.0.0.1', true),
    docker0: iface('172.17.0.1'),
    utun3: iface('10.8.0.6'),
    en0: iface('192.168.1.24'),
  }, ({ lanAddress }) => {
    assert.equal(lanAddress(), '192.168.1.24');
  });
});

test('כשיש רק כתובת של 10.x היא נבחרת', () => {
  withInterfaces({
    lo: iface('127.0.0.1', true),
    eth0: iface('10.0.0.42'),
  }, ({ lanAddress }) => {
    assert.equal(lanAddress(), '10.0.0.42');
  });
});

test('כתובת link-local נדחית לטובת כל חלופה', () => {
  withInterfaces({
    en1: iface('169.254.10.2'),
    en0: iface('192.168.0.7'),
  }, ({ lanAddress }) => {
    assert.equal(lanAddress(), '192.168.0.7');
  });
});

test('בלי שום ממשק חיצוני נופלים ל-localhost', () => {
  withInterfaces({ lo: iface('127.0.0.1', true) }, ({ lanAddress }) => {
    assert.equal(lanAddress(), 'localhost');
  });
});

test('HOST_IP גובר על הניחוש האוטומטי', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ lanAddress }) => {
    process.env.HOST_IP = '192.168.1.99';
    try {
      assert.equal(lanAddress(), '192.168.1.99');
    } finally {
      delete process.env.HOST_IP;
    }
  });
});

test('כל הכתובות מוצעות כחלופות, מהסבירה ביותר ומטה', () => {
  withInterfaces({
    docker0: iface('172.17.0.1'),
    en0: iface('192.168.1.24'),
  }, ({ lanAddresses }) => {
    const order = lanAddresses().map((a) => a.address);
    assert.deepEqual(order, ['192.168.1.24', '172.17.0.1']);
  });
});

test('PUBLIC_URL קובע את הקישור שנשלח ליריב', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    process.env.PUBLIC_URL = 'https://brave-horse-42.trycloudflare.com';
    try {
      assert.equal(publicBase(), 'https://brave-horse-42.trycloudflare.com');
    } finally {
      delete process.env.PUBLIC_URL;
    }
  });
});

test('סלאש עודף בסוף PUBLIC_URL לא יוצר קישור שבור', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    process.env.PUBLIC_URL = 'https://example.com///';
    try {
      assert.equal(publicBase(), 'https://example.com');
    } finally {
      delete process.env.PUBLIC_URL;
    }
  });
});

test('בלי PUBLIC_URL נופלים לכתובת ה-LAN', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    assert.match(publicBase(), /^http:\/\/192\.168\.1\.24:\d+$/);
  });
});

test('מאחורי מנהרה הקישור נגזר מהבקשה, בלי להגדיר כלום', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    const req = {
      headers: { host: 'brave-horse-42.trycloudflare.com', 'x-forwarded-proto': 'https' },
    };
    assert.equal(publicBase(req), 'https://brave-horse-42.trycloudflare.com');
  });
});

test('רשימת פרוקסי ב-x-forwarded-proto — נלקח הראשון', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    const req = { headers: { host: 'example.com', 'x-forwarded-proto': 'https, http' } };
    assert.equal(publicBase(req), 'https://example.com');
  });
});

test('בקשה מ-localhost לא מייצרת קישור שאי אפשר לשלוח', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
      assert.match(publicBase({ headers: { host } }), /192\.168\.1\.24/, host);
    }
  });
});

test('PUBLIC_URL גובר גם על כותרות הבקשה', () => {
  withInterfaces({ en0: iface('192.168.1.24') }, ({ publicBase }) => {
    process.env.PUBLIC_URL = 'https://chosen.example';
    try {
      const req = { headers: { host: 'other.example', 'x-forwarded-proto': 'https' } };
      assert.equal(publicBase(req), 'https://chosen.example');
    } finally {
      delete process.env.PUBLIC_URL;
    }
  });
});

test('על שרת מתארח, בקשה בלי Host נופלת לכתובת הפלטפורמה ולא לכתובת פנימית', () => {
  withInterfaces({ eth0: iface('10.197.100.240') }, ({ publicBase }) => {
    process.env.RENDER_EXTERNAL_URL = 'https://hazira-c3uh.onrender.com';
    try {
      assert.equal(publicBase(), 'https://hazira-c3uh.onrender.com');
      // בקשה אמיתית דרך הפרוקסי עדיין גוברת — כך דומיין מותאם עובד
      const req = { headers: { host: 'hazira.example', 'x-forwarded-proto': 'https' } };
      assert.equal(publicBase(req), 'https://hazira.example');
    } finally {
      delete process.env.RENDER_EXTERNAL_URL;
    }
  });
});

test('הודעת העלייה מזהה סביבה מתארחת', () => {
  withInterfaces({ eth0: iface('10.197.100.240') }, ({ hostedUrl }) => {
    assert.equal(hostedUrl(), null);
    process.env.RENDER_EXTERNAL_URL = 'https://hazira-c3uh.onrender.com/';
    try {
      assert.equal(hostedUrl(), 'https://hazira-c3uh.onrender.com');
    } finally {
      delete process.env.RENDER_EXTERNAL_URL;
    }
  });
});
