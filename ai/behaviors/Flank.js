// ai/behaviors/Flank.js — Squad maneuver role. While the suppressor pins the
// player, swing wide to a point ~110° around the player from our current
// bearing and come in from the side. Holds fire on the move (don't give the
// flank away) until line of sight at killing range. Flank point re-plans as
// the player relocates.
// Dependencies: BehaviorTree (Action), Pathfinder (via enemy helpers).

import { Action, RUNNING } from '../BehaviorTree.js';
import { Vector2 } from '../../utils/Vector2.js';

const FLANK_RADIUS = 240;
const FLANK_ANGLE = 1.9;       // radians around the target to swing
const REPLAN_DIST = 200;       // player moved this far -> new flank point
const OPEN_FIRE_DIST = 380;

export function Flank() {
  return new Action((e, game, dt) => {
    e.state = 'flank';
    const bb = e.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.canSee ? targetEntity.pos : bb.lastKnownPos;

    // Pick (or re-pick) the swing point around the target.
    if (!bb.flankPoint || bb.flankAnchor.distanceTo(target) > REPLAN_DIST) {
      const fromTarget = Math.atan2(e.pos.y - target.y, e.pos.x - target.x);
      const side = bb.flankSide || (bb.flankSide = bb.forcedFlankSide || (Math.random() < 0.5 ? 1 : -1));
      const a = fromTarget + FLANK_ANGLE * side;
      bb.flankPoint = new Vector2(
        target.x + Math.cos(a) * FLANK_RADIUS,
        target.y + Math.sin(a) * FLANK_RADIUS
      );
      bb.flankAnchor = target.clone();
      bb.path = null;
      e.say('flank', 1.8);
    }

    const arrived = e.pos.distanceTo(bb.flankPoint) < 40;
    if (!arrived) {
      e.requestPath(game, bb.flankPoint);
      const res = e.followPath(dt, game, e.runSpeed);
      if (res === 'none') bb.flankPoint = null; // unreachable; re-pick next tick
    }

    const dist = e.pos.distanceTo(target);
    if (bb.canSee && (dist < OPEN_FIRE_DIST || arrived)) {
      bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);
      e.tryShoot(game, dt);
      if (arrived) bb.flankPoint = null; // position taken; fight from here
    }
    return RUNNING;
  });
}
