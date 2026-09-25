'use strict';

/** כלי שרטוט משותפים לכל בוני התוכן. */

const W = 600;
const H = 400;

const svg = (body, { w = W, h = H, bg = '#ffffff' } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
  `<rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;

/**
 * אמוג'י בתוך SVG. הגופן נקבע במכשיר של השחקן — בטלפונים ובמחשבים מודרניים
 * זה נותן אמוג'י צבעוני, ולכן זו הדרך הזולה ביותר לתמונה מזוהה בלי רשת.
 */
const emojiSvg = (glyph, { bg = '#f6f4ef', size = 230 } = {}) => svg(
  `<text x="${W / 2}" y="${H / 2}" font-size="${size}" text-anchor="middle" ` +
  `dominant-baseline="central">${glyph}</text>`,
  { bg },
);

/** טקסט גדול במרכז — לפריטים שהרמז שלהם מילולי. */
const textSvg = (text, { bg = '#101528', color = '#eef2ff', size = 96 } = {}) => {
  const lines = String(text).split('\n');
  const start = H / 2 - ((lines.length - 1) * size * 0.6) / 2;
  const body = lines.map((line, i) =>
    `<text x="${W / 2}" y="${start + i * size * 1.2}" font-size="${size}" fill="${color}" ` +
    `font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle" ` +
    `dominant-baseline="central">${escapeXml(line)}</text>`).join('');
  return svg(body, { bg });
};

const poly = (points, fill) =>
  `<polygon points="${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="${fill}"/>`;

/** כוכב בעל מספר קצוות משתנה. ברירת המחדל חמישה — כמו ברוב הדגלים ובצורות. */
const star = (cx, cy, r, fill, points = 5, rotation = -Math.PI / 2) => {
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.4;
    const angle = rotation + (i * Math.PI) / points;
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return poly(pts, fill);
};

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

module.exports = { W, H, svg, emojiSvg, textSvg, escapeXml, poly, star };
