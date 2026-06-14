// ai/behaviors/Decoy.js — Bait role. Deliberately exposes itself to draw the
// player's attention while ambushers silently reposition. The decoy sprints
// across a visible gap or peeks repeatedly, then "retreats" along a pre-planned
// escape route toward the ambushers' position. It barks loudly to sell the
// performance and genuinely tries to survive (uses cover on the escape path).
// SquadCoordinator sets bb.role='decoy' and bb.decoyEscapeTarget.

import { Action, RUNNING } from '../BehaviorTree.js';
import { Vector2 } from '../../utils/Vector2.js';

// How long to stay exposed before sprinting the escape route.
const EXPOSE_DURATION = 2.2;
// How far in front of the player the decoy aims to cross (the "gap run").
const GAP_OFFSET = 180;

export function Decoy() {
  return new Action((e, game, dt) => {
    e.state = 'decoy';
    const bb = e.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.lastKnownPos || targetEntity.pos;

    bb.decoyTimer = (bb.decoyTimer ?? 0) + dt;

    // Phase 1: run across the player's view (EXPOSE_DURATION seconds).
    if (bb.decoyTimer < EXPOSE_DURATION) {
      // Pick an exposure crossing point if we don't have one yet.
      if (!bb.decoyRunPoint) {
        const toPlayer = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
        // Aim for a point perpendicular to the player's facing — crossing their FOV.
        const perpAngle = toPlayer + Math.PI * 0.5 * (Math.random() < 0.5 ? 1 : -1);
        bb.decoyRunPoint = new Vector2(
          e.pos.x + Math.cos(perpAngle) * GAP_OFFSET,
          e.pos.y + Math.sin(perpAngle) * GAP_OFFSET
        );
        e.say('decoyExpose', 1.8);
      }

      // Bark "falling back" occasionally while exposed to sell the ruse.
      if (bb.barkTimer <= 0 && Math.random() < 0.02) e.say('decoyFleeing', 1.4);

      e.requestPath(game, bb.decoyRunPoint);
      const res = e.followPath(dt, game, e.runSpeed);

      // Return fire if spotted — decoy isn't completely passive.
      if (bb.canSee) {
        bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
        e.tryShoot(game, dt);
      }

      // Arrived at crossing point early — jump straight to escape phase.
      if (res === 'done' || (bb.decoyRunPoint && e.pos.distanceTo(bb.decoyRunPoint) < 40)) {
        bb.decoyTimer = EXPOSE_DURATION;
      }
      return RUNNING;
    }

    // Phase 2: sprint the escape route (toward bb.decoyEscapeTarget set by coordinator).
    const escapeTarget = bb.decoyEscapeTarget;
    if (!escapeTarget) return RUNNING; // coordinator hasn't set one yet; wait

    if (e.pos.distanceTo(escapeTarget) > 30) {
      e.requestPath(game, escapeTarget);
      e.followPath(dt, game, e.runSpeed * 1.05, true);
      // Keep gun loosely on the player while sprinting away — sells the panic.
      bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
      if (bb.barkTimer <= 0 && Math.random() < 0.015) e.say('retreat', 1.6);
    } else {
      // Reached safety — decoy role is finished; coordinator will re-assign next tick.
      bb.role = null;
      bb.decoyTimer = 0;
      bb.decoyRunPoint = null;
    }

    return RUNNING;
  });
}
