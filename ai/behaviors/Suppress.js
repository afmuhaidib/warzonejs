// ai/behaviors/Suppress.js — Squad anchor role. Hold a cover spot at range and
// keep rounds going downrange at the player's last known position — including
// blind bursts when sight is lost — so the player stays pinned while the
// flanker works. Never advances; that's the flanker's job.
// Dependencies: BehaviorTree (Action).

import { Action, RUNNING } from '../BehaviorTree.js';

const BLIND_FIRE_WINDOW = 2.5;  // keep shooting this long after losing sight
const BLIND_SPREAD = 0.16;

export function Suppress() {
  return new Action((e, game, dt) => {
    e.state = 'suppress';
    const bb = e.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.canSee ? targetEntity.pos : bb.lastKnownPos;
    bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);

    // Anchor at cover (re-pick only when missing — suppressors don't chase).
    if (!bb.coverSpot) {
      bb.coverSpot = game.map.cover.findSpot(e.pos, target, 360, e);
      bb.coverThreat = target.clone();
    }
    if (bb.coverSpot && e.pos.distanceTo(bb.coverSpot.pos) > 18) {
      e.requestPath(game, bb.coverSpot.pos);
      e.followPath(dt, game, e.runSpeed, true);
    }

    if (bb.canSee) {
      e.say('suppress', 2);
      e.tryShoot(game, dt);
    } else if (bb.timeSinceSeen < BLIND_FIRE_WINDOW) {
      // Suppressive fire: walk rounds around the last known position.
      e.tryShoot(game, dt, BLIND_SPREAD);
    }
    return RUNNING;
  });
}
