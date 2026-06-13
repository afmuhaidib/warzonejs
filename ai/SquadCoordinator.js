// ai/SquadCoordinator.js — Squad-level brains. Two jobs:
// 1. Communication: when one enemy spots the player ('enemy:spotted'), the
//    contact position propagates to every enemy in earshot/radio range, and a
//    shared flow field toward the contact is computed for converging runners.
// 2. Tactics: for each squad in contact, assign roles — the member with the
//    best sight line anchors as 'suppress' (pins the player with fire), the
//    next-closest becomes 'flank' (swings wide for a side angle), the rest run
//    plain 'engage'. Roles are re-dealt every second as the fight moves.
// Dependencies: EventBus + AIManager's enemy list (via game).

const ALERT_RADIUS = 320;     // how far a spot callout carries (squad radio range)
const CONTACT_MEMORY = 5;     // seconds since last sight that counts as "in contact"
const REASSIGN_INTERVAL = 1;

export class SquadCoordinator {
  constructor(game) {
    this.game = game;
    this.timer = 0;

    game.events.on('enemy:spotted', ({ enemy, pos }) => this.propagate(enemy, pos));
    game.events.on('player:respawned', () => this.reset());
  }

  /** Spread the contact to nearby enemies and refresh the shared flow field. */
  propagate(spotter, pos) {
    const ai = this.game.ai;
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
    }
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
      e.bb.role = null;
      if (e.bb.timeSinceSeen < CONTACT_MEMORY && e.bb.lastKnownPos) {
        if (!squads.has(e.squad)) squads.set(e.squad, []);
        squads.get(e.squad).push(e);
      }
    }

    for (const members of squads.values()) {
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
