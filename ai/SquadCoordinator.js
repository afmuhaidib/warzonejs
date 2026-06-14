// ai/SquadCoordinator.js — Squad-level brains. Two jobs:
// 1. Communication: when one enemy spots the player ('enemy:spotted'), the
//    contact position propagates to every enemy in earshot/radio range, and a
//    shared flow field toward the contact is computed for converging runners.
// 2. Tactics: for each squad in contact, assign roles — the member with the
//    best sight line anchors as 'suppress' (pins the player with fire), the
//    next-closest becomes 'flank' (swings wide for a side angle), the rest run
//    plain 'engage'. Roles are re-dealt every second as the fight moves.
//    Bait & Ambush: when a squad has 3+ members and the player has been in one
//    spot for a while, one member (decoy) runs a visible crossing to draw
//    attention while 1–2 ambushers silently flank from the sides.
// Dependencies: EventBus + AIManager's enemy list (via game).

import { Vector2 } from '../utils/Vector2.js';

const ALERT_RADIUS = 320;     // how far a spot callout carries (squad radio range)
const CONTACT_MEMORY = 5;     // seconds since last sight that counts as "in contact"
const REASSIGN_INTERVAL = 1;

// Bait & ambush tuning
const BAIT_CAMP_THRESHOLD = 8;    // seconds player holds the same area before triggering
const BAIT_CAMP_RADIUS = 120;     // movement within this radius counts as "same spot"
const BAIT_MIN_SQUAD = 3;         // need at least 3 to spare one as bait
const BAIT_LOCK_DURATION = 7;     // seconds the bait plan is locked in (no role re-deal)
const AMBUSH_SPREAD_ANGLE = 1.65; // radians: ambush positions fan out from decoy escape

export class SquadCoordinator {
  constructor(game) {
    this.game = game;
    this.timer = 0;

    // Per-squad bait state (keyed by squad id).
    this._baitPlans = new Map();
    // Per-squad camp tracker (keyed by squad id).
    this._campTrackers = new Map();

    game.events.on('enemy:spotted', ({ enemy, pos }) => this.propagate(enemy, pos));
    game.events.on('player:respawned', () => this.reset());
    // If the decoy takes a hit, trigger the ambushers immediately.
    game.events.on('enemy:damaged', ({ enemy }) => this._onDecoyHit(enemy));
  }

  /** Spread the contact to nearby enemies and refresh the shared flow field. */
  propagate(spotter, pos) {
    const ai = this.game.ai;
    // Friendlies share the enemy brain (and its Perception), so they emit the
    // same 'enemy:spotted' event. Only genuine enemy contacts may propagate
    // across the enemy squad radio — otherwise a teammate spotting a hostile
    // would hand the enemy team free intel.
    if (!ai.enemies.includes(spotter)) return;
    ai.flowField.compute(pos);
    for (const e of ai.enemies) {
      if (e === spotter || e.health <= 0) continue;
      const inRange = e.pos.distanceTo(spotter.pos) < ALERT_RADIUS;
      const sameSquad = e.squad === spotter.squad; // squad radios always reach
      if (!inRange && !sameSquad) continue;
      // Same-squad radio gives stronger intel; nearby enemies get less.
      const boost = sameSquad ? 0.55 : 0.3;
      e.bb.awareness = Math.max(e.bb.awareness, boost);
      if (e.bb.timeSinceSeen > 2) {
        e.bb.alertPos = pos.clone();
        e.bb.alertTimer = 0;
      }
    }
  }

  reset() {
    this._baitPlans.clear();
    this._campTrackers.clear();
    for (const e of this.game.ai.enemies) {
      const bb = e.bb;
      bb.awareness = 0;
      bb.canSee = false;
      bb.lastKnownPos = null;
      bb.alertPos = null;
      bb.investigatePos = null;
      bb.role = null;
      bb.spotAnnounced = false;
      bb.timeSinceSeen = 999;
      bb.suppression = 0;
      bb.avengeUntil = 0;
      bb.barkTimer = 0;
      bb.decoyTimer = 0;
      bb.decoyRunPoint = null;
      bb.decoyEscapeTarget = null;
      bb.ambushPos = null;
      bb.ambushFired = false;
      bb.ambushWaitTimer = 0;
    }
  }

  /** If an enemy with role=decoy takes damage, immediately trigger all ambushers. */
  _onDecoyHit(enemy) {
    if (enemy.bb.role !== 'decoy') return;
    const plan = this._baitPlans.get(enemy.squad);
    if (!plan) return;
    for (const ambusher of plan.ambushers) {
      if (ambusher.health > 0) ambusher.bb.ambushFired = true;
    }
  }

  /**
   * Update camp timers and decide whether a squad should trigger a bait plan.
   * Called each REASSIGN_INTERVAL before roles are re-dealt.
   */
  _updateBaitPlans(dt, squads) {
    const { player, time } = this.game;

    for (const [squadId, members] of squads) {
      // Check if an existing bait plan is still locked in.
      const existing = this._baitPlans.get(squadId);
      if (existing) {
        if (time < existing.lockUntil) {
          // Keep the plan alive — re-apply roles every tick so normal
          // reassignment doesn't clobber them.
          this._applyBaitRoles(existing);
          continue; // don't overwrite with normal roles
        } else {
          // Plan expired — clear everything.
          this._clearBaitPlan(existing);
          this._baitPlans.delete(squadId);
        }
      }

      // Only squads with enough members may attempt a bait.
      if (members.length < BAIT_MIN_SQUAD) continue;

      // Track how long the player has been in roughly the same spot.
      let tracker = this._campTrackers.get(squadId);
      if (!tracker) {
        tracker = { pos: player.pos.clone(), timer: 0 };
        this._campTrackers.set(squadId, tracker);
      }
      if (player.pos.distanceTo(tracker.pos) > BAIT_CAMP_RADIUS) {
        tracker.pos = player.pos.clone();
        tracker.timer = 0;
      } else {
        tracker.timer += REASSIGN_INTERVAL;
      }

      if (tracker.timer < BAIT_CAMP_THRESHOLD) continue;

      // Player has been camping — pick roles and launch the bait plan.
      tracker.timer = 0; // reset so another plan doesn't fire immediately
      this._launchBaitPlan(squadId, members);
    }
  }

  /** Choose decoy + ambushers and set their bb fields. */
  _launchBaitPlan(squadId, members) {
    const { player } = this.game;
    const playerPos = player.pos;

    // Decoy: prefer Rifleman (highest personality.teamwork closer to 0.5), avoid
    // low-health soldiers and Veteran (too valuable to waste as bait).
    const candidates = members.filter(m => m.health > 55)
      .sort((a, b) => Math.abs(a.personality.teamwork - 0.5) - Math.abs(b.personality.teamwork - 0.5));
    if (candidates.length < 2) return; // not enough healthy soldiers

    const decoy = candidates[0];

    // Escape target: a point behind and to the side of the player — leads the
    // player's gaze further away from where the ambushers will be.
    const awayAngle = Math.atan2(decoy.pos.y - playerPos.y, decoy.pos.x - playerPos.x);
    const escapeTarget = new Vector2(
      playerPos.x + Math.cos(awayAngle) * 200,
      playerPos.y + Math.sin(awayAngle) * 200
    );

    // Ambushers: up to 2 remaining members, prefer high-teamwork personalities.
    const rest = candidates.slice(1).sort((a, b) => b.personality.teamwork - a.personality.teamwork);
    const ambushers = rest.slice(0, 2);

    // Ambush positions: fan out perpendicular to the decoy escape route so each
    // ambusher has a different firing angle.
    const sides = [1, -1];
    for (let i = 0; i < ambushers.length; i++) {
      const sideAngle = awayAngle + AMBUSH_SPREAD_ANGLE * sides[i];
      ambushers[i].bb.ambushPos = new Vector2(
        playerPos.x + Math.cos(sideAngle) * 180,
        playerPos.y + Math.sin(sideAngle) * 180
      );
      ambushers[i].bb.decoyEscapeTarget = escapeTarget; // shared for trigger detection
      ambushers[i].bb.ambushFired = false;
      ambushers[i].bb.ambushWaitTimer = 0;
    }

    decoy.bb.decoyEscapeTarget = escapeTarget;
    decoy.bb.decoyTimer = 0;
    decoy.bb.decoyRunPoint = null;

    const plan = {
      decoy,
      ambushers,
      lockUntil: this.game.time + BAIT_LOCK_DURATION,
    };
    this._baitPlans.set(squadId, plan);
    this._applyBaitRoles(plan);
  }

  /** Re-stamp roles from an active plan (called every reassign tick while locked). */
  _applyBaitRoles(plan) {
    plan.decoy.bb.role = 'decoy';
    for (const a of plan.ambushers) {
      if (a.health > 0) a.bb.role = 'ambush';
    }
  }

  /** Clear all bait-related bb fields when a plan expires. */
  _clearBaitPlan(plan) {
    const clear = (e) => {
      if (e.health <= 0) return;
      e.bb.role = null;
      e.bb.decoyTimer = 0;
      e.bb.decoyRunPoint = null;
      e.bb.decoyEscapeTarget = null;
      e.bb.ambushPos = null;
      e.bb.ambushFired = false;
      e.bb.ambushWaitTimer = 0;
    };
    clear(plan.decoy);
    plan.ambushers.forEach(clear);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = REASSIGN_INTERVAL;
    this.assignRoles();
  }

  assignRoles() {
    const { ai, player } = this.game;

    // Group members currently in contact, per squad.
    const squads = new Map();
    for (const e of ai.enemies) {
      // Don't null the role here — bait plan locks may need to preserve it.
      if (e.bb.timeSinceSeen < CONTACT_MEMORY && e.bb.lastKnownPos) {
        if (!squads.has(e.squad)) squads.set(e.squad, []);
        squads.get(e.squad).push(e);
      } else {
        e.bb.role = null; // out of contact — release any role
      }
    }

    // Evaluate bait plans first. Squads with an active locked plan get their
    // roles re-stamped and are skipped for normal role assignment below.
    this._updateBaitPlans(REASSIGN_INTERVAL, squads);

    for (const [squadId, members] of squads) {
      // Skip squads currently executing a bait plan.
      if (this._baitPlans.has(squadId)) continue;

      // Clear combat roles for members not in a bait plan.
      for (const m of members) m.bb.role = null;

      if (members.length < 2) continue; // a lone enemy just engages

      // Suppressor: best current sight line (prefer canSee, then proximity).
      members.sort((a, b) => {
        if (a.bb.canSee !== b.bb.canSee) return a.bb.canSee ? -1 : 1;
        return a.pos.distanceSqTo(player.pos) - b.pos.distanceSqTo(player.pos);
      });
      members[0].bb.role = 'suppress';
      // Prefer a natural Flanker for the flank role: swap the best teamwork
      // soldier (excluding the suppressor) into slot 1.
      let fi = 1;
      for (let k = 2; k < members.length; k++) {
        if (members[k].personality.teamwork > members[fi].personality.teamwork) fi = k;
      }
      if (fi !== 1) { const t = members[1]; members[1] = members[fi]; members[fi] = t; }
      members[1].bb.role = 'flank';
      members[1].bb.flankSide = 1; // reset so forcedFlankSide takes effect next pick
      members[1].bb.forcedFlankSide = 1;
      // Third member: pincer from the opposite flank.
      if (members.length >= 3) {
        members[2].bb.role = 'flank';
        members[2].bb.flankSide = 0; // reset so it picks up the forced side
        members[2].bb.forcedFlankSide = -1;
        if (members[2].bb.flankPoint &&
            members[2].bb.flankSide === members[1].bb.flankSide) {
          members[2].bb.flankPoint = null; // force re-pick on opposite side
        }
      }
      // members[3+] keep role null -> default Engage branch.
    }
  }
}
