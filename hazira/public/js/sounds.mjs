// Original synthesized game cues. No downloaded recordings or third-party assets.
export function createSounds({ storage = globalThis.localStorage, Audio = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let enabled = true;
  try { enabled = storage?.getItem('hazira:sound') !== 'off'; } catch {}
  let ctx = null;
  const notes = {
    correct: [[660,0,.09],[880,.09,.13]], wrong: [[190,0,.12],[140,.12,.15]],
    turn: [[520,0,.1],[780,.1,.1]], tick: [[620,0,.06]],
    start: [[440,0,.1],[660,.12,.1],[880,.24,.2]],
    win: [[523,0,.12],[659,.13,.12],[784,.26,.12],[1047,.4,.25]],
    lose: [[392,0,.16],[330,.18,.16],[262,.36,.25]],
  };
  function unlock() {
    if (!enabled || !Audio) return;
    try { ctx ||= new Audio(); const pending = ctx.resume(); pending?.catch?.(()=>{}); } catch {}
  }
  function play(name) {
    if (!enabled || !ctx || ctx.state !== 'running') return false;
    try {
      for (const [hz, delay, duration] of notes[name] || []) {
        const o=ctx.createOscillator(), g=ctx.createGain(), at=ctx.currentTime+delay;
        o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,at);
        g.gain.linearRampToValueAtTime(.075,at+.012);
        g.gain.exponentialRampToValueAtTime(.001,at+duration);
        o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+duration+.02);
      }
      return true;
    } catch { return false; }
  }
  return { unlock, play, get enabled(){return enabled;}, setEnabled(value){enabled=!!value;try{storage?.setItem('hazira:sound',enabled?'on':'off');}catch{}if(enabled)unlock();} };
}
