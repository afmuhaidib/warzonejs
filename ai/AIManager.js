// ai/AIManager.js — Spawns, registers, and ticks all enemies. Owns the shared
// nav services (Pathfinder, FlowField) and the SquadCoordinator; routes 'sound'
// events into enemy hearing; handles kills (score, weapon drops), separation so
// enemies don't stack, and difficulty-driven reinforcement spawning away from
// the player.
// Dependencies: Enemy, EnemyRenderer, Pathfinder, FlowField, SquadCoordinator,
// weapon classes, WeaponPickup, EventBus (via game).

import { Enemy } from './Enemy.js';
import { EnemyRenderer } from './EnemyRenderer.js';
import { Pathfinder } from './Pathfinder.js';
import { FlowField } from './FlowField.js';
import { SquadCoordinator } from './SquadCoordinator.js';
import { AssaultRifle } from '../weapons/AssaultRifle.js';
import { AK47 } from '../weapons/AK47.js';
import { Shotgun } from '../weapons/Shotgun.js';
import { SniperRifle } from '../weapons/SniperRifle.js';
import { WeaponPickup } from '../weapons/WeaponPickup.js';
import { FriendlyAgent } from '../player/FriendlyAgent.js';
import { FriendlyRenderer } from '../player/FriendlyRenderer.js';
import { choice, randRange } from '../utils/MathUtils.js';

const SQUAD_SIZE = 3;
const MIN_SPAWN_DIST = 650;   // never spawn within this range of the player
const DROP_CHANCE = 0.45;
const SCORE_PER_KILL = 100;

// Enemy guns hit softer than the player's (their accuracy is the difficulty
// lever; raw damage would just feel random). Infinite reserve: AI never dry.
const LOADOUTS = [
  { make: () => new AssaultRifle({ damage: 14, defaultReserve: Infinity }), weight: 6 },
  { make: () => new Shotgun({ damage: 9, defaultReserve: Infinity }), weight: 2 },
  { make: () => new SniperRifle({ damage: 45, defaultReserve: Infinity }), weight: 1 },
];

export class AIManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.pathfinder = new Pathfinder(game.map);
    this.flowField = new FlowField(game.map);
    this.coordinator = new SquadCoordinator(game);
    this.respawnTimer = 0;
    this.spawnCount = 0;

    game.events.on('enemy:killed', ({ enemy, by }) => this.onKill(enemy, by));
    game.events.on('sound', (s) => this.onSound(s));

    // Expose friendlies on game so Perception can read them.
    game.friendlies = [];
    this._spawnFriendlies();
  }

  _spawnFriendlies() {
    const game = this.game;
    game.friendlies.length = 0; // clear before repopulating (rematch safety)
    const spawn = game.map.playerSpawn;
    // Match enemy count so teams are equal (player counts as +1 for their side)
    const enemyCount = game.difficulty.params.maxEnemies;
    const coopOverride = game.multiplayerConfig?.coopFriendlies;
    const friendlyCount = (coopOverride != null) ? Math.max(1, coopOverride) : Math.max(3, enemyCount - 1);
    for (let i = 0; i < friendlyCount; i++) {
      const angle = (i / friendlyCount) * Math.PI * 2;
      const pos = spawn.clone();
      pos.x += Math.cos(angle) * 55;
      pos.y += Math.sin(angle) * 40;
      game.friendlies.push(new FriendlyAgent(pos, game));
    }
  }

  spawnInitial() {
    const n = this.game.difficulty.params.maxEnemies;
    for (let i = 0; i < n; i++) this.spawn();
  }

  spawn() {
    const { map, player } = this.game;
    const far = map.enemySpawns.filter((s) => s.distanceTo(player.pos) > MIN_SPAWN_DIST);
    const base = choice(far.length ? far : map.enemySpawns);
    const pos = base.clone();
    pos.x += randRange(-50, 50);
    pos.y += randRange(-50, 50);
    const t = map.collision.nearestWalkable(
      map.collision.worldToTile(pos.x), map.collision.worldToTile(pos.y));
    if (t) pos.copy(map.collision.tileCenter(t.tx, t.ty));

    const idx = this.spawnCount++;
    const squad = Math.floor(idx / SQUAD_SIZE);
    const enemy = new Enemy(pos, pickLoadout(), squad);
    // FFA: each enemy is their own team so they fight each other.
    if (this.game.ffaMode) enemy.team = `ffa_${idx}`;
    this.enemies.push(enemy);
  }

  onKill(enemy, by) {
    if (by === this.game.player) {
      this.game.player.score += SCORE_PER_KILL;
      this.game.player.kills++;
    } else if (by && (by.team === 'player' || by.team === this.game.player.team)) {
      // Friendly got the kill — still score for the player team.
      this.game.player.score += Math.floor(SCORE_PER_KILL * 0.5);
    }
    this.squadMorale(enemy);
    if (Math.random() < DROP_CHANCE) {
      // Always drop an AK-47.
      const drop = new AK47();
      drop.ammo = Math.floor(randRange(0.3, 1) * drop.magSize);
      drop.reserve = Math.floor(drop.defaultReserve * randRange(0.2, 0.6));
      this.game.pickups.push(new WeaponPickup(enemy.pos, drop));
    }
  }

  /**
   * Witnessing a squadmate go down moves nearby survivors. Brave soldiers go on
   * the offensive (avenge: aggression spike that overrides retreat); the timid
   * get rattled (suppression) and may break. Everyone investigates the spot.
   */
  squadMorale(victim) {
    const MORALE_RADIUS = 420;
    let calledOut = false;
    for (const e of this.enemies) {
      if (e === victim || e.health <= 0) continue;
      const near = e.pos.distanceTo(victim.pos) < MORALE_RADIUS;
      if (!near && e.squad !== victim.squad) continue;
      const bb = e.bb;
      bb.awareness = Math.max(bb.awareness, 0.45);
      if (bb.timeSinceSeen > 2 && victim.bb.lastKnownPos) {
        bb.alertPos = victim.bb.lastKnownPos.clone(); // check where the shots came from
      }
      if (e.personality.bravery * Math.random() > 0.55) {
        bb.avengeUntil = this.game.time + 4.5; // press the attack
        if (!calledOut) { e.say('avenge', 1.6); calledOut = true; }
      } else {
        bb.suppression = Math.min(1, bb.suppression + 0.35); // shaken
        if (!calledOut) { e.say('manDown', 1.8); calledOut = true; }
      }
    }
  }

  onSound({ pos, radius, team }) {
    for (const e of this.enemies) {
      // Enemies don't react to their own team's gunfire — only hostile sounds.
      if (e.team === team) continue;
      if (e.pos.distanceTo(pos) < radius) e.perception.hear(pos, this.game);
    }
  }

  update(dt) {
    const game = this.game;
    game.difficulty.update(dt);
    this.coordinator.update(dt);

    // Tick friendly squadmates; respawn dead ones.
    for (const f of game.friendlies) {
      f.update(dt, game);
      if (!f.alive && f._respawnTimer <= 0) f.respawn(game);
    }

    for (const e of this.enemies) e.update(dt, game);
    this.separate();

    // Bury the dead.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].health <= 0) this.enemies.splice(i, 1);
    }

    // Reinforcements up to the difficulty population cap.
    if (this.enemies.length < game.difficulty.params.maxEnemies) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawnTimer = game.difficulty.params.respawnDelay;
        this.spawn();
      }
    }
  }

  /** Pairwise push-apart so squadmates never occupy the same spot. */
  separate() {
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
        const minDist = a.radius + b.radius + 2;
        const d2 = dx * dx + dy * dy;
        if (d2 > minDist * minDist || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (minDist - d) / 2;
        const nx = dx / d, ny = dy / d;
        this.game.map.collision.moveCircle(a.pos, -nx * push, -ny * push, a.radius);
        this.game.map.collision.moveCircle(b.pos, nx * push, ny * push, b.radius);
      }
    }
  }

  draw(ctx, game) {
    for (const f of game.friendlies) FriendlyRenderer.draw(ctx, f, game);
    for (const e of this.enemies) EnemyRenderer.draw(ctx, e, game);
  }
}

function pickLoadout() {
  const total = LOADOUTS.reduce((s, l) => s + l.weight, 0);
  let r = Math.random() * total;
  for (const l of LOADOUTS) {
    r -= l.weight;
    if (r <= 0) return l.make();
  }
  return LOADOUTS[0].make();
}
