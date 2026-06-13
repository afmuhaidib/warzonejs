// player/FriendlyAgent.js — Tactical AI squadmate.
//
// Friendlies now share ONE brain with the enemies: this class EXTENDS `Enemy`,
// so it inherits the full perception model (vision cone, awareness/reaction
// time, hearing, memory drift) and the entire behavior tree (Retreat ▸
// Suppress/Flank/Engage ▸ Investigate ▸ Alert ▸ Patrol), predictive aim,
// suppression, cover use, grenades and barks. The only differences are
// team-specific: callsign, friendly respawn near the player, a soft "leash" so
// the squad stays cohesive when out of contact, and a small heal-while-falling-
// back perk. This is the fix for the old "why is teammate AI dumber than enemy
// AI" problem — they used to be two separate implementations.
//
// Dependencies: ai/Enemy (shared brain), weapons/AK47, ai/Personality, utils.

import { Enemy } from '../ai/Enemy.js';
import { Vector2 } from '../utils/Vector2.js';
import { randRange } from '../utils/MathUtils.js';
import { AK47 } from '../weapons/AK47.js';
import { makePersonality } from '../ai/Personality.js';

const FRIENDLY_NAMES = ['Price', 'Ghost', 'Soap', 'Gaz', 'Roach', 'Nikolai'];

const RESPAWN_DELAY = 6;
const REGEN_RATE    = 14;   // HP/s recovered while retreating
const REGEN_TARGET  = 100;  // heal back up to this while falling back
const LEASH_RANGE   = 360;  // out of combat, drift back toward the player past this
const CONTACT_MEMORY = 5;   // mirrors Enemy.js: seconds of "still in contact"

let _nameIdx  = 0;
let _squadSeq = 0;

export class FriendlyAgent extends Enemy {
  constructor(pos, game) {
    // Friendlies get their own (negative) squad ids so they never mix with the
    // enemy squads the SquadCoordinator manages. AK platform like every NPC.
    const squad = -1 - (_squadSeq++);
    super(pos, new AK47({ damage: 20, defaultReserve: Infinity }), squad, makePersonality());

    this.team = 'player';
    this.name = FRIENDLY_NAMES[_nameIdx++ % FRIENDLY_NAMES.length];

    // Slightly tankier than a base enemy so the co-op squad survives the
    // tougher difficulty floors; intelligence is identical (shared brain).
    this.maxHealth = 120;
    this.health = this.maxHealth;

    // Lifecycle flags the AIManager / renderer / GameModeManager rely on.
    this.alive = true;
    this._respawnTimer = 0;
    this._insertTimer  = 0;
    this.leanOffset = null;
  }

  get dead() { return !this.alive && this._respawnTimer <= 0; }

  update(dt, game) {
    // Dead: just tick the respawn timer (Enemy.update would early-return and
    // never bring them back).
    if (!this.alive) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this.respawn(game);
      return;
    }

    // Staggered insertion at match start: hold position, keep the weapon timers
    // alive so the mag isn't frozen mid-reload.
    if (this._insertTimer > 0) {
      this._insertTimer -= dt;
      this.weapon.update(dt);
      return;
    }

    // Cohesion leash: when not in a firefight, drift back toward the player so
    // the squad doesn't scatter across the map. Reuses the shared Investigate
    // behavior (higher tree priority than Patrol) by pointing it at the player.
    const bb = this.bb;
    const inCombat = bb.lastKnownPos && (bb.canSee || bb.timeSinceSeen < CONTACT_MEMORY);
    if (!inCombat && !bb.alertPos) {
      const d = this.pos.distanceTo(game.player.pos);
      if (d > LEASH_RANGE) {
        bb.investigatePos = game.player.pos.clone();
      } else if (d < LEASH_RANGE * 0.5 && bb.investigatePos) {
        bb.investigatePos = null;
        bb.searchTimer = null;
      }
    }

    super.update(dt, game);

    // Falling back regenerates health so a squadmate can rejoin the fight.
    if (this.state === 'retreat' && this.health < REGEN_TARGET) {
      this.health = Math.min(REGEN_TARGET, this.health + REGEN_RATE * dt);
    }
  }

  die(game, _killer) {
    if (!this.alive) return;
    this.health = 0;
    this.alive = false;
    this._respawnTimer = RESPAWN_DELAY;
    game.map.cover?.release?.(this);
    game.effects.hitSpark(this.pos.x, this.pos.y, '#4a8c3f', 10);
    game.events.emit('friendly:died', { name: this.name });
  }

  respawn(game) {
    const spawn = game.map.playerSpawn;
    const col = game.map.collision;
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = spawn.x + randRange(-55, 55);
      const ty = spawn.y + randRange(-35, 35);
      if (!col.circleHits(tx, ty, this.radius)) {
        this.pos.x = tx; this.pos.y = ty;
        placed = true; break;
      }
    }
    if (!placed) this.pos.copy(spawn);

    this.health = this.maxHealth;
    this.alive = true;
    this._respawnTimer = 0;
    this._insertTimer = 0;
    this.weapon.refill?.();
    this._resetBlackboard();
    game.events.emit('friendly:respawned', { name: this.name });
  }

  /** Clear combat state on (re)spawn so they don't resume a stale firefight. */
  _resetBlackboard() {
    const bb = this.bb;
    bb.awareness = 0;
    bb.canSee = false;
    bb.lastKnownPos = null;
    bb.timeSinceSeen = 999;
    bb.alertPos = null;
    bb.investigatePos = null;
    bb.searchTimer = null;
    bb.role = null;
    bb.path = null;
    bb.spotAnnounced = false;
    bb.suppression = 0;
    bb.avengeUntil = 0;
    bb.barkTimer = 0;
    bb.target = null;
    bb.coverSpot = null;
    bb.retreatSpot = null;
    bb.desiredAngle = this.angle;
  }
}
