'use strict';

/** ערבוב Fisher–Yates על עותק, עם מקור אקראיות מוזרק (לטובת בדיקות דטרמיניסטיות). */
function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { shuffle };
