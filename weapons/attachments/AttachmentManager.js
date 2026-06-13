// weapons/attachments/AttachmentManager.js — Registry of every attachment def
// and the applier: takes a freshly-constructed weapon instance and a list of
// attachment ids, applies each def's stat deltas (one per slot enforced), and
// records what's mounted on weapon.attachments for the HUD/loadout screens.
// Always apply to a NEW instance — deltas are not reversible.
// Dependencies: the six attachment defs.

import { Silencer } from './Silencer.js';
import { RedDotSight } from './RedDotSight.js';
import { ACOG } from './ACOG.js';
import { ExtendedMag } from './ExtendedMag.js';
import { Grip } from './Grip.js';
import { FMJRounds } from './FMJRounds.js';

export const ATTACHMENTS = [Silencer, RedDotSight, ACOG, ExtendedMag, Grip, FMJRounds];

export const AttachmentManager = {
  byId(id) {
    return ATTACHMENTS.find((a) => a.id === id) || null;
  },

  /** Apply a list of attachment ids to a fresh weapon instance. */
  apply(weapon, ids) {
    weapon.attachments = [];
    const usedSlots = new Set();
    for (const id of ids || []) {
      const def = this.byId(id);
      if (!def || usedSlots.has(def.slot)) continue;
      usedSlots.add(def.slot);
      def.apply(weapon);
      weapon.attachments.push(def.id);
    }
    return weapon;
  },
};
