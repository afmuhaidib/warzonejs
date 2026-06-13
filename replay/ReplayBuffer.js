// replay/ReplayBuffer.js — Rolling 5-second ring buffer of entity state,
// sampled at 20 Hz: player + every enemy's position/angle/state plus live
// bullet streaks. The KillCamPlayer interpolates between these frames to
// replay a death from the killer's point of view.
// Dependencies: snapshots game state only.

const RATE = 1 / 20;     // 20 Hz
const SECONDS = 5;
const CAPACITY = Math.ceil(SECONDS / RATE);

export class ReplayBuffer {
  constructor(game) {
    this.game = game;
    this.frames = [];
    this.acc = 0;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < RATE) return;
    this.acc = 0;

    const game = this.game;
    const frame = {
      t: game.time,
      player: {
        x: game.player.pos.x, y: game.player.pos.y,
        a: game.player.angle, alive: game.player.alive,
        crouch: game.player.crouching || game.player.prone,
      },
      enemies: game.ai.enemies.map((e) => ({
        ref: e, x: e.pos.x, y: e.pos.y, a: e.angle, state: e.state,
      })),
      bullets: game.bullets.active.map((b) => ({ x: b.x, y: b.y, dx: b.dx, dy: b.dy, color: b.color })),
    };
    this.frames.push(frame);
    if (this.frames.length > CAPACITY) this.frames.shift();
  }

  /** Frames covering the last `seconds` before now (used at the moment of death). */
  clip(seconds) {
    const cutoff = this.game.time - seconds;
    return this.frames.filter((f) => f.t >= cutoff);
  }

  clear() {
    this.frames = [];
  }
}
