// ui/InteractPrompt.js — Unified [KEY] prompt above the crosshair zone. Any
// system can request a prompt for the current frame (weapon pickups, S&D
// plant, ammo crates…); the highest-priority one renders with a subtle pulse,
// optionally with a hold-progress ring. Requests clear every frame, so a
// system just calls prompt() while its condition holds.
// Dependencies: none (systems push into it; UIManager draws it).

const MONO = '"Courier New", monospace';

export class InteractPrompt {
  constructor(game) {
    this.game = game;
    this.requests = [];
  }

  /** Call once per frame while interactable. Higher priority wins. */
  prompt(key, text, { priority = 0, progress = null } = {}) {
    this.requests.push({ key, text, priority, progress });
  }

  collect() {
    const game = this.game;
    // Weapon pickup (replaces PlayerHUD's old inline prompt).
    const pickup = game.weapons.nearbyPickup;
    if (pickup) this.prompt('E', `TAKE ${pickup.weapon.name.toUpperCase()}`, { priority: 1 });
    // S&D plant.
    const mode = game.modes.mode;
    if (mode && mode.site && mode.phase === 'search'
      && game.player.pos.distanceTo(mode.site) < 70) {
      this.prompt('E', 'PLANT THE BOMB', {
        priority: 2,
        progress: mode.plantProgress > 0 ? mode.plantProgress / 4 : null,
      });
    }
  }

  draw(ctx) {
    this.collect();
    if (this.requests.length === 0) return;
    this.requests.sort((a, b) => b.priority - a.priority);
    const r = this.requests[0];
    this.requests = [];

    const game = this.game;
    const cx = game.canvas.width / 2;
    const y = game.canvas.height - 96;
    const pulse = 0.8 + Math.sin(game.time * 5) * 0.2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 14px ${MONO}`;
    const text = `[${r.key}] ${r.text}`;
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(8, 12, 8, 0.7)';
    ctx.fillRect(cx - w / 2, y - 14, w, 28);
    ctx.strokeStyle = `rgba(232, 200, 120, ${pulse})`;
    ctx.strokeRect(cx - w / 2, y - 14, w, 28);
    ctx.fillStyle = '#e8c878';
    ctx.fillText(text, cx, y);

    if (r.progress !== null && r.progress > 0) {
      ctx.fillStyle = 'rgba(30, 36, 28, 1)';
      ctx.fillRect(cx - w / 2, y + 17, w, 5);
      ctx.fillStyle = '#e8c878';
      ctx.fillRect(cx - w / 2, y + 17, w * Math.min(1, r.progress), 5);
    }
    ctx.restore();
  }
}
