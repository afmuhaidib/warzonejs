// animations/AnimationEngine.js — Core keyframe + lerp animation runner.
// Generic: a Keyframes object holds {t, v:{props}, ease} frames sampled at a
// normalized time; an AnimTrack plays one Keyframes over a duration with
// cancel/finish callbacks. All viewmodel motion (reload, swap, melee, ADS…)
// is driven by these — no instant state jumps anywhere.
// Dependencies: utils/MathUtils (lerp).

import { lerp } from '../utils/MathUtils.js';

export const Easing = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 + (--t) * t * t,
  // Overshoot-and-settle: the "snap" feel for mag insertion / weapon raise.
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};

export class Keyframes {
  /** @param {Array<{t:number, v:object, ease?:function}>} frames  sorted by t in [0,1] */
  constructor(frames) {
    this.frames = frames;
  }

  /** Interpolated property bag at normalized time u (0..1). */
  sample(u) {
    const f = this.frames;
    if (u <= f[0].t) return { ...f[0].v };
    if (u >= f[f.length - 1].t) return { ...f[f.length - 1].v };
    let i = 0;
    while (f[i + 1].t < u) i++;
    const a = f[i], b = f[i + 1];
    const ease = b.ease || Easing.inOutQuad;
    const t = ease((u - a.t) / (b.t - a.t));
    const out = {};
    for (const k of Object.keys(b.v)) {
      const av = a.v[k] !== undefined ? a.v[k] : 0;
      out[k] = typeof b.v[k] === 'number' ? lerp(av, b.v[k], t) : b.v[k];
    }
    // Carry properties that only exist on the earlier frame (e.g. flags).
    for (const k of Object.keys(a.v)) if (!(k in out)) out[k] = a.v[k];
    return out;
  }
}

export class AnimTrack {
  constructor() {
    this.keyframes = null;
    this.duration = 0;
    this.time = 0;
    this.playing = false;
    this.onDone = null;
    this.value = {};
  }

  play(keyframes, duration, onDone = null) {
    this.keyframes = keyframes;
    this.duration = duration;
    this.time = 0;
    this.playing = true;
    this.onDone = onDone;
    this.value = keyframes.sample(0);
  }

  cancel() {
    this.playing = false;
    this.value = {};
  }

  get progress() {
    return this.duration > 0 ? Math.min(1, this.time / this.duration) : 1;
  }

  update(dt) {
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) {
      this.value = this.keyframes.sample(1);
      this.playing = false;
      if (this.onDone) this.onDone();
    } else {
      this.value = this.keyframes.sample(this.time / this.duration);
    }
  }
}

/** Critically-damped-ish spring used for recoil recovery and smooth follows. */
export class Spring {
  constructor(stiffness = 120, damping = 14) {
    this.value = 0;
    this.vel = 0;
    this.target = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  kick(impulse) { this.vel += impulse; }

  update(dt) {
    this.vel += (this.target - this.value) * this.stiffness * dt;
    this.vel *= Math.exp(-this.damping * dt);
    this.value += this.vel * dt;
    return this.value;
  }
}
