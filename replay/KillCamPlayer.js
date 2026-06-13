// replay/KillCamPlayer.js — On death: replays the last 3 seconds from the
// killer's point of view. Captures a clip from ReplayBuffer at the moment of
// death, then plays it back with frame interpolation — camera glued to the
// killer's recorded position, ghost figures drawn for everyone (you included),
// letterbox bars + KILLCAM tag on top. Game.render delegates the whole world
// pass to us while active; when the clip ends, SpectateSystem takes over.
// Dependencies: ReplayBuffer, MapRenderer + Camera (via game), utils/MathUtils.

import { lerp } from '../utils/MathUtils.js';

const CLIP_SECONDS = 3;

export class KillCamPlayer {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.clip = null;
    this.killer = null;
    this.playT = 0;

    game.events.on('player:died', ({ killerRef }) => {
      const clip = game.replay.buffer.clip(CLIP_SECONDS);
      if (clip.length < 4 || !killerRef) return; // not enough footage: skip to spectate
      this.active = true;
      this.clip = clip;
      this.killer = killerRef;
      this.playT = clip[0].t;
    });
    game.events.on('player:respawned', () => { this.active = false; });
  }

  update(dt) {
    if (!this.active) return;
    this.playT += dt;
    if (this.playT >= this.clip[this.clip.length - 1].t) this.active = false; // hand off to spectate
  }

  /** Interpolated frame state at the playhead. */
  sample() {
    const c = this.clip;
    let i = 0;
    while (i < c.length - 2 && c[i + 1].t < this.playT) i++;
    const a = c[i], b = c[i + 1];
    const u = Math.max(0, Math.min(1, (this.playT - a.t) / Math.max(1e-6, b.t - a.t)));
    return { a, b, u };
  }

  /** Full-frame render: world from the killer's recorded POV + overlay. */
  draw(ctx) {
    const game = this.game;
    const { a, b, u } = this.sample();

    // Camera follows the killer's recorded position.
    const ka = a.enemies.find((e) => e.ref === this.killer);
    const kb = b.enemies.find((e) => e.ref === this.killer);
    if (ka && kb) {
      game.camera.pos.set(lerp(ka.x, kb.x, u), lerp(ka.y, kb.y, u));
      game.camera.clampToBounds();
    }

    game.camera.begin(ctx);
    game.mapRenderer.draw(ctx, game.camera, game.canvas);

    // Ghost enemies.
    for (const ea of a.enemies) {
      const eb = b.enemies.find((e) => e.ref === ea.ref) || ea;
      this.ghost(ctx, lerp(ea.x, eb.x, u), lerp(ea.y, eb.y, u), lerp(ea.a, eb.a, u),
        ea.ref === this.killer ? '#e04f33' : '#5a4a30');
    }
    // Ghost you.
    if (a.player.alive) {
      this.ghost(ctx, lerp(a.player.x, b.player.x, u), lerp(a.player.y, b.player.y, u),
        lerp(a.player.a, b.player.a, u), '#2e3b27');
    }
    // Recorded bullet streaks.
    ctx.lineWidth = 2;
    for (const bl of a.bullets) {
      ctx.strokeStyle = bl.color;
      ctx.beginPath();
      ctx.moveTo(bl.x - bl.dx * 18, bl.y - bl.dy * 18);
      ctx.lineTo(bl.x, bl.y);
      ctx.stroke();
    }
    game.camera.end(ctx);

    // Letterbox + tag.
    const H = game.canvas.height, W = game.canvas.width;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 46);
    ctx.fillRect(0, H - 46, W, 46);
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e04f33';
    ctx.fillText('● KILLCAM', 18, 24);
    ctx.fillStyle = '#cfd8c2';
    ctx.textAlign = 'right';
    ctx.fillText(this.killer.name || 'HOSTILE', W - 18, 24);
  }

  ghost(ctx, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0d110b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#15170f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(32, 3);
    ctx.stroke();
    ctx.restore();
  }
}
