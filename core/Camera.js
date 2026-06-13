// core/Camera.js — World-space camera with configurable follow speed, smooth
// zoom, aim lead, screen shake, and world<->screen conversion.
//
// Public knobs (set any time):
//   camera.followSpeed   — exponential-smoothing rate (default 6; higher = snappier)
//   camera.lead.factor   — how far toward the cursor to offset the view (default 0.35)
//   camera.lead.maxDist  — world-pixel cap on lead offset (default 220)
//   camera.zoomSpeed     — how fast targetZoom is reached (default 8)
//   camera.targetZoom    — request a zoom level; camera lerps toward it each frame
//   camera.shakeX/Y      — set each frame by EffectsManager.ScreenShake
//
// Dependencies: utils/Vector2, utils/MathUtils.

import { Vector2 } from '../utils/Vector2.js';
import { clamp, lerp } from '../utils/MathUtils.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.pos = new Vector2(); // world point at screen center

    // Follow
    this.followSpeed = 6;    // exponential-smooth rate

    // Aim lead
    this.lead = { factor: 0.35, maxDist: 220 };

    // Zoom — callers write targetZoom; camera drives zoom toward it
    this.targetZoom = 1;
    this.zoom       = 1;
    this.zoomSpeed  = 8;

    // Shake — written each frame by EffectsManager
    this.shakeX = 0;
    this.shakeY = 0;

    this.worldW = Infinity;
    this.worldH = Infinity;
  }

  // ---------------------------------------------------------------------------
  // Configuration helpers

  /** Snap-configure follow + lead in one call (optional convenience). */
  configure({ followSpeed, leadFactor, leadMaxDist, zoomSpeed } = {}) {
    if (followSpeed  !== undefined) this.followSpeed       = followSpeed;
    if (leadFactor   !== undefined) this.lead.factor       = leadFactor;
    if (leadMaxDist  !== undefined) this.lead.maxDist      = leadMaxDist;
    if (zoomSpeed    !== undefined) this.zoomSpeed         = zoomSpeed;
  }

  // ---------------------------------------------------------------------------
  // Bounds

  /** Visible world size accounting for zoom. */
  get viewWidth()  { return this.canvas.width  / this.zoom; }
  get viewHeight() { return this.canvas.height / this.zoom; }

  get viewLeft() { return this.pos.x - this.viewWidth  / 2; }
  get viewTop()  { return this.pos.y - this.viewHeight / 2; }

  setBounds(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;
  }

  // ---------------------------------------------------------------------------
  // Per-frame update — replaces the manual lead math that used to live in Game.js.
  // Pass the player position and current mouse world position.
  update(dt, playerPos, mouseWorldPos) {
    // Smooth zoom toward target
    const zt = 1 - Math.exp(-this.zoomSpeed * dt);
    this.zoom += (this.targetZoom - this.zoom) * zt;

    // Compute aim-lead offset: push the view toward the cursor
    const rawX = (mouseWorldPos.x - playerPos.x) * this.lead.factor;
    const rawY = (mouseWorldPos.y - playerPos.y) * this.lead.factor;
    const len  = Math.hypot(rawX, rawY);
    const scale = len > this.lead.maxDist ? this.lead.maxDist / len : 1;
    const leadTarget = new Vector2(
      playerPos.x + rawX * scale,
      playerPos.y + rawY * scale,
    );

    // Exponential follow toward lead point
    const ft = 1 - Math.exp(-this.followSpeed * dt);
    this.pos.x += (leadTarget.x - this.pos.x) * ft;
    this.pos.y += (leadTarget.y - this.pos.y) * ft;
    this.clampToBounds();
  }

  // ---------------------------------------------------------------------------
  // Legacy helpers (still used by killcam / respawn)

  /** Exponential smoothing toward an arbitrary target (no lead, no zoom). */
  follow(target, dt) {
    const t = 1 - Math.exp(-this.followSpeed * dt);
    this.pos.x += (target.x - this.pos.x) * t;
    this.pos.y += (target.y - this.pos.y) * t;
    this.clampToBounds();
  }

  snapTo(target) {
    this.pos.copy(target);
    this.clampToBounds();
  }

  clampToBounds() {
    const hw = this.viewWidth  / 2;
    const hh = this.viewHeight / 2;
    if (this.worldW > this.viewWidth) {
      this.pos.x = clamp(this.pos.x, hw, this.worldW - hw);
    } else {
      this.pos.x = this.worldW / 2;
    }
    if (this.worldH > this.viewHeight) {
      this.pos.y = clamp(this.pos.y, hh, this.worldH - hh);
    } else {
      this.pos.y = this.worldH / 2;
    }
  }

  // ---------------------------------------------------------------------------
  // Render transform

  begin(ctx) {
    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(
      Math.round(-this.pos.x + this.shakeX),
      Math.round(-this.pos.y + this.shakeY),
    );
  }

  end(ctx) {
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Coordinate conversion

  screenToWorld(sx, sy) {
    return new Vector2(
      this.pos.x + (sx - this.canvas.width  / 2) / this.zoom,
      this.pos.y + (sy - this.canvas.height / 2) / this.zoom,
    );
  }

  worldToScreen(wx, wy) {
    return new Vector2(
      this.canvas.width  / 2 + (wx - this.pos.x) * this.zoom,
      this.canvas.height / 2 + (wy - this.pos.y) * this.zoom,
    );
  }
}
