// ai/behaviors/Investigate.js — Move to the last suspicious position (heard
// sound, squad callout, or where the player vanished) using the shared flow
// field when it points there, A* otherwise; scan on arrival; stand down if
// nothing turns up. Sight contact preempts this branch via the combat sequence.
// Dependencies: BehaviorTree (Action), FlowField (via game.ai).

import { Action, RUNNING } from '../BehaviorTree.js';
import { randRange } from '../../utils/MathUtils.js';

export function Investigate() {
  return new Action((e, game, dt) => {
    e.state = 'investigate';
    const bb = e.bb;
    const target = bb.investigatePos;

    // Arrived: sweep the area, then forget and stand down.
    if (e.pos.distanceTo(target) < 55) {
      if (bb.searchTimer === undefined || bb.searchTimer === null) bb.searchTimer = randRange(1.8, 3);
      bb.searchTimer -= dt;
      bb.desiredAngle = e.angle + dt * 2.2;
      if (bb.searchTimer <= 0) {
        bb.investigatePos = null;
        bb.searchTimer = null;
        bb.awareness = Math.min(bb.awareness, 0.3);
      }
      return RUNNING;
    }
    bb.searchTimer = null;

    // Group convergence: ride the shared flow field if it targets this spot.
    const ff = game.ai.flowField;
    const ffDir = ff.valid && nearField(ff, target, game) ? ff.dirAt(e.pos.x, e.pos.y) : null;
    if (ffDir) {
      e.moveDir(dt, game, ffDir, e.runSpeed * 0.85);
      bb.desiredAngle = Math.atan2(ffDir.y, ffDir.x);
    } else {
      e.requestPath(game, target);
      e.followPath(dt, game, e.runSpeed * 0.85);
    }
    return RUNNING;
  });
}

function nearField(ff, target, game) {
  const col = game.map.collision;
  const dx = ff.targetTx - col.worldToTile(target.x);
  const dy = ff.targetTy - col.worldToTile(target.y);
  return Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
}
