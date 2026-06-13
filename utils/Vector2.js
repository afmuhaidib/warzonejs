// utils/Vector2.js — 2D vector math utility.
// Mutating, chainable API (clone() when you need a copy). Leaf module: no dependencies.

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x, y) { this.x = x; this.y = y; return this; }
  copy(v) { this.x = v.x; this.y = v.y; return this; }
  clone() { return new Vector2(this.x, this.y); }

  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  scale(s) { this.x *= s; this.y *= s; return this; }
  addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; return this; }

  length() { return Math.hypot(this.x, this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }

  normalize() {
    const len = this.length();
    if (len > 1e-8) { this.x /= len; this.y /= len; }
    return this;
  }

  distanceTo(v) { return Math.hypot(v.x - this.x, v.y - this.y); }
  distanceSqTo(v) {
    const dx = v.x - this.x, dy = v.y - this.y;
    return dx * dx + dy * dy;
  }

  angle() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }

  /** Counter-clockwise perpendicular (new vector). */
  perp() { return new Vector2(-this.y, this.x); }

  static fromAngle(a, len = 1) {
    return new Vector2(Math.cos(a) * len, Math.sin(a) * len);
  }
}
