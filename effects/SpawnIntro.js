// effects/SpawnIntro.js — Tactical insertion cinematic played once at match start.
// A helicopter silhouette flies in, squad fast-ropes down, then control returns.
// Blocks player input for ~2.8s. Purely visual — no game state changes.

const TOTAL_DURATION = 2.8;
const HELO_ENTER_T   = 0.0;  // helo flies in from top-right
const ROPE_DROP_T    = 0.9;  // ropes extend
const LAND_T         = 1.6;  // soldiers land
const FADE_T         = 2.2;  // helo exits, fade to gameplay
const MONO = '"Courier New", monospace';

export class SpawnIntro {
  constructor() {
    this.active   = false;
    this.timer    = 0;
    this._onDone  = null;
  }

  play(onDone) {
    this.active  = true;
    this.timer   = 0;
    this._onDone = onDone;
  }

  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    if (this.timer >= TOTAL_DURATION) {
      this.active = false;
      this._onDone?.();
    }
  }

  // Called inside camera transform so coords are world-space
  drawWorld(ctx, spawnPos) {
    if (!this.active) return;
    const t = this.timer;
    const px = spawnPos.x;
    const py = spawnPos.y;

    // --- Helicopter ---
    // Enters from off-screen upper-right, slows to hover above spawn
    const heloProgress = Math.min(1, (t - HELO_ENTER_T) / 0.7);
    const eased = 1 - Math.pow(1 - heloProgress, 3); // ease-out cubic
    const heloStartX = px + 600, heloStartY = py - 500;
    const heloEndX   = px,       heloEndY   = py - 220;
    const hx = heloStartX + (heloEndX - heloStartX) * eased;
    const hy = heloStartY + (heloEndY - heloStartY) * eased;

    if (t < FADE_T + 0.3) {
      ctx.save();
      ctx.translate(hx, hy);
      // Rotor blur ring
      const rotorSpin = t * 18;
      for (let i = 0; i < 3; i++) {
        const a = rotorSpin + (i * Math.PI * 2 / 3);
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(80, 80, 80, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 52, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Body
      ctx.fillStyle = '#1a1e14';
      ctx.strokeStyle = '#3a4030';
      ctx.lineWidth = 2;
      // Fuselage
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tail boom
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.lineTo(60, -6);
      ctx.lineTo(60, 2);
      ctx.lineTo(28, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Tail rotor
      ctx.fillStyle = 'rgba(80,80,80,0.4)';
      ctx.beginPath();
      ctx.ellipse(60, -2, 14, 3, Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      // Cockpit window
      ctx.fillStyle = 'rgba(80, 180, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(-14, -4, 12, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- Fast-ropes ---
    if (t >= ROPE_DROP_T && t < FADE_T + 0.2) {
      const ropeT = Math.min(1, (t - ROPE_DROP_T) / 0.5);
      const ropeOffsets = [-28, 0, 28];
      for (const rx of ropeOffsets) {
        const ropeLen = (py - 60 - hy) * ropeT;
        ctx.save();
        ctx.strokeStyle = '#8a7a5a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hx + rx, hy + 14);
        ctx.lineTo(hx + rx, hy + 14 + ropeLen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // --- Soldiers landing ---
    if (t >= LAND_T) {
      const landT = Math.min(1, (t - LAND_T) / 0.4);
      const offsets = [{ x: -60, y: -40 }, { x: 60, y: -40 }, { x: 0, y: -80 }];
      for (const off of offsets) {
        const tx = px + off.x;
        const ty = py + off.y;
        const ropeY = hx + 0; // just draw at landing pos
        const alpha = Math.min(1, landT * 2);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(tx, ty);
        // Drop dust
        if (landT < 0.6) {
          ctx.fillStyle = `rgba(140, 130, 100, ${(0.6 - landT) * 0.6})`;
          ctx.beginPath();
          ctx.ellipse(0, 6, 16 * landT, 5 * landT, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        // Soldier body
        ctx.fillStyle = '#2a5c26';
        ctx.strokeStyle = '#0d1a0a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4a7c3f';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Called in screen-space (outside camera) for the overlay fade
  drawScreen(ctx, W, H) {
    if (!this.active) return;
    const t = this.timer;

    // Opening black fade-in
    if (t < 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Closing fade-out
    if (t > FADE_T) {
      const ft = (t - FADE_T) / (TOTAL_DURATION - FADE_T);
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, ft)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // "INSERTION" text
    if (t > 0.3 && t < FADE_T) {
      const alpha = t < 0.6 ? (t - 0.3) / 0.3 : t > FADE_T - 0.3 ? (FADE_T - t) / 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.font = `bold 18px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#d65c32';
      ctx.fillText('— TACTICAL INSERTION —', 28, H - 32);
      ctx.font = `11px ${MONO}`;
      ctx.fillStyle = '#8d957f';
      ctx.fillText('SQUAD DEPLOYED', 28, H - 16);
      ctx.restore();
    }
  }
}
