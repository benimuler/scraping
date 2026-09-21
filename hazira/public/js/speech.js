'use strict';

/**
 * speech.js — האזנה חיה למיקרופון של הטלפון דרך Web Speech API.
 *
 * הדפדפן מזרים תמלול ביניים תוך כדי דיבור, ואנחנו שולחים אותו לשרת בקצב מרוסן.
 * השרת הוא זה שמכריע אם נאמרה התשובה — כך שני הטלפונים נשפטים באותה אמת מידה
 * ואי אפשר לרמות מצד הלקוח.
 *
 * מגבלות שחשוב להכיר:
 *  - נתמך בכרום/אדג' (כולל אנדרואיד) ובספארי מ-iOS 14.5, לא בפיירפוקס.
 *  - דורש HTTPS או localhost. ברשת מקומית ב-HTTP המיקרופון ייחסם — ולכן יש
 *    תמיד גם שדה הקלדה כגיבוי מלא.
 *  - הדפדפן עוצר את ההאזנה אחרי שקט; אנחנו מפעילים אותה מחדש אוטומטית.
 */

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = !!Recognition;

export function createListener({ lang = 'he-IL', onTranscript, onState, throttleMs = 120 } = {}) {
  if (!Recognition) {
    return {
      supported: false,
      start() { onState?.('unsupported'); },
      stop() {},
      reset() {},
      get listening() { return false; },
    };
  }

  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let wantListening = false;
  let listening = false;
  let restarting = false;
  let lastSentAt = 0;
  let lastSent = '';
  let pending = null;

  const collect = (results) => {
    let text = '';
    for (let i = 0; i < results.length; i++) text += ` ${results[i][0].transcript}`;
    return text.trim();
  };

  const emit = (text, isFinal) => {
    if (!text) return;
    if (text === lastSent && !isFinal) return;
    lastSent = text;
    onTranscript?.(text, isFinal);
  };

  recognition.onresult = (event) => {
    const results = event.results;
    const isFinal = results[results.length - 1]?.isFinal ?? false;

    if (isFinal) {
      clearTimeout(pending);
      pending = null;
      lastSentAt = Date.now();
      emit(collect(results), true);
      return;
    }

    // תמלול ביניים — מרוסן, אחרת נציף את השרת בעשרות הודעות בשנייה
    const since = Date.now() - lastSentAt;
    if (since >= throttleMs) {
      lastSentAt = Date.now();
      emit(collect(results), false);
    } else if (!pending) {
      pending = setTimeout(() => {
        pending = null;
        lastSentAt = Date.now();
        emit(collect(results), false);
      }, throttleMs - since);
    }
  };

  recognition.onstart = () => {
    listening = true;
    restarting = false;
    onState?.('listening');
  };

  recognition.onend = () => {
    listening = false;
    if (!wantListening) return onState?.('idle');
    // כרום עוצר אחרי שקט, ו-reset עוצר בכוונה — בשני המקרים ממשיכים להאזין
    setTimeout(() => {
      if (!wantListening) return;
      try { recognition.start(); } catch { /* כבר רץ */ }
    }, 120);
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      wantListening = false;
      onState?.('denied');
      return;
    }
    onState?.(`error:${event.error}`);
  };

  return {
    supported: true,

    start() {
      wantListening = true;
      if (listening) return;
      try { recognition.start(); } catch { /* כבר רץ */ }
    },

    stop() {
      wantListening = false;
      clearTimeout(pending);
      pending = null;
      lastSent = '';
      try { recognition.abort(); } catch { /* כבר עצור */ }
    },

    /**
     * מנקה את מה שנאמר עד כה — נקרא בכל תמונה חדשה, כדי שתשובה לתמונה הקודמת
     * לא תיזקף לתמונה הנוכחית. abort מוחק את מאגר התוצאות, ו-onend מפעיל מחדש.
     */
    reset() {
      clearTimeout(pending);
      pending = null;
      lastSent = '';
      if (!wantListening || restarting) return;
      restarting = true;
      try { recognition.abort(); } catch { restarting = false; }
    },

    get listening() { return listening; },
  };
}
