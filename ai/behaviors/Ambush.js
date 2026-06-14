// ai/behaviors/Ambush.js — Silent flanker waiting for the kill signal. Unlike
// the regular Flank behavior, an ambusher holds fire entirely until the trigger
// fires: the decoy gets hit, the player moves toward the decoy, or the patience
// timer expires. While waiting, it moves quietly to a side position and sits
// still. Once triggered (bb.ambushFired=true), it opens up with full aggression.
// SquadCoordinator sets bb.role='ambush', bb.ambushPos, and bb.ambushFired.

import { Action, RUNNING } from '../BehaviorTree.js';
import { Vector2 } from '../../utils/Vector2.js';

// Distance to classify as "player moving toward decoy".
const CHASE_DIST_THRESHOLD = 200;
// Patience: fire anyway after this many seconds of waiting in position.
const MAX_WAIT = 4.5;

export function Ambush() {
  return new Action((e, game, dt) => {
    e.state = 'ambush';
    const bb = e.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.lastKnownPos || targetEntity.pos;

    bb.ambushWaitTimer = (bb.ambushWaitTimer ?? 0) + dt;

    // --- Check trigger conditions ---
    if (!bb.ambushFired) {
      // Decoy took a hit (coordinator sets bb.ambushFired on all ambushers).
      // Player started moving toward the decoy (closed distance significantly).
      const decoyPos = bb.decoyEscapeTarget; // coordinator shares this
      const playerChasing = decoyPos && targetEntity.pos.distanceTo(decoyPos) < CHASE_DIST_THRESHOLD;
      // Patience expired.
      const impatient = bb.ambushWaitTimer > MAX_WAIT;

      if (playerChasing || impatient) {
        bb.ambushFired = true;
        e.say('ambushOpen', 1.6);
      }
    }

    // --- Phase 1: silently reposition ---
    const ambushPos = bb.ambushPos;
    if (!ambushPos) return RUNNING; // waiting for coordinator

    const atPos = e.pos.distanceTo(ambushPos) < 30;
    if (!atPos) {
      // Move quietly — no barks, no shooting.
      e.requestPath(game, ambushPos);
      e.followPath(dt, game, e.runSpeed, true);
      // Face the player's last known pos while moving so we're ready to snap aim.
      bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
      return RUNNING;
    }

    // --- Phase 2: hold position silently, watching ---
    if (!bb.ambushFired) {
      // Completely still and silent — don't even face the player aggressively
      // (avoids the obvious "enemy is staring at me from the side" tell).
      // Just track slowly with desiredAngle.
      bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
      return RUNNING;
    }

    // --- Phase 3: fire! (ambush triggered) ---
    bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
    if (bb.canSee) e.tryShoot(game, dt);

    // After firing, treat this like a normal Engage (role cleared by coordinator
    // at next re-deal tick, which will happen within ~1s).
    return RUNNING;
  });
}
