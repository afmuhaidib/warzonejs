// ai/behaviors/Patrol.js — Default idle behavior: walk a route between random
// patrol points at half speed, pausing at each to scan (slow rotation sweep).
// Lowest-priority branch; anything else preempts it.
// Dependencies: BehaviorTree (Action), enemy path helpers.

import { Action, RUNNING } from '../BehaviorTree.js';
import { randRange } from '../../utils/MathUtils.js';

export function Patrol() {
  return new Action((e, game, dt) => {
    e.state = 'patrol';
    const bb = e.bb;

    if (bb.scanTimer > 0) {
      bb.scanTimer -= dt;
      bb.desiredAngle = e.angle + dt * 1.2; // slow lookaround sweep
      return RUNNING;
    }

    if (!bb.patrolTarget) {
      bb.patrolTarget = game.map.randomPatrolPoint();
      e.requestPath(game, bb.patrolTarget, true); // force-compute immediately
    } else {
      // Periodic repath (throttled inside requestPath to every ~0.45 s)
      // so enemies recover from dead-end paths without waiting for stuck detection.
      e.requestPath(game, bb.patrolTarget);
    }

    const res = e.followPath(dt, game, e.walkSpeed);
    if (res === 'done' || res === 'none') {
      bb.patrolTarget = null;
      bb.scanTimer = randRange(1.2, 2.8);
    }
    return RUNNING;
  });
}
