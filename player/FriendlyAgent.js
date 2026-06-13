// player/FriendlyAgent.js — Tactical AI squadmate. Fights alongside the player:
// hunts enemies when out of contact, flanks and pushes aggressively in combat,
// uses cover as a firing position not a hiding hole, retreats only when critical.

import { Vector2 } from '../utils/Vector2.js';
import { randRange, choice } from '../utils/MathUtils.js';
import { AssaultRifle } from '../weapons/AssaultRifle.js';
import { Shotgun } from '../weapons/Shotgun.js';

const FRIENDLY_NAMES = ['Price', 'Ghost', 'Soap', 'Gaz', 'Roach', 'Nikolai'];

// Tuning
const SIGHT_RANGE         = 520;   // scan radius for enemy detection
const OPTIMAL_RANGE       = 320;   // ideal combat distance (close enough to hit, not point-blank)
const FOLLOW_RANGE        = 160;   // stop following the player at this distance
const FOLLOW_SPEED        = 145;
const HUNT_SPEED          = 185;   // sprinting toward a known enemy position
const ENGAGE_SPEED        = 170;   // moving during a firefight
const SHOOT_INTERVAL_MIN  = 0.18;
const SHOOT_INTERVAL_MAX  = 0.42;
const RESPAWN_DELAY       = 6;
const RETREAT_HEALTH      = 55;
const REGEN_RATE          = 12;
const REGEN_TARGET        = 90;
const PATH_REPATH_DIST    = 80;
const STUCK_TIME          = 1.0;
const STUCK_MOVE_MIN      = 6;
const FLANK_INTERVAL_MIN  = 3.5;  // how often to pick a new attack angle
const FLANK_INTERVAL_MAX  = 6.0;
const HUNT_SCAN_RANGE     = SIGHT_RANGE * 2.5; // see enemies across the whole area

function _angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

let _nameIdx = 0;

export class FriendlyAgent {
  constructor(pos, game) {
    this.pos = pos.clone();
    this.vel = new Vector2();
    this.angle = Math.random() * Math.PI * 2;
    this.radius = 13;
    this.team = 'player';
    this.name = FRIENDLY_NAMES[_nameIdx++ % FRIENDLY_NAMES.length];

    this.maxHealth = 220;
    this.health = this.maxHealth;
    this.alive = true;
    this.leanOffset = null;

    this.weapon = Math.random() < 0.65
      ? new AssaultRifle({ damage: 22, defaultReserve: Infinity })
      : new Shotgun({ damage: 18, defaultReserve: Infinity });

    // 'follow' | 'hunt' | 'engage' | 'retreat'
    this._state         = 'follow';
    this._target        = null;
    this._shootTimer    = randRange(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
    this._respawnTimer  = 0;
    this._insertTimer   = 0;
    this._flankTimer    = randRange(FLANK_INTERVAL_MIN, FLANK_INTERVAL_MAX);
    this._flankOffset   = new Vector2(1, 0); // approach vector offset for flanking
    this._objectivePos  = null;

    // Pathfinding
    this._path          = [];
    this._pathIndex     = 0;
    this._pathGoal      = null;
    this._repathTimer   = 0;

    // Stuck detection
    this._stuckTimer    = 0;
    this._lastPos       = pos.clone();
    this._navStuckTimer = 0;
    this._stuckCheckPos = null;
  }

  get dead() { return !this.alive && this._respawnTimer <= 0; }

  update(dt, game) {
    this.weapon.update(dt);

    if (!this.alive) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this.respawn(game);
      return;
    }

    if (this._insertTimer > 0) { this._insertTimer -= dt; return; }

    this._target = this._nearestEnemy(game);

    const playerDist = this.pos.distanceTo(game.player.pos);
    const hasTarget  = !!this._target;
    const targetDist = hasTarget ? this.pos.distanceTo(this._target.pos) : Infinity;
    const hasLOS     = hasTarget && game.map.collision.lineOfSight(this.pos, this._target.pos);

    // --- State machine ---
    if (this.health <= RETREAT_HEALTH && this._state !== 'retreat') {
      this._state = 'retreat';
    } else if (this._state === 'retreat' && this.health >= REGEN_TARGET) {
      this._state = hasTarget ? 'engage' : 'follow';
    } else if (this._state !== 'retreat') {
      if (!hasTarget) {
        // No enemies in range — go to objective or follow player.
        this._state = 'follow';
      } else if (hasLOS) {
        // Direct line of sight → fight immediately.
        this._state = 'engage';
      } else {
        // Enemy known but no LOS → hunt them down.
        this._state = 'hunt';
      }
    }

    // Periodically shift the approach angle so they flank rather than charge straight.
    this._flankTimer -= dt;
    if (this._flankTimer <= 0) {
      this._flankTimer = randRange(FLANK_INTERVAL_MIN, FLANK_INTERVAL_MAX);
      const a = Math.random() * Math.PI * 2;
      this._flankOffset = new Vector2(Math.cos(a), Math.sin(a));
    }

    // --- Objective override when idle ---
    if (this._objectivePos && this._state === 'follow' && !hasTarget) {
      const atObj = this.pos.distanceTo(this._objectivePos) < 55;
      if (!atObj) this._navigateTo(game, this._objectivePos, HUNT_SPEED, dt);
    } else {
      switch (this._state) {
        case 'follow':  this._doFollow(dt, game, playerDist); break;
        case 'hunt':    this._doHunt(dt, game); break;
        case 'engage':  this._doEngage(dt, game, targetDist, hasLOS); break;
        case 'retreat': this._doRetreat(dt, game); break;
      }
    }

    // Shoot whenever there's a clear shot (all states except retreat).
    if (this._state !== 'retreat' && hasTarget && hasLOS && targetDist < SIGHT_RANGE) {
      this._faceTarget(dt);
      this._tryShoot(game, dt);
    }

    // Stuck detection — escape walls quickly.
    this._stuckTimer += dt;
    if (this._stuckTimer >= STUCK_TIME) {
      const moved = this.pos.distanceTo(this._lastPos);
      if (moved < STUCK_MOVE_MIN) {
        const col = game.map.collision;
        const t = col.nearestWalkable(col.worldToTile(this.pos.x), col.worldToTile(this.pos.y), 12);
        if (t) this.pos.copy(col.tileCenter(t.tx, t.ty));
        this._path = [];
        this._pathGoal = null;
      }
      this._lastPos.copy(this.pos);
      this._stuckTimer = 0;
    }
  }

  _doFollow(dt, game, playerDist) {
    if (playerDist < FOLLOW_RANGE * 0.4) return;
    this._navigateTo(game, game.player.pos, FOLLOW_SPEED, dt);
  }

  // Hunt: sprint directly toward the target's last known position.
  // The instant we get LOS the state flips to 'engage', so this is always transient.
  _doHunt(dt, game) {
    if (!this._target) return;
    // Head for the enemy's position (or lastKnownPos if on the bb).
    const dest = this._target.bb?.lastKnownPos || this._target.pos;
    this._navigateTo(game, dest, HUNT_SPEED, dt);
    this._faceTarget(dt);
  }

  // Engage: close to optimal range using a rotated approach vector so we
  // naturally flank rather than piling in from the same angle as everyone else.
  // Never freeze — if we're within range we orbit the enemy while shooting.
  _doEngage(dt, game, targetDist, hasLOS) {
    if (!this._target) return;
    const tp = this._target.pos;

    if (targetDist > OPTIMAL_RANGE * 1.4) {
      // Too far — sprint toward the target along the flanking offset vector.
      // The offset shifts the approach angle so we come from a different side
      // than the player, creating a natural two-pronged pressure.
      const toEnemy = tp.clone().sub(this.pos).normalize();
      const combined = toEnemy.clone().add(this._flankOffset.clone().scale(0.4)).normalize();
      const dest = this.pos.clone().add(combined.scale(OPTIMAL_RANGE));
      // Clamp to world bounds.
      dest.x = Math.max(40, Math.min(game.map.worldWidth - 40, dest.x));
      dest.y = Math.max(40, Math.min(game.map.worldHeight - 40, dest.y));
      this._navigateTo(game, tp, ENGAGE_SPEED, dt);
    } else if (!hasLOS) {
      // In range but no LOS — sidestep to find a shot, navigating toward target.
      this._navigateTo(game, tp, ENGAGE_SPEED * 0.7, dt);
    }
    // If we're at optimal range AND have LOS: hold position and shoot (handled
    // by the global shoot block above). _faceTarget called in the shoot block.
    this._faceTarget(dt);
  }

  _doRetreat(dt, game) {
    this._navigateTo(game, game.player.pos, ENGAGE_SPEED * 1.1, dt);
    if (this.health < REGEN_TARGET) {
      this.health = Math.min(REGEN_TARGET, this.health + REGEN_RATE * dt);
    }
  }

  _navigateTo(game, goal, speed, dt) {
    this._repathTimer -= dt;
    const goalMoved = !this._pathGoal || this._pathGoal.distanceTo(goal) > PATH_REPATH_DIST;

    // Nav-level stuck detection.
    this._navStuckTimer = (this._navStuckTimer || 0) + dt;
    if (this._navStuckTimer >= 0.5) {
      const moved = this._stuckCheckPos ? this.pos.distanceTo(this._stuckCheckPos) : 999;
      if (moved < 3 && this._path && this._path.length > 0) {
        this._path = [];
        this._repathTimer = 0;
      }
      this._navStuckTimer = 0;
      this._stuckCheckPos = this.pos.clone();
    }

    if (goalMoved || this._path.length === 0 || this._repathTimer <= 0) {
      this._path = game.ai.pathfinder.findPath(this.pos, goal);
      this._pathIndex = 0;
      this._pathGoal = goal.clone();
      this._repathTimer = 0.4;
    }

    if (!this._path || this._path.length === 0) {
      const dir = goal.clone().sub(this.pos);
      const len = dir.length();
      if (len > 1) {
        dir.scale(1 / len);
        game.map.collision.moveCircle(this.pos, dir.x * speed * dt, dir.y * speed * dt, this.radius);
        this.angle = Math.atan2(dir.y, dir.x);
      }
      return;
    }

    while (this._pathIndex < this._path.length) {
      const wp = this._path[this._pathIndex];
      const dx = wp.x - this.pos.x, dy = wp.y - this.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 24) { this._pathIndex++; continue; }
      const nx = dx / dist, ny = dy / dist;
      game.map.collision.moveCircle(this.pos, nx * speed * dt, ny * speed * dt, this.radius);
      this.angle = Math.atan2(ny, nx);
      break;
    }
  }

  _faceTarget(dt) {
    if (!this._target) return;
    const desired = Math.atan2(
      this._target.pos.y - this.pos.y,
      this._target.pos.x - this.pos.x
    );
    const diff = _angleDiff(this.angle, desired);
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 9 * dt);
  }

  _tryShoot(game, dt) {
    this._shootTimer -= dt;
    if (this._shootTimer > 0) return;
    this._shootTimer = randRange(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
    if (!this._target || !game.map.collision.lineOfSight(this.pos, this._target.pos)) return;
    const aimAngle = this.angle + (Math.random() - 0.5) * 0.08;
    this.weapon.tryFire(game, this, aimAngle);
  }

  // Scan broadly — not just nearby. Friendlies should be aware of the whole fight.
  _nearestEnemy(game) {
    let best = null, bestScore = Infinity;
    const scanRange = this._objectivePos ? HUNT_SCAN_RANGE * 1.5 : HUNT_SCAN_RANGE;
    for (const e of game.ai.enemies) {
      if (e.health <= 0) continue;
      const d = this.pos.distanceTo(e.pos);
      if (d > scanRange) continue;
      // Prioritise enemies actively targeting the player.
      const targetsPlayer = e.bb?.target === game.player || e.bb?.canSee;
      const score = d - (targetsPlayer ? 120 : 0);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  damage(game, amount, fromPos, attacker) {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) this.die(game);
  }

  die(game) {
    this.alive = false;
    this.health = 0;
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
      const tx = spawn.x + randRange(-50, 50);
      const ty = spawn.y + randRange(-30, 30);
      if (!col.circleHits(tx, ty, this.radius)) {
        this.pos.x = tx; this.pos.y = ty;
        placed = true; break;
      }
    }
    if (!placed) this.pos.copy(spawn);
    this.health = this.maxHealth;
    this.alive = true;
    this._state = 'follow';
    this._target = null;
    this._path = [];
    this._pathGoal = null;
    this._respawnTimer = 0;
    this._insertTimer = 0;
    this._flankTimer = randRange(FLANK_INTERVAL_MIN, FLANK_INTERVAL_MAX);
    game.events.emit('friendly:respawned', { name: this.name });
  }
}
