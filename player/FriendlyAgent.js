// player/FriendlyAgent.js — Tactical AI squadmate. Fights alongside the player:
// stays close when no contact, pushes toward enemies when spotted, takes cover
// and suppresses, flanks when the player is pinned.

import { Vector2 } from '../utils/Vector2.js';
import { randRange, choice } from '../utils/MathUtils.js';
import { AssaultRifle } from '../weapons/AssaultRifle.js';
import { Shotgun } from '../weapons/Shotgun.js';

const FRIENDLY_NAMES = ['Price', 'Ghost', 'Soap', 'Gaz', 'Roach', 'Nikolai'];

// Tuning
const SIGHT_RANGE        = 480;
const ENGAGE_RANGE       = 440;
const FOLLOW_RANGE       = 160;
const FOLLOW_SPEED       = 145;
const SEEK_SPEED         = 175;
const SHOOT_INTERVAL_MIN = 0.25;
const SHOOT_INTERVAL_MAX = 0.55;
const RESPAWN_DELAY      = 6;
const COVER_SEEK_DIST    = 200;
const REPOSITION_INTERVAL_MIN = 3;
const REPOSITION_INTERVAL_MAX = 5;
const PATH_REPATH_DIST   = 80;  // re-path if destination moved more than this
const STUCK_TIME         = 1.0; // seconds before declaring stuck
const STUCK_MOVE_MIN     = 6;   // pixels moved minimum to not be stuck
const RETREAT_HEALTH     = 55;  // hp threshold to enter retreat
const REGEN_RATE         = 12;  // hp/s while retreating
const REGEN_TARGET       = 90;  // regen stops here

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

    // 'follow' | 'advance' | 'engage' | 'flank'
    this._state        = 'follow';
    this._target       = null;
    this._shootTimer   = randRange(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
    this._coverSpot    = null;
    this._repositionTimer = randRange(REPOSITION_INTERVAL_MIN, REPOSITION_INTERVAL_MAX);
    this._stuckTimer   = 0;
    this._lastPos      = pos.clone();
    this._respawnTimer = 0;
    this._insertTimer  = 0;
    this._coverHoldTimer = 0; // tracks how long we've been sitting in cover
    // Pathfinding
    this._path         = [];
    this._pathIndex    = 0;
    this._pathGoal     = null;
    this._repathTimer  = 0;
    this._objectivePos = null; // set by game modes to direct friendly to a point
  }

  get dead() { return !this.alive && this._respawnTimer <= 0; }

  update(dt, game) {
    this.weapon.update(dt);

    if (!this.alive) {
      this._respawnTimer -= dt;
      if (this._respawnTimer <= 0) this.respawn(game);
      return;
    }

    // Insertion delay — stay frozen briefly at match start
    if (this._insertTimer > 0) {
      this._insertTimer -= dt;
      return;
    }

    this._target = this._nearestEnemy(game);

    const playerDist = this.pos.distanceTo(game.player.pos);
    const hasTarget  = !!this._target;
    const targetDist = hasTarget ? this.pos.distanceTo(this._target.pos) : Infinity;
    const hasLOS     = hasTarget && game.map.collision.lineOfSight(this.pos, this._target.pos);

    // --- State transitions ---
    // Retreat: when critically wounded, fall back to the player and regenerate.
    if (this.health <= RETREAT_HEALTH && this._state !== 'retreat') {
      this._state = 'retreat';
      this._coverSpot = null;
    } else if (this._state === 'retreat' && this.health >= REGEN_TARGET) {
      this._state = 'follow';
    } else if (this._state !== 'retreat') {
      if (!hasTarget) {
        this._state = 'follow';
      } else if (this._state === 'follow' && (targetDist < SIGHT_RANGE || hasLOS)) {
        this._state = 'advance';
        this._pickCover(game);
        this._coverHoldTimer = 0;
      } else if (this._state === 'advance' && hasLOS && targetDist < ENGAGE_RANGE) {
        this._state = 'engage';
        this._pickCover(game);
        this._coverHoldTimer = 0;
      } else if (this._state === 'engage' && targetDist > SIGHT_RANGE * 1.5) {
        this._state = 'follow';
      }
    }

    // Periodic reposition while engaging
    this._repositionTimer -= dt;
    if (this._repositionTimer <= 0) {
      this._repositionTimer = randRange(REPOSITION_INTERVAL_MIN, REPOSITION_INTERVAL_MAX);
      if (this._state === 'engage' || this._state === 'advance') this._pickCover(game);
    }

    // --- Behavior dispatch ---
    // Objective override: when mode assigns a capture point, march there and
    // HOLD it. Never self-clear — only the mode system reassigns _objectivePos.
    // Yields to combat naturally: when hasTarget is true the normal state machine
    // handles the fight; when the enemy dies hasTarget → false and we return here.
    if (this._objectivePos && this._state === 'follow' && !hasTarget) {
      const atObj = this.pos.distanceTo(this._objectivePos) < 55;
      if (!atObj) {
        this._navigateTo(game, this._objectivePos, SEEK_SPEED, dt);
      }
      // At objective: stand guard (slow scan rotation), don't follow the player.
      // Fall through to the shoot block below so we fire at anyone who shows up.
    } else {
      switch (this._state) {
        case 'follow':  this._doFollow(dt, game, playerDist); break;
        case 'advance': this._doAdvance(dt, game, targetDist, hasLOS); break;
        case 'engage':  this._doEngage(dt, game, targetDist, hasLOS); break;
        case 'retreat': this._doRetreat(dt, game); break;
      }
    }

    // Always shoot if we have LOS regardless of state (except during retreat)
    if (this._state !== 'retreat' && hasTarget && hasLOS && targetDist < ENGAGE_RANGE) {
      this._faceTarget(dt);
      this._tryShoot(game, dt);
    }

    // Stuck detection — fast recovery
    this._stuckTimer += dt;
    if (this._stuckTimer >= STUCK_TIME) {
      const moved = this.pos.distanceTo(this._lastPos);
      if (moved < STUCK_MOVE_MIN) {
        // Teleport to nearest open tile and clear path so we repath next frame
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
    if (playerDist < FOLLOW_RANGE * 0.4) return; // tighter dead zone (64px not 96px)
    this._navigateTo(game, game.player.pos, FOLLOW_SPEED, dt);
  }

  _doAdvance(dt, game, targetDist, hasLOS) {
    // Close-range aggression: push directly at the enemy instead of hunting cover.
    if (hasLOS && targetDist < 200) {
      this._navigateTo(game, this._target.pos, SEEK_SPEED, dt);
      this._faceTarget(dt);
      return;
    }
    // If we already have LOS and are close enough, hold position and shoot
    // rather than charging straight into the enemy.
    if (hasLOS && targetDist < ENGAGE_RANGE) {
      this._faceTarget(dt);
      return;
    }
    const dest = this._coverSpot || (this._target ? this._target.pos : null);
    if (!dest) return;
    this._navigateTo(game, dest, SEEK_SPEED, dt);
    if (this._target) this._faceTarget(dt);
  }

  _doEngage(dt, game, targetDist, hasLOS) {
    // Close-range aggression: skip cover entirely and push toward the enemy.
    if (hasLOS && targetDist < 200) {
      this._navigateTo(game, this._target.pos, SEEK_SPEED, dt);
      this._faceTarget(dt);
      return;
    }

    // While in LOS and within engage range, push toward the enemy at 60% run
    // speed (strafe/advance) rather than standing frozen behind cover.
    if (hasLOS && targetDist < ENGAGE_RANGE && this._target) {
      this._navigateTo(game, this._target.pos, SEEK_SPEED * 0.6, dt);
    }

    if (this._coverSpot) {
      const toCover = this._coverSpot.distanceTo(this.pos);
      if (toCover > 22) {
        this._navigateTo(game, this._coverSpot, SEEK_SPEED, dt);
        this._coverHoldTimer = 0; // still moving to cover, reset timer
      } else {
        // We're at the cover spot — count how long we've been hiding here
        this._coverHoldTimer += dt;
        if (this._coverHoldTimer > 1.2) {
          // Sat in cover too long — always force-advance toward the enemy
          this._coverHoldTimer = 0;
          if (this._target) {
            // Force advance: move directly toward the enemy
            const step = this._target.pos.clone().sub(this.pos).normalize().scale(COVER_SEEK_DIST * 0.5);
            this._coverSpot = this.pos.clone().add(step);
          }
          this._repositionTimer = randRange(REPOSITION_INTERVAL_MIN, REPOSITION_INTERVAL_MAX);
        }
      }
    }
    this._faceTarget(dt);
  }

  _doRetreat(dt, game) {
    // Sprint back to the player and regenerate health.
    this._navigateTo(game, game.player.pos, SEEK_SPEED * 1.1, dt);
    if (this.health < REGEN_TARGET) {
      this.health = Math.min(REGEN_TARGET, this.health + REGEN_RATE * dt);
    }
  }

  // Pathfinder-based movement toward goal — avoids walls properly.
  _navigateTo(game, goal, speed, dt) {
    this._repathTimer -= dt;
    const goalMoved = !this._pathGoal || this._pathGoal.distanceTo(goal) > PATH_REPATH_DIST;
    // Nav-level stuck detection: no movement in 0.5s → scrap path and repath.
    // Uses _navStuckTimer (separate from the outer wall-escape _stuckTimer).
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
      // No path found — try direct push (short open spaces)
      const dir = goal.clone().sub(this.pos);
      const len = dir.length();
      if (len > 1) {
        dir.scale(1 / len);
        game.map.collision.moveCircle(this.pos, dir.x * speed * dt, dir.y * speed * dt, this.radius);
        this.angle = Math.atan2(dir.y, dir.x);
      }
      return;
    }

    // Walk along path waypoints
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
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 8 * dt);
  }

  _tryShoot(game, dt) {
    this._shootTimer -= dt;
    if (this._shootTimer <= 0) {
      this._shootTimer = randRange(SHOOT_INTERVAL_MIN, SHOOT_INTERVAL_MAX);
      // Re-verify line of sight at fire time — don't shoot into walls
      if (!this._target || !game.map.collision.lineOfSight(this.pos, this._target.pos)) return;
      const aimAngle = this.angle + (Math.random() - 0.5) * 0.1;
      this.weapon.tryFire(game, this, aimAngle);
    }
  }

  _pickCover(game) {
    const coverSpots = game.map.cover ? game.map.cover.spots : [];
    if (!coverSpots.length) { this._coverSpot = null; return; }
    const threatPos = this._target ? this._target.pos : game.map.enemySpawns[0];
    const spot = game.map.cover.findSpot(this.pos, threatPos, COVER_SEEK_DIST, this);
    this._coverSpot = spot ? spot.pos.clone() : null;
  }

  _nearestEnemy(game) {
    // Prefer enemies that are actively targeting the player (threat to player).
    // Use an effective-distance heuristic: subtract a bonus for player-targeters
    // within sight range so we intercept them rather than chasing the nearest.
    let best = null, bestScore = Infinity;
    // Extend scan range when we have an objective — detect enemies on the flag.
    const scanRange = this._objectivePos ? SIGHT_RANGE * 2.5 : SIGHT_RANGE * 1.5;
    for (const e of game.ai.enemies) {
      if (e.health <= 0) continue;
      const d = this.pos.distanceTo(e.pos);
      if (d > scanRange) continue;
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
    // Try random offsets until we land on a walkable tile; fall back to spawn.
    let placed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = spawn.x + randRange(-50, 50);
      const ty = spawn.y + randRange(-30, 30);
      if (!col.circleHits(tx, ty, this.radius)) {
        this.pos.x = tx;
        this.pos.y = ty;
        placed = true;
        break;
      }
    }
    if (!placed) this.pos.copy(spawn);
    this.health = this.maxHealth;
    this.alive = true;
    this._state = 'follow';
    this._target = null;
    this._coverSpot = null;
    this._coverHoldTimer = 0;
    this._path = [];
    this._pathGoal = null;
    this._respawnTimer = 0;
    this._insertTimer = 0;
    game.events.emit('friendly:respawned', { name: this.name });
  }
}
