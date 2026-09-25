'use strict';

/**
 * דגלים משורטטים בקוד.
 *
 * למה לא אמוג'י: דגלי אמוג'י מתורגמים לצמד אותיות במערכות שאינן תומכות בהם,
 * ואז השאלה עצמה מכילה את התשובה. שרטוט ב-SVG נראה זהה בכל מכשיר.
 *
 * מה נכנס ומה לא: רק דגלים שאפשר לשרטט נאמנה מצורות גאומטריות. דגל שכל
 * ייחודו הוא סמל מצויר — נשר מצרי, עיט אלבני, הסמל המקסיקני — אינו נכנס, כי
 * בלי הסמל הוא זהה לדגל אחר, ועם סמל מאולתר הוא פשוט שקר. מסיבה דומה אין כאן
 * את לטביה לצד אוסטריה ולא את מונקו לצד אינדונזיה: זוגות שנבדלים רק ביחס
 * הפסים או בגוון, ושחקן לא יכול להבחין ביניהם.
 */

const { W, H, svg, escapeXml, poly, star } = require('./svg');

// ---------------------------------------------------------- בוני גוף בסיסיים
// כל בונה מחזיר גוף SVG ולא מסמך שלם, כדי שאפשר יהיה להרכיב שכבות זו על זו.

const rect = (x, y, w, h, fill) =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;

const vBody = (...colors) => colors
  .map((c, i) => rect((W / colors.length) * i, 0, W / colors.length, H, c)).join('');

const hBody = (...colors) => colors
  .map((c, i) => rect(0, (H / colors.length) * i, W, H / colors.length, c)).join('');

/** פסים אופקיים ביחסי גובה שונים: [[צבע, מִשְׁקָל], ...] */
const bandsBody = (rows) => {
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  let y = 0;
  return rows.map(([color, weight]) => {
    const h = (H * weight) / total;
    const body = rect(0, y, W, h, color);
    y += h;
    return body;
  }).join('');
};

/** פסים אופקיים שווים בשני צבעים מתחלפים — ארצות הברית, אורוגוואי, מלזיה. */
const stripesBody = (count, first, second) => Array.from({ length: count }, (_, i) =>
  rect(0, (H / count) * i, W, H / count, i % 2 ? second : first)).join('');

const circle = (cx, cy, r, fill) =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}"/>`;

const starOfDavid = (cx, cy, r, color) => {
  const triangle = (rot) => Array.from({ length: 3 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 3;
    return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${triangle(0)}" fill="none" stroke="${color}" stroke-width="14"/>` +
         `<polygon points="${triangle(Math.PI)}" fill="none" stroke="${color}" stroke-width="14"/>`;
};

/**
 * סהר כצורה אחת, ולא כעיגול שנגרע ממנו עיגול בצבע הרקע.
 *
 * למה: הדגל האלג׳ירי מעמיד את הסהר בדיוק על התפר שבין הירוק והלבן, ושם אין
 * "צבע רקע" יחיד שאפשר לגרוע בו — כל גריעה מכתימה את אחד הצדדים. הצורה כאן
 * מחושבת מנקודות החיתוך של שני העיגולים, ולכן היא שקופה מסביב ומונחת על כל
 * רקע. tilt קובע לאיזה כיוון הסהר נפתח: 1 לימין, ‎-1 לשמאל, ורביע לכל צד.
 */
const crescent = (cx, cy, r, color, tilt = 1) => {
  const phi = typeof tilt === 'number' ? (tilt >= 0 ? 0 : Math.PI) : tilt;
  // מרווח גדול יותר בין מרכזי שני העיגולים נותן סהר דק עם קרניים ארוכות,
  // כמו בדגלים עצמם, ולא צורה עבה שנראית כמו עיגול שנגסו בו
  const d = r * 0.46;
  const inner = r * 0.88;
  // חיתוך שני עיגולים: המרחק לציר החיתוך, וחצי המרחק בין קרני הסהר
  const axis = (d * d - inner * inner + r * r) / (2 * d);
  const half = Math.sqrt(Math.max(0, r * r - axis * axis));
  const ux = Math.cos(phi);
  const uy = Math.sin(phi);
  const tip = (sign) => [
    cx + axis * ux - sign * half * uy,
    cy + axis * uy + sign * half * ux,
  ];
  const [x1, y1] = tip(1);
  const [x2, y2] = tip(-1);
  return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} ` +
    `A${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${x2.toFixed(1)},${y2.toFixed(1)} ` +
    `A${inner.toFixed(1)},${inner.toFixed(1)} 0 0,0 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${color}"/>`;
};

/** שמש עם קרניים — אורוגוואי, מקדוניה, הפיליפינים. */
const sun = (cx, cy, r, color, rays = 16, length = 1.9) => {
  let body = '';
  for (let i = 0; i < rays; i += 1) {
    const a = (i * 2 * Math.PI) / rays;
    const span = Math.PI / rays * 0.45;
    body += poly([
      [cx + r * length * Math.cos(a), cy + r * length * Math.sin(a)],
      [cx + r * Math.cos(a - span), cy + r * Math.sin(a - span)],
      [cx + r * Math.cos(a + span), cy + r * Math.sin(a + span)],
    ], color);
  }
  return body + circle(cx, cy, r, color);
};

/** צלב נורדי: מוסט שמאלה, עם אפשרות לצלב פנימי בצבע שני. */
const nordic = (bg, cross, inner = null) => {
  const x = W * 0.34;
  const y = H / 2;
  let body = rect(0, 0, W, H, bg);
  body += rect(0, y - 35, W, 70, cross) + rect(x - 35, 0, 70, H, cross);
  if (inner) body += rect(0, y - 17, W, 34, inner) + rect(x - 17, 0, 34, H, inner);
  return body;
};

/** צלב ממורכז, בשני עוביים — מלטה, גאורגיה, הרפובליקה הדומיניקנית. */
const crossBody = (color, thickness = 60) =>
  rect(0, H / 2 - thickness / 2, W, thickness, color) +
  rect(W / 2 - thickness / 2, 0, thickness, H, color);

/** משולש בשפת התורן — סודאן, כווית, צ׳כיה, קובה. */
const hoistTriangle = (color, depth = W * 0.4) => poly([[0, 0], [depth, H / 2], [0, H]], color);

/** אלכסון רחב מפינה לפינה — קונגו, טנזניה, טרינידד. */
const diagonalBand = (color, width = 90) => {
  const dx = width * 0.75;
  return poly([[0, H + dx], [0, H - dx], [W - dx, 0], [W + dx, 0]], color);
};

const canton = (color, w = W * 0.4, h = H * 0.5) => rect(0, 0, w, h, color);

const line = (x1, y1, x2, y2, color, width) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;

/** ארבעה מבנים חוזרים שכדאי לתת להם שם, כי הם מופיעים בעשרות דגלים. */
const hoistBarFlag = (barColor, bodyColors, frac = 0.25) => {
  const barW = W * frac;
  const rows = bodyColors.map((c, i) =>
    rect(barW, (H / bodyColors.length) * i, W - barW, H / bodyColors.length, c)).join('');
  return rows + rect(0, 0, barW, H, barColor);
};

const crescentStar = (cx, cy, r, color, starR = null) =>
  crescent(cx, cy, r, color) + star(cx + r * 1.15, cy, starR || r * 0.5, color);

const cedar = (cx, cy, color) => {
  let body = rect(cx - 12, cy + 40, 24, 45, color);
  for (const [dy, half] of [[40, 78], [5, 60], [-30, 40]]) {
    body += poly([[cx, cy + dy - 62], [cx + half, cy + dy], [cx - half, cy + dy]], color);
  }
  return body;
};

/**
 * עלה אדר — חמש אונות וגבעול.
 *
 * הגרסה הקודמת הייתה מצולע סימטרי בעל אחת־עשרה קצוות, והיא נראתה על המסך
 * כמו כוכב. זה לא פרט אסתטי: בלי עלה מזוהה הדגל הקנדי הוא אדום־לבן־אדום
 * אנכי, כלומר בדיוק הדגל של פרו — ושתי המדינות יושבות באותה קטגוריה.
 */
const mapleLeaf = (cx, cy, scale, color) => {
  const at = (deg, radius) => {
    const a = (deg * Math.PI) / 180;
    return [cx + scale * radius * Math.sin(a), cy - scale * radius * Math.cos(a)];
  };
  const side = (sign) => [
    at(sign * 20, 56), at(sign * 40, 78), at(sign * 62, 54), at(sign * 84, 70),
    at(sign * 108, 44), [cx + sign * scale * 26, cy + scale * 56],
    [cx + sign * scale * 13, cy + scale * 62], [cx + sign * scale * 13, cy + scale * 100],
  ];
  return poly([at(0, 100), ...side(1), ...side(-1).reverse()], color);
};

const flag = (body) => svg(body);

// ------------------------------------------------------------------- אירופה

const EUROPE = [
  ['france', 'צרפת', () => vBody('#002395', '#ffffff', '#ed2939')],
  ['italy', 'איטליה', () => vBody('#009246', '#ffffff', '#ce2b37')],
  ['germany', 'גרמניה', () => hBody('#000000', '#dd0000', '#ffce00')],
  ['spain', 'ספרד', () => bandsBody([['#aa151b', 1], ['#f1bf00', 2], ['#aa151b', 1]])],
  ['netherlands', 'הולנד', () => hBody('#ae1c28', '#ffffff', '#21468b')],
  ['belgium', 'בלגיה', () => vBody('#000000', '#fdda24', '#ef3340')],
  ['poland', 'פולין', () => hBody('#ffffff', '#dc143c')],
  ['russia', 'רוסיה', () => hBody('#ffffff', '#0039a6', '#d52b1e')],
  ['ukraine', 'אוקראינה', () => hBody('#0057b7', '#ffd700')],
  ['greece', 'יוון', () => {
    const unit = H / 9;
    let body = Array.from({ length: 9 }, (_, i) =>
      rect(0, unit * i, W, unit, i % 2 ? '#ffffff' : '#0d5eaf')).join('');
    body += rect(0, 0, unit * 5, unit * 5, '#0d5eaf');
    body += rect(unit * 2, 0, unit, unit * 5, '#ffffff');
    body += rect(0, unit * 2, unit * 5, unit, '#ffffff');
    return body;
  }],
  ['portugal', 'פורטוגל', () => rect(0, 0, W, H, '#ff0000') + rect(0, 0, W * 0.4, H, '#006600')
    + circle(W * 0.4, H / 2, 70, '#ffd700')],
  ['switzerland', 'שווייץ', 'שוויץ', () => rect(0, 0, W, H, '#d52b1e')
    + rect(W / 2 - 30, H / 2 - 100, 60, 200, '#ffffff')
    + rect(W / 2 - 100, H / 2 - 30, 200, 60, '#ffffff')],
  ['united-kingdom', 'בריטניה', 'אנגליה', () => rect(0, 0, W, H, '#012169')
    + line(0, 0, W, H, '#ffffff', 58) + line(W, 0, 0, H, '#ffffff', 58)
    + line(0, 0, W, H, '#c8102e', 26) + line(W, 0, 0, H, '#c8102e', 26)
    + crossBody('#ffffff', 100) + crossBody('#c8102e', 56)],
  ['ireland', 'אירלנד', () => vBody('#169b62', '#ffffff', '#ff883e')],
  ['austria', 'אוסטריה', () => hBody('#ed2939', '#ffffff', '#ed2939')],
  ['romania', 'רומניה', () => vBody('#002b7f', '#fcd116', '#ce1126')],
  ['hungary', 'הונגריה', () => hBody('#ce2939', '#ffffff', '#477050')],
  ['bulgaria', 'בולגריה', () => hBody('#ffffff', '#00966e', '#d62612')],
  ['czechia', 'צ׳כיה', 'צכיה', () => hBody('#ffffff', '#d7141a') + hoistTriangle('#11457e')],
  ['denmark', 'דנמרק', () => nordic('#c60c30', '#ffffff')],
  ['sweden', 'שוודיה', () => nordic('#006aa7', '#fecc00')],
  ['norway', 'נורווגיה', () => nordic('#ba0c2f', '#ffffff', '#00205b')],
  ['finland', 'פינלנד', () => nordic('#ffffff', '#003580')],
  ['iceland', 'איסלנד', () => nordic('#02529c', '#ffffff', '#dc1e35')],
  ['estonia', 'אסטוניה', () => hBody('#4891d9', '#000000', '#ffffff')],
  ['lithuania', 'ליטא', () => hBody('#fdb913', '#006a44', '#c1272d')],
  ['armenia', 'ארמניה', () => hBody('#d90012', '#0033a0', '#f2a800')],
  ['malta', 'מלטה', () => vBody('#ffffff', '#cf142b')],
  ['north-macedonia', 'מקדוניה הצפונית', 'מקדוניה', () => rect(0, 0, W, H, '#d20000')
    + sun(W / 2, H / 2, 52, '#ffe600', 8, 6)],
  ['bosnia', 'בוסניה', () => rect(0, 0, W, H, '#002395')
    + poly([[W * 0.3, 0], [W, 0], [W, H]], '#fecb00')
    + Array.from({ length: 7 }, (_, i) =>
      star(W * 0.36 + (i * W * 0.088), H * 0.86 - (i * H * 0.118), 17, '#ffffff')).join('')],
];

// --------------------------------------------------------------------- אסיה

const ASIA = [
  ['japan', 'יפן', () => rect(0, 0, W, H, '#ffffff') + circle(W / 2, H / 2, 110, '#bc002d')],
  ['china', 'סין', () => rect(0, 0, W, H, '#de2910') + star(140, 110, 62, '#ffde00')
    + [[250, 55], [300, 105], [300, 175], [250, 225]].map(([x, y]) => star(x, y, 22, '#ffde00')).join('')],
  ['india', 'הודו', () => bandsBody([['#ff9933', 1], ['#ffffff', 1], ['#138808', 1]])
    + `<circle cx="${W / 2}" cy="${H / 2}" r="55" fill="none" stroke="#000080" stroke-width="8"/>`],
  ['israel', 'ישראל', () => rect(0, 0, W, H, '#ffffff')
    + rect(0, 48, W, 46, '#0038b8') + rect(0, H - 94, W, 46, '#0038b8')
    + starOfDavid(W / 2, H / 2, 82, '#0038b8')],
  ['turkey', 'טורקיה', () => rect(0, 0, W, H, '#e30a17')
    + crescentStar(W * 0.4, H / 2, 82, '#ffffff', 44)],
  ['vietnam', 'וייטנאם', () => rect(0, 0, W, H, '#da251d') + star(W / 2, H / 2, 105, '#ffff00')],
  ['indonesia', 'אינדונזיה', () => hBody('#ce1126', '#ffffff')],
  ['thailand', 'תאילנד', () => bandsBody([['#a51931', 1], ['#f4f5f8', 1], ['#2d2a4a', 2], ['#f4f5f8', 1], ['#a51931', 1]])],
  ['bangladesh', 'בנגלדש', () => rect(0, 0, W, H, '#006a4e') + circle(W * 0.45, H / 2, 110, '#f42a41')],
  ['south-korea', 'קוריאה הדרומית', 'דרום קוריאה', () => {
    const cx = W / 2;
    const cy = H / 2;
    const r = 95;
    let body = rect(0, 0, W, H, '#ffffff') + circle(cx, cy, r, '#cd2e3a');
    body += `<path d="M${cx - r},${cy} A${r},${r} 0 0,0 ${cx + r},${cy} ` +
      `A${r / 2},${r / 2} 0 0,0 ${cx},${cy} A${r / 2},${r / 2} 0 0,1 ${cx - r},${cy} Z" fill="#0047a0"/>`;
    // ארבעת הטריגרמות — שלושה פסים בכל פינה, מוטים אל מרכז הדגל
    for (const [i, [x, y, rot]] of [[cx - 175, cy - 85, -56], [cx + 175, cy - 85, 56],
      [cx - 175, cy + 85, 56], [cx + 175, cy + 85, -56]].entries()) {
      body += `<g transform="translate(${x},${y}) rotate(${rot})">`;
      for (let bar = 0; bar < 3; bar += 1) {
        body += rect(-46, -26 + bar * 20, 92, 12, '#000000');
      }
      body += '</g>';
      void i;
    }
    return body;
  }],
  ['north-korea', 'קוריאה הצפונית', 'צפון קוריאה', () => bandsBody([['#024fa2', 2], ['#ffffff', 1], ['#ed1c27', 6], ['#ffffff', 1], ['#024fa2', 2]])
    + circle(W * 0.36, H / 2, 72, '#ffffff') + star(W * 0.36, H / 2, 52, '#ed1c27')],
  ['taiwan', 'טייוואן', () => rect(0, 0, W, H, '#fe0000') + canton('#000095')
    + sun(W * 0.2, H * 0.25, 30, '#ffffff', 12, 2.2)],
  ['pakistan', 'פקיסטן', () => hoistBarFlag('#ffffff', ['#01411c'], 0.25)
    + crescentStar(W * 0.62, H / 2, 78, '#ffffff', 40)],
  ['united-arab-emirates', 'איחוד האמירויות', 'אמירויות', () => hoistBarFlag('#ff0000', ['#00732f', '#ffffff', '#000000'], 0.25)],
  ['kuwait', 'כווית', () => hBody('#007a3d', '#ffffff', '#ce1126')
    + poly([[0, 0], [W * 0.3, H / 3], [W * 0.3, (H * 2) / 3], [0, H]], '#000000')],
  ['jordan', 'ירדן', () => hBody('#000000', '#ffffff', '#007a3d')
    + hoistTriangle('#ce1126', W * 0.42) + star(W * 0.13, H / 2, 34, '#ffffff', 7)],
  ['syria', 'סוריה', () => hBody('#ce1126', '#ffffff', '#000000')
    + star(W * 0.4, H / 2, 40, '#007a3d') + star(W * 0.6, H / 2, 40, '#007a3d')],
  ['lebanon', 'לבנון', () => bandsBody([['#ee161f', 1], ['#ffffff', 2], ['#ee161f', 1]])
    + cedar(W / 2, H / 2 - 10, '#00a850')],
  ['yemen', 'תימן', () => hBody('#ce1126', '#ffffff', '#000000')],
  ['qatar', 'קטאר', () => {
    const barW = W * 0.28;
    const teeth = 9;
    const pts = [[W, 0]];
    for (let i = 0; i < teeth; i += 1) {
      pts.push([barW, (H / teeth) * i]);
      pts.push([barW + 46, (H / teeth) * (i + 0.5)]);
      pts.push([barW, (H / teeth) * (i + 1)]);
    }
    pts.push([W, H]);
    return rect(0, 0, W, H, '#ffffff') + poly(pts, '#8d1b3d');
  }],
  ['uzbekistan', 'אוזבקיסטן', () => bandsBody([['#0099b5', 6], ['#ce1126', 1], ['#ffffff', 6], ['#ce1126', 1], ['#1eb53a', 6]])
    + crescent(W * 0.16, H * 0.2, 44, '#ffffff')
    + [0, 1, 2].map((i) => star(W * 0.3 + i * 52, H * 0.16, 15, '#ffffff')).join('')],
  ['azerbaijan', 'אזרבייג׳ן', 'אזרביג׳ן', () => hBody('#0092bc', '#e4002b', '#00af66')
    + crescentStar(W * 0.44, H / 2, 46, '#ffffff', 26)],
  ['georgia', 'גאורגיה', () => rect(0, 0, W, H, '#ffffff') + crossBody('#ff0000', 66)
    + [[W * 0.22, H * 0.24], [W * 0.78, H * 0.24], [W * 0.22, H * 0.76], [W * 0.78, H * 0.76]]
      .map(([x, y]) => rect(x - 32, y - 9, 64, 18, '#ff0000') + rect(x - 9, y - 32, 18, 64, '#ff0000')).join('')],
  ['philippines', 'הפיליפינים', 'פיליפינים', () => hBody('#0038a8', '#ce1126')
    + hoistTriangle('#ffffff', W * 0.45) + sun(W * 0.14, H / 2, 26, '#fcd116', 8, 2.1)],
  ['singapore', 'סינגפור', () => hBody('#ed2939', '#ffffff')
    + crescent(W * 0.2, H * 0.25, 52, '#ffffff')
    + [[0.3, 0.12], [0.38, 0.2], [0.35, 0.32], [0.25, 0.32], [0.22, 0.2]]
      .map(([fx, fy]) => star(W * fx, H * fy, 16, '#ffffff')).join('')],
  ['malaysia', 'מלזיה', () => stripesBody(14, '#cc0001', '#ffffff') + canton('#010066', W * 0.5, H * 0.5)
    + crescentStar(W * 0.2, H * 0.26, 52, '#ffc400', 28)],
  ['myanmar', 'מיאנמר', () => hBody('#fecb00', '#34b233', '#ea2839')
    + star(W / 2, H / 2, 105, '#ffffff')],
  ['laos', 'לאוס', () => bandsBody([['#ce1126', 1], ['#002868', 2], ['#ce1126', 1]])
    + circle(W / 2, H / 2, 72, '#ffffff')],
];

// -------------------------------------------------------------------- אפריקה

const AFRICA = [
  ['nigeria', 'ניגריה', () => vBody('#008751', '#ffffff', '#008751')],
  ['morocco', 'מרוקו', () => rect(0, 0, W, H, '#c1272d')
    + `<polygon points="${[0, 1, 2, 3, 4].map((i) => {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      return `${(W / 2 + 95 * Math.cos(a)).toFixed(1)},${(H / 2 + 95 * Math.sin(a)).toFixed(1)}`;
    }).join(' ')}" fill="none" stroke="#006233" stroke-width="12"/>`],
  ['south-africa', 'דרום אפריקה', () => {
    const vertex = W * 0.36;
    const arm = (color, width) =>
      line(0, H / 2, vertex, H / 2, color, width) +
      line(vertex, H / 2, W + 40, -30, color, width) +
      line(vertex, H / 2, W + 40, H + 30, color, width);
    return rect(0, 0, W, H / 2, '#de3831') + rect(0, H / 2, W, H / 2, '#002395')
      + arm('#ffffff', 104) + arm('#007a4d', 60)
      + poly([[0, 0], [W * 0.3, H / 2], [0, H]], '#ffb612')
      + poly([[0, 26], [W * 0.252, H / 2], [0, H - 26]], '#000000');
  }],
  ['ethiopia', 'אתיופיה', () => hBody('#078930', '#fcdd09', '#da121a')
    + circle(W / 2, H / 2, 82, '#0f47af') + star(W / 2, H / 2, 54, '#fcdd09')],
  ['ghana', 'גאנה', () => hBody('#ce1126', '#fcd116', '#006b3f')
    + star(W / 2, H / 2, 54, '#000000')],
  ['mali', 'מאלי', () => vBody('#14b53a', '#fcd116', '#ce1126')],
  ['guinea', 'גינאה', () => vBody('#ce1126', '#fcd116', '#009460')],
  ['senegal', 'סנגל', () => vBody('#00853f', '#fdef42', '#e31b23')
    + star(W / 2, H / 2, 58, '#00853f')],
  ['ivory-coast', 'חוף השנהב', () => vBody('#f77f00', '#ffffff', '#009e60')],
  ['cameroon', 'קמרון', () => vBody('#007a5e', '#ce1126', '#fcd116')
    + star(W / 2, H / 2, 56, '#fcd116')],
  ['chad', 'צ׳אד', 'צאד', () => vBody('#002664', '#fecb00', '#c60c30')],
  ['libya', 'לוב', () => bandsBody([['#e70013', 1], ['#000000', 2], ['#239e46', 1]])
    + crescentStar(W * 0.47, H / 2, 52, '#ffffff', 28)],
  ['sudan', 'סודאן', () => hBody('#d21034', '#ffffff', '#000000')
    + hoistTriangle('#007229', W * 0.38)],
  ['tunisia', 'תוניסיה', () => rect(0, 0, W, H, '#e70013') + circle(W / 2, H / 2, 96, '#ffffff')
    + crescentStar(W / 2, H / 2, 58, '#e70013', 26)],
  ['algeria', 'אלג׳יריה', 'אלג׳יר', () => vBody('#006233', '#ffffff')
    + crescentStar(W / 2, H / 2, 74, '#d21034', 34)],
  ['mauritania', 'מאוריטניה', () => bandsBody([['#d01c1f', 1], ['#00a95c', 6], ['#d01c1f', 1]])
    + crescent(W / 2, H / 2 + 30, 82, '#ffd700', -Math.PI / 2)
    + star(W / 2, H * 0.38, 30, '#ffd700')],
  ['somalia', 'סומליה', () => rect(0, 0, W, H, '#4189dd') + star(W / 2, H / 2, 105, '#ffffff')],
  ['botswana', 'בוטסואנה', () => bandsBody([['#75aadb', 4], ['#ffffff', 1], ['#000000', 2], ['#ffffff', 1], ['#75aadb', 4]])],
  ['gabon', 'גבון', () => hBody('#009e60', '#fcd116', '#3a75c4')],
  ['sierra-leone', 'סיירה לאון', () => hBody('#1eb53a', '#ffffff', '#0072c6')],
  ['tanzania', 'טנזניה', () => rect(0, 0, W, H, '#1eb53a')
    + poly([[W, H], [W, 0], [0, H]], '#00a3dd')
    + diagonalBand('#fcd116', 118) + diagonalBand('#000000', 78)],
  ['congo', 'קונגו', () => rect(0, 0, W, H, '#009543')
    + poly([[W, 0], [W, H], [0, H]], '#dc241f') + diagonalBand('#fbde4a', 96)],
  ['burkina-faso', 'בורקינה פאסו', () => hBody('#ef2b2d', '#009e49')
    + star(W / 2, H / 2, 58, '#fcd116')],
  ['niger', 'ניז׳ר', () => hBody('#e05206', '#ffffff', '#0db02b')
    + circle(W / 2, H / 2, 48, '#e05206')],
  ['benin', 'בנין', () => rect(0, 0, W, H, '#008751')
    + rect(W * 0.4, 0, W * 0.6, H / 2, '#fcd116') + rect(W * 0.4, H / 2, W * 0.6, H / 2, '#e8112d')],
  ['togo', 'טוגו', () => stripesBody(5, '#006a4e', '#ffce00') + canton('#d21034', W * 0.4, H * 0.6)
    + star(W * 0.2, H * 0.3, 52, '#ffffff')],
  ['madagascar', 'מדגסקר', () => rect(0, 0, W, H, '#ffffff')
    + rect(W * 0.33, 0, W * 0.67, H / 2, '#fc3d32') + rect(W * 0.33, H / 2, W * 0.67, H / 2, '#007e3a')],
];

// -------------------------------------------------------------------- אמריקה

const AMERICAS = [
  ['united-states', 'ארצות הברית', 'אמריקה', () => {
    let body = stripesBody(13, '#b31942', '#ffffff');
    const cantonW = W * 0.42;
    const cantonH = (H / 13) * 7;
    body += canton('#0a3161', cantonW, cantonH);
    // תשע שורות מתחלפות של שישה וחמישה כוכבים — חמישים בסך הכול
    for (let row = 0; row < 9; row += 1) {
      const count = row % 2 === 0 ? 6 : 5;
      const gap = cantonW / 6;
      for (let col = 0; col < count; col += 1) {
        body += star(gap * (col + 0.5) + (count === 5 ? gap / 2 : 0),
          (cantonH / 9) * (row + 0.5), 11, '#ffffff');
      }
    }
    return body;
  }],
  ['canada', 'קנדה', () => rect(0, 0, W, H, '#ffffff')
    + rect(0, 0, 150, H, '#d52b1e') + rect(W - 150, 0, 150, H, '#d52b1e')
    + mapleLeaf(W / 2, H / 2, 1.5, '#d52b1e')],
  ['brazil', 'ברזיל', () => rect(0, 0, W, H, '#009b3a')
    + poly([[W / 2, 40], [W - 60, H / 2], [W / 2, H - 40], [60, H / 2]], '#fedf00')
    + circle(W / 2, H / 2, 75, '#002776')],
  ['argentina', 'ארגנטינה', () => bandsBody([['#74acdf', 1], ['#ffffff', 1], ['#74acdf', 1]])
    + sun(W / 2, H / 2, 30, '#f6b40e', 16, 1.9)],
  ['chile', 'צ׳ילה', 'צילה', () => rect(0, 0, W, H, '#ffffff') + rect(0, H / 2, W, H / 2, '#d52b1e')
    + canton('#0039a6', W / 3, H / 2) + star(W / 6, H / 4, 52, '#ffffff')],
  ['colombia', 'קולומביה', () => bandsBody([['#fcd116', 2], ['#003893', 1], ['#ce1126', 1]])],
  ['peru', 'פרו', () => vBody('#d91023', '#ffffff', '#d91023')],
  ['venezuela', 'ונצואלה', () => hBody('#ffcc00', '#00247d', '#cf142b')
    + Array.from({ length: 8 }, (_, i) => {
      const angle = Math.PI * (1.18 + (i * 0.09));
      return star(W / 2 + 130 * Math.cos(angle), H / 2 + 130 * Math.sin(angle) + 96, 15, '#ffffff');
    }).join('')],
  ['bolivia', 'בוליביה', () => hBody('#d52b1e', '#f9e300', '#007a33')],
  ['uruguay', 'אורוגוואי', () => {
    let body = rect(0, 0, W, H, '#ffffff');
    for (let i = 0; i < 4; i += 1) body += rect(W * 0.44, (H / 9) * (i * 2 + 1), W * 0.56, H / 9, '#0038a8');
    for (let i = 0; i < 2; i += 1) body += rect(0, (H / 9) * (i * 2 + 5), W, H / 9, '#0038a8');
    return body + canton('#ffffff', W * 0.44, (H / 9) * 5) + sun(W * 0.22, (H / 9) * 2.5, 34, '#fcd116', 16, 1.9);
  }],
  ['cuba', 'קובה', () => stripesBody(5, '#002a8f', '#ffffff')
    + hoistTriangle('#cf142b', W * 0.4) + star(W * 0.12, H / 2, 46, '#ffffff')],
  ['puerto-rico', 'פורטו ריקו', () => stripesBody(5, '#ed0000', '#ffffff')
    + hoistTriangle('#0050f0', W * 0.4) + star(W * 0.12, H / 2, 46, '#ffffff')],
  ['dominican-republic', 'הרפובליקה הדומיניקנית', 'דומיניקנית', () => rect(0, 0, W, H, '#002d62')
    + rect(W / 2, 0, W / 2, H / 2, '#ce1126') + rect(0, H / 2, W / 2, H / 2, '#ce1126')
    + crossBody('#ffffff', 62)],
  ['haiti', 'האיטי', () => hBody('#00209f', '#d21034')],
  ['jamaica', 'ג׳מייקה', 'גמייקה', () => rect(0, 0, W, H, '#000000')
    + poly([[0, 0], [W, 0], [W / 2, H / 2]], '#009b3a') + poly([[0, H], [W, H], [W / 2, H / 2]], '#009b3a')
    + line(0, 0, W, H, '#fed100', 66) + line(W, 0, 0, H, '#fed100', 66)],
  ['panama', 'פנמה', () => rect(0, 0, W, H, '#ffffff')
    + rect(W / 2, 0, W / 2, H / 2, '#da121a') + rect(0, H / 2, W / 2, H / 2, '#072357')
    + star(W / 4, H / 4, 52, '#072357') + star((W * 3) / 4, (H * 3) / 4, 52, '#da121a')],
  ['costa-rica', 'קוסטה ריקה', () => bandsBody([['#002b7f', 1], ['#ffffff', 1], ['#ce1126', 2], ['#ffffff', 1], ['#002b7f', 1]])],
  ['honduras', 'הונדורס', () => bandsBody([['#0073cf', 1], ['#ffffff', 1], ['#0073cf', 1]])
    + [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
      .map(([dx, dy]) => star(W / 2 + dx * 56, H / 2 + dy * 42, 22, '#0073cf')).join('')],
  ['guyana', 'גיאנה', () => rect(0, 0, W, H, '#009e49')
    + poly([[0, 0], [W * 0.82, H / 2], [0, H]], '#ffffff')
    + poly([[0, 22], [W * 0.75, H / 2], [0, H - 22]], '#fcd116')
    + poly([[0, 0], [W * 0.3, H / 2], [0, H]], '#000000')
    + poly([[0, 24], [W * 0.25, H / 2], [0, H - 24]], '#ce1126')],
  ['suriname', 'סורינאם', () => bandsBody([['#377e3f', 2], ['#ffffff', 1], ['#b40a2d', 4], ['#ffffff', 1], ['#377e3f', 2]])
    + star(W / 2, H / 2, 58, '#ecc81d')],
  ['bahamas', 'איי בהאמה', 'בהאמה', () => hBody('#00abc9', '#ffc72c', '#00abc9')
    + hoistTriangle('#000000', W * 0.4)],
  ['trinidad', 'טרינידד וטובגו', 'טרינידד', () => rect(0, 0, W, H, '#da1a35')
    + line(0, 0, W, H, '#ffffff', 132) + line(0, 0, W, H, '#000000', 84)],
  ['greenland', 'גרינלנד', () => {
    const cx = W * 0.36;
    const r = 96;
    return rect(0, 0, W, H, '#ffffff') + rect(0, H / 2, W, H / 2, '#d00c33')
      + `<path d="M${cx - r},${H / 2} A${r},${r} 0 0,1 ${cx + r},${H / 2} Z" fill="#d00c33"/>`
      + `<path d="M${cx - r},${H / 2} A${r},${r} 0 0,0 ${cx + r},${H / 2} Z" fill="#ffffff"/>`;
  }],
];

const GROUPS = [
  ['europe', 'אירופה', EUROPE],
  ['asia', 'אסיה', ASIA],
  ['africa', 'אפריקה', AFRICA],
  ['americas', 'אמריקה', AMERICAS],
];

function build() {
  return GROUPS.map(([group, label, entries]) => ({
    id: `flags-${group}`,
    name: `דגלי ${label}`,
    hint: 'איזו מדינה?',
    items: entries.map((entry) => {
      const draw = entry[entry.length - 1];
      return { svg: flag(draw()), answer: entry[1], aliases: entry.slice(2, -1), slug: entry[0] };
    }),
  }));
}

module.exports = { build };
