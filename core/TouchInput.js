// core/TouchInput.js — Dual-stick virtual gamepad for touch (iPhone/Android).
// Left half: floating joystick for movement.
// Right half: drag-to-aim + tap-to-fire; dedicated fire button at bottom-right.
// Exposes the same interface PlayerController/PlayerCombat expect on game.touch.

export class TouchInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.game = null; // set by Game after construction
    this.active = false;
    this._safeAreaBottom = 0; // cached at resize, not read per-frame
    this._updateSafeArea();
    window.addEventListener('resize', () => this._updateSafeArea(), { passive: true });

    // Public interface consumed by game systems
    this.moveVec    = { x: 0, y: 0 };  // normalised [-1,1]
    this.aimAngle   = null;             // radians, world-space aim (set by PlayerController)
    this.firing     = false;
    this.firePressed= false;
    this.sprint     = false;
    this.reload     = false;
    this.reloadPressed = false;
    this.grenade    = false;
    this.grenadePressed = false;

    // Internal joystick state
    this._stick = { id: null, originX: 0, originY: 0, x: 0, y: 0 };
    this._RADIUS = 56; // joystick outer radius px

    // Right-side aim drag state
    this._aim = { id: null, lastX: 0, lastY: 0, startX: 0, startY: 0 };
    this._aimDelta = { x: 0, y: 0 }; // accumulated this frame, consumed by PlayerController

    // Sprint: double-tap joystick within 300ms
    this._lastStickTap = 0;

    // On-screen button touch ids
    this._fireId    = null;
    this._reloadId  = null;
    this._grenadeId = null;

    this._addListeners();
  }

  // --- geometry helpers --------------------------------------------------

  _updateSafeArea() {
    this._safeAreaBottom = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'
    ) || 0;
  }

  _isLeftSide(x) {
    // Use canvas CSS width so notch area on iPhone landscape is excluded.
    const w = this.canvas ? this.canvas.width : window.innerWidth;
    return x < w / 2;
  }

  _inButton(x, y, btn) {
    return Math.hypot(x - btn.cx, y - btn.cy) < btn.r;
  }

  // Button layout — uses cached safe-area value, not getComputedStyle per frame
  _layout() {
    const W = this.canvas ? this.canvas.width : window.innerWidth;
    const H = this.canvas ? this.canvas.height : window.innerHeight;
    const bottom = H - 20 - this._safeAreaBottom;
    return {
      fire:    { cx: W - 64,  cy: bottom - 0,   r: 44 },
      reload:  { cx: W - 150, cy: bottom - 30,  r: 36 },
      grenade: { cx: W - 215, cy: bottom - 60,  r: 36 },
    };
  }

  // --- event handling ----------------------------------------------------

  _addListeners() {
    const el = this.canvas.el;

    el.addEventListener('touchstart',  (e) => { e.preventDefault(); this._onStart(e); },  { passive: false });
    el.addEventListener('touchmove',   (e) => { e.preventDefault(); this._onMove(e); },   { passive: false });
    el.addEventListener('touchend',    (e) => { e.preventDefault(); this._onEnd(e); },    { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); this._onEnd(e); },    { passive: false });
  }

  _isGameplay() {
    return this.game && this.game.state === 'playing';
  }

  // In non-gameplay states, forward touches as synthetic mouse events so menus work.
  _forwardAsMouse(e, type) {
    if (!this.game) return;
    const input = this.game.input;
    const t = e.changedTouches[0];
    if (!t) return;
    input.mouse.x = t.clientX;
    input.mouse.y = t.clientY;
    if (type === 'start') {
      input.mouse.left = true;
      input.mouse.leftPressed = true;
    } else if (type === 'end') {
      input.mouse.left = false;
    }
  }

  _onStart(e) {
    if (!this._isGameplay()) {
      this._forwardAsMouse(e, 'start');
      return;
    }
    this.active = true;
    const btns = this._layout();

    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;

      // Fire button
      if (this._inButton(x, y, btns.fire)) {
        this._fireId = t.identifier;
        this.firing = true;
        this.firePressed = true;
        continue;
      }
      // Reload button
      if (this._inButton(x, y, btns.reload)) {
        this._reloadId = t.identifier;
        this.reload = true;
        this.reloadPressed = true;
        continue;
      }
      // Grenade button
      if (this._inButton(x, y, btns.grenade)) {
        this._grenadeId = t.identifier;
        this.grenade = true;
        this.grenadePressed = true;
        continue;
      }

      if (this._isLeftSide(x)) {
        // Floating joystick — detect double-tap for sprint
        const now = Date.now();
        if (this._stick.id === null) {
          if (now - this._lastStickTap < 300) this.sprint = true;
          this._lastStickTap = now;
          this._stick.id = t.identifier;
          this._stick.originX = x;
          this._stick.originY = y;
          this._stick.x = x;
          this._stick.y = y;
        }
      } else {
        // Right side aim drag
        if (this._aim.id === null) {
          this._aim.id = t.identifier;
          this._aim.lastX = x;
          this._aim.lastY = y;
          this._aim.startX = x;
          this._aim.startY = y;
        }
      }
    }
  }

  _onMove(e) {
    if (!this._isGameplay()) {
      this._forwardAsMouse(e, 'move');
      return;
    }
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;

      if (t.identifier === this._stick.id) {
        this._stick.x = x;
        this._stick.y = y;
        // Cancel sprint if stick drops back near center (dead zone)
        const dx = x - this._stick.originX, dy = y - this._stick.originY;
        if (Math.hypot(dx, dy) < this._RADIUS * 0.15) this.sprint = false;
      } else if (t.identifier === this._aim.id) {
        this._aimDelta.x += x - this._aim.lastX;
        this._aimDelta.y += y - this._aim.lastY;
        this._aim.lastX = x;
        this._aim.lastY = y;
      }
    }
  }

  _onEnd(e) {
    if (!this._isGameplay()) {
      this._forwardAsMouse(e, 'end');
      return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === this._fireId) {
        this._fireId = null;
        this.firing = false;
      } else if (t.identifier === this._reloadId) {
        this._reloadId = null;
        this.reload = false;
      } else if (t.identifier === this._grenadeId) {
        this._grenadeId = null;
        this.grenade = false;
      } else if (t.identifier === this._stick.id) {
        this._stick.id = null;
        this.moveVec.x = 0;
        this.moveVec.y = 0;
        this.sprint = false;
      } else if (t.identifier === this._aim.id) {
        this._aim.id = null;
      }
    }

    // If no touches remain, force-clear all state (handles edge cases like
    // touchcancel dropping all fingers without individual touchend events)
    if (e.touches.length === 0) {
      this.active = false;
      this.moveVec.x = 0;
      this.moveVec.y = 0;
      this.firing = false;
      this.sprint = false;
      this._stick.id = null;
      this._aim.id = null;
      this._fireId = null;
      this._reloadId = null;
      this._grenadeId = null;
    }
  }

  // --- per-frame update (call before game update) -------------------------

  update() {
    // Joystick vector
    if (this._stick.id !== null) {
      this.active = true;
      const dx = this._stick.x - this._stick.originX;
      const dy = this._stick.y - this._stick.originY;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, this._RADIUS);
      this.moveVec.x = (clamped > 2 && len > 0) ? (dx / len) * (clamped / this._RADIUS) : 0;
      this.moveVec.y = (clamped > 2 && len > 0) ? (dy / len) * (clamped / this._RADIUS) : 0;
    }
  }

  // Consume accumulated aim delta this frame — returns {x,y}
  consumeAimDelta() {
    const d = { x: this._aimDelta.x, y: this._aimDelta.y };
    this._aimDelta.x = 0;
    this._aimDelta.y = 0;
    return d;
  }

  // Called by Game after each frame to clear edge-triggered flags
  endFrame() {
    this.firePressed = false;
    this.reloadPressed = false;
    this.grenadePressed = false;
  }

  // --- draw virtual controls on canvas -----------------------------------

  draw(ctx, canvasW, canvasH) {
    if (!this._isGameplay()) return;

    ctx.save();
    // Always draw ghost buttons so first-time iPhone players know controls exist.
    // Active touches brighten the relevant button.
    ctx.globalAlpha = 0.55;

    const btns = this._layout();

    // Joystick — show ghost hint when not active so players know where to place thumb
    if (this._stick.id === null) {
      const W = this.canvas ? this.canvas.width : window.innerWidth;
      const H = this.canvas ? this.canvas.height : window.innerHeight;
      const hintX = W * 0.18, hintY = H - 80 - this._safeAreaBottom;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(hintX, hintY, this._RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#aaffaa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hintX, hintY, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,220,100,0.3)';
      ctx.fill();
      ctx.globalAlpha = 0.55;
    }

    if (this._stick.id !== null) {
      const ox = this._stick.originX, oy = this._stick.originY;
      const dx = this._stick.x - ox;
      const dy = this._stick.y - oy;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, this._RADIUS);
      const kx = ox + (len > 0 ? (dx / len) * clamped : 0);
      const ky = oy + (len > 0 ? (dy / len) * clamped : 0);

      // Outer ring
      ctx.beginPath();
      ctx.arc(ox, oy, this._RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = '#aaffaa';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,200,100,0.08)';
      ctx.fill();

      // Knob
      ctx.beginPath();
      ctx.arc(kx, ky, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,220,100,0.5)';
      ctx.fill();
      ctx.strokeStyle = '#aaffaa';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Fire button
    ctx.globalAlpha = this._fireId !== null ? 0.85 : 0.55;
    ctx.beginPath();
    ctx.arc(btns.fire.cx, btns.fire.cy, btns.fire.r, 0, Math.PI * 2);
    ctx.fillStyle = this._fireId !== null ? 'rgba(220,60,40,0.7)' : 'rgba(180,40,20,0.35)';
    ctx.fill();
    ctx.strokeStyle = '#ff5533';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIRE', btns.fire.cx, btns.fire.cy);

    // Reload button
    ctx.globalAlpha = this._reloadId !== null ? 0.85 : 0.5;
    ctx.beginPath();
    ctx.arc(btns.reload.cx, btns.reload.cy, btns.reload.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,120,80,0.4)';
    ctx.fill();
    ctx.strokeStyle = '#88cc88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ccffcc';
    ctx.font = '11px monospace';
    ctx.fillText('R', btns.reload.cx, btns.reload.cy);

    // Grenade button
    ctx.globalAlpha = this._grenadeId !== null ? 0.85 : 0.5;
    ctx.beginPath();
    ctx.arc(btns.grenade.cx, btns.grenade.cy, btns.grenade.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(150,110,20,0.4)';
    ctx.fill();
    ctx.strokeStyle = '#ddaa44';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffdd88';
    ctx.font = '11px monospace';
    ctx.fillText('G', btns.grenade.cx, btns.grenade.cy);

    ctx.restore();
  }
}
