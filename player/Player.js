// player/Player.js — Player entity and state (health, stance, score, lifecycle).
// Behavior lives in PlayerController (movement) and PlayerCombat (shooting);
// this module is the data + damage/death/respawn rules.
// Dependencies: utils/Vector2; emits events via the game context.

import { Vector2 } from '../utils/Vector2.js';

export class Player {
  constructor(spawnPos) {
    this.pos = spawnPos.clone();
    this.vel = new Vector2();
    this.angle = 0;            // aim direction (radians)
    this.radius = 14;
    this.team = 'player';
    this.name = 'You';

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.alive = true;

    this.crouching = false;
    this.sprinting = false;
    this.moving = false;
    this.prone = false;        // ProneSystem
    this.sliding = false;      // SlideSystem
    this.mantling = false;     // MantleSystem
    this.leanOffset = null;    // LeanSystem (Vector2 once it runs)
    this.adsSpreadMult = 1;    // AimDownSights

    this.shotsFired = 0;       // accuracy tracking (Weapon/Bullet maintain)
    this.shotsHit = 0;

    this.score = 0;
    this.kills = 0;
    this.deaths = 0;

    this.lastShotTime = -99;   // AI vision boost while muzzle is hot
    this.lastDamageTime = -99; // HUD damage flash
  }

  damage(game, amount, fromPos, killer) {
    if (!this.alive) return;
    this.health -= amount;
    this.lastDamageTime = game.time;
    game.events.emit('player:damaged', { amount, fromPos });
    game.effects.addShake(0.15);
    if (this.health <= 0) this.die(game, killer);
  }

  die(game, killer) {
    this.alive = false;
    this.health = 0;
    this.deaths++;
    game.effects.hitSpark(this.pos.x, this.pos.y, '#b8362a', 14);
    game.events.emit('player:died', {
      by: killer ? killer.name : 'Hostile',
      killerRef: killer && killer.team === 'enemy' ? killer : null, // killcam target
    });
  }

  respawn(spawnPos) {
    this.pos.copy(spawnPos);
    this.vel.set(0, 0);
    this.health = this.maxHealth;
    this.alive = true;
    this.crouching = false;
    this.sprinting = false;
    this.prone = false;
    this.sliding = false;
    this.mantling = false;
  }
}
