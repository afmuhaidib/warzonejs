// combat/FlashbangSystem.js — Tactical flash on T (when the loadout carries
// flash): thrown like a frag but with a short 1.6s fuse and no damage. On pop,
// anything with line of sight inside the radius is blinded — the PLAYER gets a
// white screen wash that decays plus a procedural tinnitus whine; ENEMIES get
// bb.blindTimer, which Perception treats as eyes-closed (and their aim hold
// stops). Facing away halves the effect.
// Dependencies: CollisionMap (LOS), UIAudio (tinnitus), EventBus, utils.

import { Vector2 } from '../utils/Vector2.js';
import { angleDiff } from '../utils/MathUtils.js';

const FUSE = 1.6;
const THROW_SPEED = 520;
const RADIUS = 240;
const BLIND_TIME = 3.4;
const MAX_CARRIED = 2;

export class FlashbangSystem {
  constructor(game) {
    this.game = game;
    this.live = [];
    this.carried = MAX_CARRIED;
    this.playerBlind = 0;    // seconds of white-out remaining
    game.events.on('player:respawned', () => { this.carried = MAX_CARRIED; this.playerBlind = 0; });
  }

  update(dt) {
    const { input, player } = this.game;
    this.playerBlind = Math.max(0, this.playerBlind - dt);

    if (player.alive && this.carried > 0 && this.game.loadout.tactical === 'flash'
      && input.wasPressed('KeyT')) {
      this.carried--;
      const m = this.game.camera.screenToWorld(input.mouse.x, input.mouse.y);
      const a = Math.atan2(m.y - player.pos.y, m.x - player.pos.x);
      this.live.push({ pos: player.pos.clone(), vel: Vector2.fromAngle(a, THROW_SPEED), fuse: FUSE });
    }

    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      this.game.combat.grenades.step(f, dt); // same bounce physics as frags
      f.fuse -= dt;
      if (f.fuse <= 0) {
        this.live.splice(i, 1);
        this.pop(f.pos);
      }
    }
  }

  pop(pos) {
    const game = this.game;
    game.effects.hitSpark(pos.x, pos.y, '#ffffff', 16);
    game.effects.addShake(0.2);
    game.events.emit('explosion', { pos: pos.clone(), radius: 60 }); // small bang
    game.events.emit('sound', { pos: pos.clone(), radius: 800, team: 'player' });

    const col = game.map.collision;

    // Player.
    const p = game.player;
    if (p.alive && p.pos.distanceTo(pos) < RADIUS && col.lineOfSight(pos, p.pos)) {
      const toFlash = Math.atan2(pos.y - p.pos.y, pos.x - p.pos.x);
      const facing = Math.abs(angleDiff(p.angle, toFlash)) < Math.PI / 2;
      this.playerBlind = BLIND_TIME * (facing ? 1 : 0.45);
      if (game.audio) game.audio.ui.tinnitus(this.playerBlind);
    }

    // Enemies.
    for (const e of game.ai.enemies) {
      if (e.pos.distanceTo(pos) > RADIUS || !col.lineOfSight(pos, e.pos)) continue;
      const toFlash = Math.atan2(pos.y - e.pos.y, pos.x - e.pos.x);
      const facing = Math.abs(angleDiff(e.angle, toFlash)) < Math.PI / 2;
      e.bb.blindTimer = BLIND_TIME * (facing ? 1 : 0.5);
      e.bb.awareness = Math.min(e.bb.awareness, 0.6); // they lose the picture
    }
  }

  drawWorld(ctx) {
    for (const f of this.live) {
      ctx.fillStyle = '#9aa3a8';
      ctx.beginPath();
      ctx.arc(f.pos.x, f.pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Screen-space white-out, drawn by UIManager on top of everything. */
  drawScreen(ctx) {
    if (this.playerBlind <= 0) return;
    const a = Math.min(1, this.playerBlind / (BLIND_TIME * 0.6));
    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
