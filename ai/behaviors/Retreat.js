// ai/behaviors/Retreat.js — Self-preservation: triggered by the tree when
// health is critical. Break contact toward a cover spot well away from the
// player, reload behind it, and watch the approach. Time-boxed — after the
// window closes the enemy re-engages (cornered rats fight).
// Dependencies: BehaviorTree (Action), CoverSystem (via game.map.cover).

import { Action, RUNNING } from '../BehaviorTree.js';

export const RETREAT_HEALTH = 35;
export const RETREAT_WINDOW = 5; // seconds of falling back before re-engaging

export function Retreat() {
  return new Action((e, game, dt) => {
    e.state = 'retreat';
    const bb = e.bb;
    e.say('retreat', 1.6);
    const targetEntity = bb.target || game.player;
    const threat = bb.lastKnownPos || targetEntity.pos;

    if (!bb.retreatSpot) {
      bb.retreatSpot = game.map.cover.findSpot(e.pos, threat, 620, e, { minThreatDist: 330 });
    }

    if (bb.retreatSpot && e.pos.distanceTo(bb.retreatSpot.pos) > 20) {
      e.requestPath(game, bb.retreatSpot.pos);
      e.followPath(dt, game, e.runSpeed * 1.1, true); // sprint out, gun on the threat
      bb.desiredAngle = Math.atan2(threat.y - e.pos.y, threat.x - e.pos.x);
    } else {
      // In (or out of) cover: top off the mag and cover the approach.
      e.weapon.startReload();
      bb.desiredAngle = Math.atan2(threat.y - e.pos.y, threat.x - e.pos.x);
      if (bb.canSee) e.tryShoot(game, dt); // they followed us — fight
    }
    return RUNNING;
  });
}

/** Tree guard: low health AND still inside the retreat window. */
export function shouldRetreat(e, game) {
  const bb = e.bb;
  // Per-soldier nerve: brave troops fight on at lower health, cautious ones bail
  // sooner. Avenging soldiers (recent squad loss) refuse to break contact.
  const threshold = (e.personality?.retreatHealth ?? RETREAT_HEALTH);
  if (game.time < bb.avengeUntil || e.health >= threshold || bb.timeSinceSeen > 8) {
    bb.retreatUntil = 0;
    bb.retreatSpot = null;
    return false;
  }
  if (!bb.retreatUntil) bb.retreatUntil = game.time + RETREAT_WINDOW;
  return game.time < bb.retreatUntil;
}
