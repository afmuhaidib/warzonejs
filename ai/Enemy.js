// ai/Enemy.js — Enemy entity: state, blackboard, the shared behavior tree, and
// the movement/aiming/shooting helpers the behavior nodes call. The tree itself
// is built once (module-level) and shared by all enemies; all per-enemy state
// lives on `this.bb` (blackboard).
// Tree priority: Retreat ▸ Combat[Suppress|Flank|Engage] ▸ Investigate ▸ Alert ▸ Patrol.
// Dependencies: BehaviorTree, behaviors/*, Perception, a Weapon instance.

import { Vector2 } from '../utils/Vector2.js';
import { Selector, Sequence, Condition } from './BehaviorTree.js';
import { Perception } from './Perception.js';
import { Patrol } from './behaviors/Patrol.js';
import { Alert } from './behaviors/Alert.js';
import { Investigate } from './behaviors/Investigate.js';
import { Engage } from './behaviors/Engage.js';
import { Suppress } from './behaviors/Suppress.js';
import { Flank } from './behaviors/Flank.js';
import { Retreat, shouldRetreat } from './behaviors/Retreat.js';
import { makePersonality } from './Personality.js';
import { angleDiff, normalizeAngle, gaussian, clamp, choice } from '../utils/MathUtils.js';

const CONTACT_MEMORY = 5; // seconds after losing sight that combat continues
const TURN_SPEED = 5.5;   // rad/s (doubled in combat)
const SUPPRESS_DECAY = 0.55;   // suppression bleeds off this fast per second
const NAMES = ['Viper', 'Kodiak', 'Saber', 'Havoc', 'Razor', 'Bishop', 'Ghost', 'Tusk', 'Wraith', 'Jackal'];
let nameIdx = 0;

// Combat chatter — short callouts that surface the AI's internal state to the
// player. A firefight with no barks feels lifeless; this is pure flavor wired
// to real decisions (spotting, reloading, grenades, losses, flanking).
const BARKS = {
  contact: ['Contact!', 'Tango spotted!', 'I see him!', 'Target front!'],
  reload: ['Reloading!', 'Changing mags!', 'Cover me!'],
  grenade: ['Frag out!', 'Grenade!', 'Cooking it!'],
  flank: ['Flanking left!', 'Moving wide!', 'Cutting him off!'],
  suppress: ['Pinning him!', 'Suppressing!', 'Keep him down!'],
  manDown: ['Man down!', 'They got Kodiak!', 'We lost one!'],
  retreat: ['Falling back!', 'Pulling out!', 'Regroup!'],
  pinned: ['Taking fire!', "I'm pinned!", 'Heads down!'],
  avenge: ['You\'re dead!', 'Push him!', 'For the squad!'],
};

const inCombat = (e) =>
  e.bb.lastKnownPos && (e.bb.canSee || e.bb.timeSinceSeen < CONTACT_MEMORY);

const TREE = new Selector([
  new Sequence([new Condition(shouldRetreat), Retreat()]),
  new Sequence([
    new Condition(inCombat),
    new Selector([
      new Sequence([new Condition((e) => e.bb.role === 'suppress'), Suppress()]),
      new Sequence([new Condition((e) => e.bb.role === 'flank'), Flank()]),
      Engage(),
    ]),
  ]),
  new Sequence([new Condition((e) => !!e.bb.investigatePos), Investigate()]),
  new Sequence([new Condition((e) => !!e.bb.alertPos), Alert()]),
  Patrol(),
]);

export class Enemy {
  constructor(pos, weapon, squad, personality = makePersonality()) {
    this.pos = pos.clone();
    this.vel = new Vector2();
    this.angle = Math.random() * Math.PI * 2;
    this.radius = 14;
    this.team = 'enemy';
    this.name = NAMES[nameIdx++ % NAMES.length] + '-' + nameIdx;
    this.squad = squad;
    this.personality = personality;

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.weapon = weapon;

    this.walkSpeed = 95;
    this.runSpeed = 185;
    this.state = 'patrol';
    this.lastShotTime = -99;

    this.perception = new Perception(this);
    this.bb = {
      awareness: 0,
      canSee: false,
      spotAnnounced: false,
      lastKnownPos: null,
      timeSinceSeen: 999,
      alertPos: null,
      alertTimer: 0,
      investigatePos: null,
      searchTimer: null,
      role: null,
      path: null,
      pathIndex: 0,
      repathTimer: 0,
      patrolTarget: null,
      scanTimer: 0,
      desiredAngle: this.angle,
      coverSpot: null,
      coverThreat: null,
      peekDir: null,
      peekTime: 0,
      flankPoint: null,
      flankAnchor: null,
      flankSide: 0,
      retreatSpot: null,
      retreatUntil: 0,
      fireHold: 0,
      burstLeft: 0,
      blindTimer: 0,        // flashbang blindness (Perception + tryShoot)
      trackTime: 0,         // continuous LOS duration; reduces aim error over time
      grenadeTimer: 0,      // cooldown between AI grenade throws
      campTimer: 0,         // how long player has camped same cover spot
      campPos: null,        // cached player pos for camp detection
      forcedFlankSide: 0,   // set by SquadCoordinator for pincer flanks
      suppression: 0,       // 0..1 incoming-fire pressure (degrades aim, pins)
      avengeUntil: 0,       // morale: temporary aggression spike after a squad loss
      bark: null,           // current combat callout text (rendered above head)
      barkTimer: 0,         // remaining display time for the bark
    };
    this.hitByPlayer = false;     // assist tracking (XPSystem)
    this.lastHitExplosive = false; // 'demolition' challenge tagging
  }

  update(dt, game) {
    if (this.health <= 0) return;
    const bb = this.bb;
    bb.repathTimer -= dt;
    bb.fireHold -= dt;
    bb.grenadeTimer -= dt;
    bb.suppression = Math.max(0, bb.suppression - SUPPRESS_DECAY * dt);
    if (bb.barkTimer > 0) bb.barkTimer -= dt;

    // Stuck detection: if we have a path but haven't moved in 0.5s, scrap the
    // path so it gets recomputed from the current position next frame.
    // Keep patrolTarget intact so Patrol retries the same goal rather than
    // picking a new random one that may also be problematic.
    this._stuckTimer = (this._stuckTimer || 0) + dt;
    if (this._stuckTimer >= 0.5) {
      const moved = this._stuckCheckPos ? this.pos.distanceTo(this._stuckCheckPos) : 999;
      if (moved < 3 && bb.path) {
        bb.path = null;
        bb.repathTimer = 0;
      }
      this._stuckTimer = 0;
      this._stuckCheckPos = this.pos.clone();
    }

    this.perception.update(dt, game);
    TREE.tick(this, game, dt);

    // Tracking: accumulate continuous LOS time so aim improves with exposure.
    bb.trackTime = bb.canSee ? bb.trackTime + dt : Math.max(0, bb.trackTime - dt * 2);

    // Turn toward whatever the active behavior wants to face.
    const turn = (inCombat(this) ? TURN_SPEED * 2 : TURN_SPEED) * dt;
    const d = angleDiff(this.angle, bb.desiredAngle);
    this.angle = normalizeAngle(this.angle + clamp(d, -turn, turn));

    this.weapon.update(dt);
  }

  // ------------------------------------------------------- movement helpers

  /** Throttled A* request. `force` bypasses the throttle (new objectives). */
  requestPath(game, target, force = false) {
    const bb = this.bb;
    const targetMoved = !bb.pathGoal || bb.pathGoal.distanceTo(target) > 60;
    if (!force && !targetMoved && bb.path) return;
    if (!force && bb.repathTimer > 0) return;
    bb.repathTimer = 0.45;
    bb.path = game.ai.pathfinder.findPath(this.pos, target);
    bb.pathIndex = 0;
    bb.pathGoal = target.clone();
  }

  /**
   * Advance along bb.path. Returns 'moving' | 'done' | 'none'.
   * `keepAim` leaves desiredAngle to the behavior (combat moves shoot sideways).
   */
  followPath(dt, game, speed, keepAim = false) {
    const bb = this.bb;
    if (!bb.path || bb.path.length === 0) return 'none';
    let wp = bb.path[bb.pathIndex];
    while (wp && this.pos.distanceTo(wp) < 24) {
      bb.pathIndex++;
      wp = bb.path[bb.pathIndex];
    }
    if (!wp) {
      bb.path = null;
      return 'done';
    }
    const dir = wp.clone().sub(this.pos).normalize();
    this.moveDir(dt, game, dir, speed, keepAim);
    return 'moving';
  }

  /** Collision-resolved step in a direction. */
  moveDir(dt, game, dir, speed, keepAim = false) {
    game.map.collision.moveCircle(this.pos, dir.x * speed * dt, dir.y * speed * dt, this.radius);
    if (!keepAim) this.bb.desiredAngle = Math.atan2(dir.y, dir.x);
  }

  // --------------------------------------------------------- combat helpers

  /**
   * Fire at the player in bursts with human-ish trigger discipline.
   * Only fires when the barrel is actually pointed near the target; aim noise
   * comes from DifficultyScaler plus any `extraSpread` (blind suppression).
   */
  tryShoot(game, dt, extraSpread = 0) {
    const bb = this.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.canSee ? targetEntity.pos : bb.lastKnownPos;
    if (!target) return;

    // Dry mag: stop and reload rather than dry-firing forever.
    if (this.weapon.ammo <= 0) { this.reloadInCover(); return; }
    if (this.weapon.reloading || bb.fireHold > 0 || bb.blindTimer > 0) return;

    // --- predictive aim: lead a moving target by its bullet flight time ---
    // Better soldiers (leadSkill) and longer tracking lead more accurately.
    let aimX = target.x, aimY = target.y;
    const tv = targetEntity.vel;
    if (bb.canSee && tv) {
      const flight = this.pos.distanceTo(target) / this.weapon.bulletSpeed;
      const lead = this.personality.leadSkill * (0.45 + 0.55 * Math.min(bb.trackTime / 2, 1));
      aimX += tv.x * flight * lead;
      aimY += tv.y * flight * lead;
    }

    const toTarget = Math.atan2(aimY - this.pos.y, aimX - this.pos.x);
    if (Math.abs(angleDiff(this.angle, toTarget)) > 0.18) return; // still bringing the gun around

    // Start a new burst when the previous one is exhausted.
    if (bb.burstLeft <= 0) {
      bb.burstLeft = this.weapon.auto ? 3 + Math.floor(Math.random() * 4) : 1;
    }

    // Aim error: difficulty baseline × this soldier's accuracy, tightened by
    // continuous tracking (up to 35% at 2s) and loosened by suppression and any
    // caller-supplied spread (blind fire).
    const trackBonus = Math.min(bb.trackTime / 2, 1) * 0.35;
    const err = game.difficulty.params.aimError * this.personality.aimErrorMult
      * (1 - trackBonus) + bb.suppression * 0.16 + extraSpread;
    const aim = toTarget + gaussian() * err;
    if (this.weapon.tryFire(game, this, aim)) {
      this.lastShotTime = game.time;
      bb.burstLeft--;
      if (bb.burstLeft <= 0) bb.fireHold = 0.25 + Math.random() * 0.5; // breathe between bursts
    }
  }

  /** Effective push aggression for this soldier (difficulty × personality × morale). */
  aggression(game) {
    const avenge = game.time < this.bb.avengeUntil ? 1.4 : 1;
    return game.difficulty.params.aggression * this.personality.aggressionMult * avenge;
  }

  /** Reload when it's safe to (no current line of sight) or the mag is empty. */
  reloadInCover() {
    if (this.weapon.reloading) return;
    if (this.weapon.ammo === 0 || this.weapon.ammo < this.weapon.magSize * 0.35) {
      this.weapon.startReload();
      this.say('reload', 2.4);
    }
  }

  /** Incoming near-miss: rattle this soldier (worse aim, may go to ground). */
  onSuppressed(amount, attacker) {
    const bb = this.bb;
    bb.suppression = Math.min(1, bb.suppression + amount / this.personality.suppressResist);
    // Being shot at is a directional cue even without seeing the shooter.
    if (attacker && bb.timeSinceSeen > 1.2 && bb.awareness < 0.5) {
      bb.awareness = Math.max(bb.awareness, 0.4);
      bb.alertPos = attacker.pos.clone();
      bb.alertTimer = 0;
    }
    if (bb.suppression > 0.55 && bb.barkTimer <= 0 && Math.random() < 0.04) this.say('pinned', 1.4);
  }

  /** Queue a combat bark (won't interrupt one already showing). */
  say(kind, dur = 1.6) {
    if (this.bb.barkTimer > 0 || this.health <= 0) return;
    this.bb.bark = choice(BARKS[kind] || [kind]);
    this.bb.barkTimer = dur;
  }

  damage(game, amount, fromPos, attacker) {
    if (this.health <= 0) return;
    this.health -= amount;

    // Getting shot is perfect information about roughly where it came from.
    const bb = this.bb;
    bb.awareness = 1;
    if (attacker === game.player) this.hitByPlayer = true;
    // Getting shot = perfect intel on the attacker, regardless of team.
    if (attacker && attacker.team !== this.team) {
      bb.awareness = 1;
      bb.target = attacker;
      bb.lastKnownPos = attacker.pos.clone();
      bb.timeSinceSeen = 0;
      if (!bb.spotAnnounced) {
        bb.spotAnnounced = true;
        game.events.emit('enemy:spotted', { enemy: this, pos: attacker.pos.clone() });
      }
    }

    if (this.health <= 0) this.die(game, attacker);
  }

  die(game, killer) {
    this.health = 0;
    game.map.cover.release(this);
    game.effects.hitSpark(this.pos.x, this.pos.y, '#b8362a', 14);
    game.events.emit('enemy:killed', { enemy: this, by: killer, explosive: this.lastHitExplosive });
  }
}
