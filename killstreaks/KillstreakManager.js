// killstreaks/KillstreakManager.js — Tracks the current no-death kill streak,
// banks rewards at 3 (UAV), 5 (airstrike), 7 (sentry), and triggers them on
// keys 4/5/6. Earned rewards survive death (classic CoD banking); the streak
// counter itself resets when you die. Owns the UAV timer, the airstrike
// caller, and all placed sentries.
// Dependencies: UAVSystem, AirstrikeCaller, SentryGun, EventBus.

import { UAVSystem } from './UAVSystem.js';
import { AirstrikeCaller } from './AirstrikeCaller.js';
import { SentryGun } from './SentryGun.js';

export const STREAKS = [
  { id: 'uav', name: 'UAV', kills: 3, key: 'Digit4', label: '4' },
  { id: 'airstrike', name: 'AIRSTRIKE', kills: 5, key: 'Digit5', label: '5' },
  { id: 'sentry', name: 'SENTRY GUN', kills: 7, key: 'Digit6', label: '6' },
];

export class KillstreakManager {
  constructor(game) {
    this.game = game;
    this.streak = 0;
    this.earned = new Set();   // banked, unused rewards
    this.uav = new UAVSystem(game);
    this.airstrike = new AirstrikeCaller(game);
    this.sentries = [];

    game.events.on('enemy:killed', ({ by }) => {
      if (!by || by.team !== 'player') return;
      this.streak++;
      for (const s of STREAKS) {
        if (this.streak === s.kills && !this.earned.has(s.id)) {
          this.earned.add(s.id);
          game.events.emit('killstreak:earned', { id: s.id, name: s.name });
        }
      }
    });
    game.events.on('player:died', () => { this.streak = 0; });
  }

  update(dt) {
    const game = this.game;

    // Activation keys.
    if (game.player.alive) {
      for (const s of STREAKS) {
        if (this.earned.has(s.id) && game.input.wasPressed(s.key)) {
          this.earned.delete(s.id);
          this.trigger(s.id);
        }
      }
    }

    this.uav.update(dt);
    this.airstrike.update(dt);
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      this.sentries[i].update(dt);
      if (this.sentries[i].dead) this.sentries.splice(i, 1);
    }
  }

  trigger(id) {
    const game = this.game;
    if (id === 'uav') this.uav.activate();
    else if (id === 'airstrike') this.airstrike.activate();
    else if (id === 'sentry') {
      const pos = game.player.pos.clone();
      pos.x += Math.cos(game.player.angle) * 36;
      pos.y += Math.sin(game.player.angle) * 36;
      if (!game.map.collision.circleHits(pos.x, pos.y, 12)) {
        this.sentries.push(new SentryGun(game, pos, game.player.angle));
      } else {
        this.sentries.push(new SentryGun(game, game.player.pos, game.player.angle));
      }
    }
  }

  drawWorld(ctx) {
    for (const s of this.sentries) s.draw(ctx);
    this.airstrike.drawWorld(ctx);
  }

  drawScreen(ctx) {
    this.airstrike.drawScreen(ctx, this.game);
  }
}
