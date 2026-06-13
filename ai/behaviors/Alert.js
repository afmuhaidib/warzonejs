// ai/behaviors/Alert.js — Reaction beat between hearing something and acting on
// it: snap to face the alert position, hold for a short "what was that?" pause,
// then promote the alert into an Investigate target. Converging enemies use the
// squad's shared flow field when one is live for the same contact.
// Dependencies: BehaviorTree (Action).

import { Action, RUNNING } from '../BehaviorTree.js';

const REACT_PAUSE = 0.7;

export function Alert() {
  return new Action((e, game, dt) => {
    e.state = 'alert';
    const bb = e.bb;

    bb.desiredAngle = Math.atan2(bb.alertPos.y - e.pos.y, bb.alertPos.x - e.pos.x);
    bb.alertTimer += dt;

    if (bb.alertTimer >= REACT_PAUSE) {
      bb.investigatePos = bb.alertPos;
      bb.alertPos = null;
      bb.path = null;
    }
    return RUNNING;
  });
}
