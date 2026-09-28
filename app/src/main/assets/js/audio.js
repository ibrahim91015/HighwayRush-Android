/* ===== Highway Rush — sound (WebAudio, no assets) =====
 * Engine drone (two oscillators + lowpass, like the original), crash
 * noise burst, level-up blips. The AudioContext is created on the first
 * user gesture (browser autoplay policy). M = mute.
 */
"use strict";

const AudioFX = {
  ctx: null,
  master: null,
  engGain: null,
  engFilter: null,
  osc1: null,
  osc2: null,
  muted: false,
  _attached: false,

  // Attach one-time listeners: unlock audio on the first gesture, M to mute.
  attach() {
    if (this._attached) return;
    this._attached = true;
    window.addEventListener("keydown", (e) => {
      this.unlock();
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "m" || e.key === "M") this.toggleMute();
    });
    window.addEventListener("pointerdown", () => this.unlock());
  },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      // engine: saw + square (octave up) -> lowpass -> gain
      this.engFilter = this.ctx.createBiquadFilter();
      this.engFilter.type = "lowpass";
      this.engFilter.frequency.value = 220;
      this.engGain = this.ctx.createGain();
      this.engGain.gain.value = 0;
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc1.frequency.value = 48;
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "square";
      this.osc2.frequency.value = 96;
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.4;
      this.osc1.connect(this.engFilter);
      this.osc2.connect(g2);
      g2.connect(this.engFilter);
      this.engFilter.connect(this.engGain);
      this.engGain.connect(this.master);
      this.osc1.start();
      this.osc2.start();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  // Continuous engine sound. frac = speed / maxSpeed (0..1).
  engine(frac) {
    if (!this.ctx) return;
    frac = Math.max(0, Math.min(1, frac));
    const t = this.ctx.currentTime;
    const f = 42 + frac * 150;
    this.osc1.frequency.setTargetAtTime(f, t, 0.08);
    this.osc2.frequency.setTargetAtTime(f * 2.02, t, 0.08);
    this.engFilter.frequency.setTargetAtTime(200 + frac * 1400, t, 0.1);
    this.engGain.gain.setTargetAtTime(0.05 + frac * 0.09, t, 0.08);
  },

  engineOff() {
    if (!this.ctx) return;
    this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  },

  // Impact: filtered noise burst + low thump.
  crash() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dur = 0.7;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(2400, ctx.currentTime);
    filt.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start();

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.connect(og);
    og.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  },

  // Short rising blip arpeggio.
  levelUp() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.09;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.16);
    });
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }
};
