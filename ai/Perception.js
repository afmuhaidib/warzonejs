// ai/Perception.js — Per-enemy senses: vision cone + LOS raycast + hearing,
// feeding an awareness meter (0..1) that models reaction time. No omniscience:
// an enemy only knows the player's position via its own eyes, its ears, or a
// squad callout. Crouching shrinks the player's visibility; sprinting and a
// hot muzzle boost it. Awareness fill rate scales with proximity and with
// DifficultyScaler's reactionTime.
// Dependencies: world/CollisionMap + DifficultyScaler (via game), utils/MathUtils.

import { angleDiff } from '../utils/MathUtils.js';

const BASE_VIEW_DIST = 430;
const FOV_HALF = 0.96;          // ~110° cone
const AWARENESS_DECAY = 0.18;   // per second when target not visible
const HEARING_AWARENESS = 0.35; // a heard sound primes but doesn't reveal

export class Perception {
  constructor(enemy) {
    this.enemy = enemy;
    this.viewDist = BASE_VIEW_DIST;
    this.fovHalf = FOV_HALF;
  }

  update(dt, game) {
    const e = this.enemy;
    const bb = e.bb;

    bb.timeSinceSeen += dt;
    bb.canSee = false;

    // Flashbanged: eyes closed — no vision processing at all.
    bb.blindTimer = Math.max(0, (bb.blindTimer || 0) - dt);

    if (bb.blindTimer > 0) {
      bb.awareness = Math.max(0, bb.awareness - AWARENESS_DECAY * dt);
      return;
    }

    // Build all valid targets: any entity not on this enemy's team.
    const targets = [];
    if (game.player.alive && game.player.team !== e.team) targets.push(game.player);
    for (const f of (game.friendlies || [])) {
      if (f.alive && f.team !== e.team) targets.push(f);
    }
    // FFA: enemies also perceive other enemies (different team = hostile).
    for (const other of game.ai.enemies) {
      if (other !== e && other.health > 0 && other.team !== e.team) targets.push(other);
    }

    if (targets.length === 0) {
      bb.awareness = Math.max(0, bb.awareness - AWARENESS_DECAY * dt);
      return;
    }

    // Pick the closest visible target; if none visible, pick overall nearest.
    let bestTarget = null;
    let bestDist = Infinity;
    let bestVisible = false;

    for (const t of targets) {
      let viewDist = this.viewDist;
      // Visibility modifiers from the player only (friendlies are always full-size).
      if (t === game.player) {
        if (t.prone) viewDist *= 0.4;
        else if (t.crouching || t.sliding) viewDist *= 0.55;
        if (t.sprinting) viewDist *= 1.2;
        if (game.time - t.lastShotTime < 0.5) viewDist *= 1.6;
      }

      const dist = e.pos.distanceTo(t.pos);
      if (dist > viewDist) continue;

      const toTarget = Math.atan2(t.pos.y - e.pos.y, t.pos.x - e.pos.x);
      const inCone = Math.abs(angleDiff(e.angle, toTarget)) < this.fovHalf || dist < 70;
      if (!inCone) continue;

      const los = game.map.collision.lineOfSight(e.pos, t.pos)
        && !(game.combat && game.combat.smoke.blocksLine(e.pos, t.pos));

      if (los && (!bestVisible || dist < bestDist)) {
        bestTarget = t;
        bestDist = dist;
        bestVisible = true;
      } else if (!bestVisible && dist < bestDist) {
        bestTarget = t;
        bestDist = dist;
      }
    }

    // Store the current priority target on the blackboard so behaviors can use it.
    // Only update when a target was actually detected (in range + in cone).
    // Leaving bb.target as-is when nothing is detected preserves the last known
    // priority target rather than blindly overwriting with an out-of-cone entity.
    if (bestTarget) bb.target = bestTarget;

    // --- awareness meter (reaction time) ---
    if (bestVisible) {
      const proximity = 1.25 - 0.85 * (bestDist / this.viewDist);
      // Per-soldier reaction time; heavy suppression keeps their head down and
      // slows recognition (you can blind-fire someone to buy a beat).
      const reaction = game.difficulty.params.reactionTime * e.personality.reactionMult;
      const supp = 1 - Math.min(bb.suppression, 0.6) * 0.5;
      bb.awareness += (proximity * supp / reaction) * dt;
      if (bb.awareness >= 1) {
        bb.awareness = 1;
        bb.canSee = true;
        bb.lastKnownPos = bestTarget.pos.clone();
        bb.timeSinceSeen = 0;
        if (!bb.spotAnnounced) {
          bb.spotAnnounced = true;
          e.say('contact');
          game.events.emit('enemy:spotted', { enemy: e, pos: bestTarget.pos.clone() });
        }
      }
    } else {
      bb.awareness = Math.max(0, bb.awareness - AWARENESS_DECAY * dt);
      if (bb.awareness < 0.5) bb.spotAnnounced = false;
      // Memory drift: after losing sight, the remembered position becomes
      // increasingly uncertain — enemies can't perfectly predict where you went.
      if (bb.lastKnownPos && bb.timeSinceSeen > 1.5) {
        const drift = Math.min((bb.timeSinceSeen - 1.5) * 4, 1) * 28 * dt;
        bb.lastKnownPos.x += (Math.random() - 0.5) * drift;
        bb.lastKnownPos.y += (Math.random() - 0.5) * drift;
      }
    }
  }

  /** A sound event reached this enemy: prime awareness, mark the spot to check. */
  hear(pos, game) {
    const bb = this.enemy.bb;
    bb.awareness = Math.max(bb.awareness, HEARING_AWARENESS);
    // Don't let a footstep overwrite hard intel from actual sight.
    if (bb.timeSinceSeen > 2.5) {
      bb.alertPos = pos.clone();
      bb.alertTimer = 0;
    }
  }
}
