// audio/AudioEngine.js — Web Audio API context manager. Lazy AudioContext
// (created/resumed on first user gesture, per autoplay policy), a master
// gain → compressor chain, and the two synth primitives every sound module
// builds from: enveloped oscillators and filtered noise bursts. Zero audio files.
// Dependencies: Web Audio API only.

import { SpatialAudio } from './SpatialAudio.js';
import { GunSounds } from './GunSounds.js';
import { ExplosionSounds } from './ExplosionSounds.js';
import { ReloadSounds } from './ReloadSounds.js';
import { FootstepSounds } from './FootstepSounds.js';
import { UIAudio } from './UIAudio.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.5;
    this._noiseBuf = null;

    const unlock = () => {
      this.ensure();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          // Remove all unlock listeners once the context is actually running.
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
          window.removeEventListener('touchstart', unlock);
        });
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // iOS Safari suppresses pointerdown when preventDefault is called on touch
    // events, so we also listen on touchstart (passive — no preventDefault needed).
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  /** Suspend/resume AudioContext when the tab is hidden/shown (saves battery on iOS). */
  _initVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
      }
    });
  }

  /** Instantiate sound modules and link to the game instance. */
  init(game) {
    this._initVisibilityHandler();
    this.spatial = new SpatialAudio(this, game);
    this.gun = new GunSounds(this, this.spatial, game);
    this.explosions = new ExplosionSounds(this, this.spatial, game);
    this.reload = new ReloadSounds(this, game);
    this.footsteps = new FootstepSounds(this, this.spatial, game);
    this.ui = new UIAudio(this, game);
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);

    // 1s of white noise, reused by every noise burst.
    const n = this.ctx.sampleRate;
    this._noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  /**
   * Enveloped oscillator. opts: {type, freq, freqEnd, dur, gain, attack, when, out}
   */
  osc(opts) {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? this.now);
    let o;
    try { o = ctx.createOscillator(); } catch { return; }
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.freq, t0);
    if (opts.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t0 + opts.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.3, t0 + (opts.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g).connect(opts.out || this.master);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.05);
  }

  /**
   * Filtered noise burst. opts: {dur, gain, filterType, freq, freqEnd, q, attack, when, out}
   */
  noise(opts) {
    if (!this.ensure()) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? this.now);
    let src;
    try { src = ctx.createBufferSource(); } catch { return; }
    src.buffer = this._noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filterType || 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), t0 + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.3, t0 + (opts.attack ?? 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(opts.out || this.master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }
}
