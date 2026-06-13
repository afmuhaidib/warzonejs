// ai/behaviors/Engage.js — Default combat: fight from cover. Claim a cover spot
// that puts low cover between us and the player, move to it, and duck/peek:
// fire while we have line of sight, sidestep around the cover to re-acquire it
// when we don't. High aggression (difficulty) closes range instead of holding.
// Dependencies: BehaviorTree (Action), CoverSystem (via game.map.cover).

import { Action, RUNNING } from '../BehaviorTree.js';
import { Vector2 } from '../../utils/Vector2.js';

const COVER_SEARCH_DIST = 340;
const COVER_STALE_DIST = 240; // re-pick cover when the player moved this far
const GRENADE_THROW_SPEED = 480;
const GRENADE_COOLDOWN = 9;
const GRENADE_FUSE = 3.2;
const CAMP_THRESHOLD = 2.5; // seconds player stays in same area before AI throws

export function Engage() {
  return new Action((e, game, dt) => {
    e.state = 'engage';
    const bb = e.bb;
    const targetEntity = bb.target || game.player;
    const target = bb.canSee ? targetEntity.pos : bb.lastKnownPos;

    // Never chase the player into the spawn safe zone.
    if (game.map.inSpawnSafeZone(e.pos)) {
      // Back off to the nearest non-safe patrol point.
      const safePoint = game.map.randomPatrolPoint();
      e.requestPath(game, safePoint, true);
      e.followPath(dt, game, e.runSpeed, true);
      return RUNNING;
    }
    bb.desiredAngle = Math.atan2(target.y - e.pos.y, target.x - e.pos.x);

    // --- grenade throw when player camps the same cover ---
    if (bb.grenadeTimer <= 0 && bb.lastKnownPos && game.combat?.grenades) {
      // Track how long the player has been in roughly the same spot.
      if (!bb.campPos || bb.campPos.distanceTo(target) > 80) {
        bb.campPos = target.clone();
        bb.campTimer = 0;
      } else if (bb.canSee) {
        bb.campTimer += dt;
      }
      if (bb.campTimer >= CAMP_THRESHOLD) {
        bb.campTimer = 0;
        bb.grenadeTimer = GRENADE_COOLDOWN;
        e.say('grenade', 1.4);
        const throwDir = new Vector2(target.x - e.pos.x, target.y - e.pos.y).normalize();
        game.combat.grenades.live.push({
          pos: e.pos.clone().add(throwDir.clone().scale(20)),
          vel: throwDir.scale(GRENADE_THROW_SPEED),
          fuse: GRENADE_FUSE,
          thrower: e,
        });
      }
    }

    // --- cover bookkeeping ---
    const stale = !bb.coverSpot
      || (bb.coverThreat && bb.coverThreat.distanceTo(target) > COVER_STALE_DIST);
    if (stale) {
      bb.coverSpot = game.map.cover.findSpot(e.pos, target, COVER_SEARCH_DIST, e);
      bb.coverThreat = target.clone();
      bb.path = null;
    }

    const dist = e.pos.distanceTo(target);
    const tooFar = dist > e.weapon.range * 0.75;
    // Heavy suppression nails a soldier to their cover — they won't push.
    const pinned = bb.suppression > 0.5;
    const pushing = !pinned && e.aggression(game) > 0.7 && dist > 160;

    // No usable cover, out of range, or feeling aggressive: advance on the target.
    if (!bb.coverSpot || tooFar || (pushing && bb.canSee)) {
      if (dist > 140) {
        e.requestPath(game, target);
        e.followPath(dt, game, e.runSpeed, true);
      }
      if (bb.canSee) e.tryShoot(game, dt);
      return RUNNING;
    }

    // --- hold the cover spot ---
    const atSpot = e.pos.distanceTo(bb.coverSpot.pos) < 18;
    if (!atSpot) {
      e.requestPath(game, bb.coverSpot.pos);
      e.followPath(dt, game, e.runSpeed, true);
      if (bb.canSee) e.tryShoot(game, dt);
      return RUNNING;
    }

    if (bb.canSee) {
      bb.peekDir = null;
      e.tryShoot(game, dt);
    } else if (pinned) {
      // Head down behind cover: stay put, reload, wait out the pressure.
      e.reloadInCover();
    } else {
      // Safe behind cover with no target: top off the magazine now.
      e.reloadInCover();
      // Peek: sidestep perpendicular to the cover direction until LOS returns.
      if (!bb.peekDir) {
        const perp = bb.coverSpot.coverDir.perp();
        bb.peekDir = Math.random() < 0.5 ? perp : perp.scale(-1);
        bb.peekTime = 0;
      }
      bb.peekTime += dt;
      e.moveDir(dt, game, bb.peekDir, e.walkSpeed * 0.8);
      if (bb.peekTime > 1.1) { // blocked this way; try the other shoulder
        bb.peekDir = bb.peekDir.clone().scale(-1);
        bb.peekTime = 0;
      }
    }
    return RUNNING;
  });
}
