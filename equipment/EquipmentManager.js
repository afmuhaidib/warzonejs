// equipment/EquipmentManager.js — Owns placed equipment entities (claymores,
// ammo crates), per-type placement counts, the MedKit, and the Dead Silence
// field upgrade. Handles the placement keys (7 claymore, 8 crate), ticks and
// draws everything, and exposes a tiny status strip for the HUD.
// Dependencies: Claymore, AmmoCrate, MedKit, DeadSilence.

import { Claymore } from './Claymore.js';
import { AmmoCrate } from './AmmoCrate.js';
import { MedKit } from './MedKit.js';
import { DeadSilence } from './DeadSilence.js';

const MAX_CLAYMORES = 2;
const MAX_CRATES = 1;

export class EquipmentManager {
  constructor(game) {
    this.game = game;
    this.placed = [];
    this.claymoresLeft = MAX_CLAYMORES;
    this.cratesLeft = MAX_CRATES;
    this.medkit = new MedKit(game);
    this.deadSilence = new DeadSilence(game);

    game.events.on('player:respawned', () => {
      this.claymoresLeft = MAX_CLAYMORES;
      this.cratesLeft = MAX_CRATES;
    });
  }

  get deadSilenceActive() {
    return this.deadSilence.active;
  }

  update(dt) {
    const game = this.game;
    const p = game.player;

    if (p.alive) {
      if (game.input.wasPressed('Digit7') && this.claymoresLeft > 0) {
        this.claymoresLeft--;
        const pos = p.pos.clone();
        pos.x += Math.cos(p.angle) * 30;
        pos.y += Math.sin(p.angle) * 30;
        if (!game.map.collision.circleHits(pos.x, pos.y, 8)) {
          this.placed.push(new Claymore(game, pos, p.angle));
        } else {
          this.placed.push(new Claymore(game, p.pos, p.angle));
        }
      }
      if (game.input.wasPressed('Digit8') && this.cratesLeft > 0) {
        this.cratesLeft--;
        this.placed.push(new AmmoCrate(game, p.pos));
      }
    }

    this.medkit.update(dt);
    this.deadSilence.update(dt);
    for (let i = this.placed.length - 1; i >= 0; i--) {
      this.placed[i].update(dt);
      if (this.placed[i].dead) this.placed.splice(i, 1);
    }
  }

  drawWorld(ctx) {
    for (const e of this.placed) e.draw(ctx, this.game);
  }

  /** Equipment status strip, drawn by UIManager bottom-left above health. */
  drawScreen(ctx) {
    const game = this.game;
    const p = game.player;
    if (!p.alive) return;
    const lines = [
      `[7] CLAYMORE ×${this.claymoresLeft}`,
      `[8] AMMO CRATE ×${this.cratesLeft}`,
      `[H] MEDKIT ${this.medkit.healing ? '▮ HEALED' : p.health >= p.maxHealth ? 'FULL' : 'READY'}`,
      `[N] DEAD SILENCE ${this.deadSilence.active ? 'ON' : this.deadSilence.ready ? 'RDY' : Math.ceil(this.deadSilence.cooldown) + 's'}`,
      `[G] FRAG ×${game.combat.grenades.carried}  [T] ${game.loadout.tactical.toUpperCase()} ×${game.loadout.tactical === 'flash' ? game.combat.flash.carried : game.combat.smoke.carried}`,
    ];
    ctx.save();
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    let y = game.canvas.height - 64;
    for (const line of lines.reverse()) {
      ctx.fillStyle = 'rgba(8, 12, 8, 0.5)';
      ctx.fillRect(14, y - 11, ctx.measureText(line).width + 8, 13);
      ctx.fillStyle = '#8d957f';
      ctx.fillText(line, 18, y);
      y -= 14;
    }
    // Medkit progress arc around the crosshair.
    if (this.medkit.healing) {
      const { x, y: my } = game.input.mouse;
      ctx.strokeStyle = '#7ab648';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, my, 24, -Math.PI / 2, -Math.PI / 2 + this.medkit.progress * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
