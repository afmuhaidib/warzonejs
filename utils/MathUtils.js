// utils/MathUtils.js — Scalar math helpers: clamping, interpolation, angles, RNG.
// Leaf module: no dependencies.

export const TAU = Math.PI * 2;

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Random float in [min, max). */
export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max] inclusive. */
export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Wrap an angle to (-PI, PI]. */
export function normalizeAngle(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

/** Signed shortest rotation from a to b. */
export function angleDiff(a, b) {
  return normalizeAngle(b - a);
}

/** Lerp between angles along the shortest arc. */
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}

/** Cheap zero-mean noise in (-1, 1), bell-ish distribution. Used for aim error. */
export function gaussian() {
  return (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
}

/** Deterministic seeded RNG (mulberry32). Returns a function yielding [0, 1). */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
