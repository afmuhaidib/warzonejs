// progression/AttachmentSystem.js — The loadout-level attachment layer: stores
// which attachments are selected per weapon (persisted), validates against the
// UnlockTree, and builds configured weapon instances for the WeaponManager at
// match start. The LoadoutEditor edits through this; AttachmentManager does
// the raw stat math.
// Dependencies: weapons classes, AttachmentManager, UnlockTree, RankSystem save.

import { AssaultRifle } from '../weapons/AssaultRifle.js';
import { AK47 } from '../weapons/AK47.js';
import { Shotgun } from '../weapons/Shotgun.js';
import { SniperRifle } from '../weapons/SniperRifle.js';
import { AttachmentManager } from '../weapons/attachments/AttachmentManager.js';

const WEAPON_CLASSES = { AR: AssaultRifle, AK: AK47, SG: Shotgun, SNP: SniperRifle };

export class AttachmentSystem {
  constructor(game) {
    this.game = game;
    const saved = game.progression.rank.load();
    // { AR: ['reddot', 'grip'], SG: [], SNP: [] }
    this.selected = saved.attachments || { AR: [], AK: [], SG: [], SNP: [] };
  }

  selectedFor(kind) {
    return this.selected[kind] || [];
  }

  /** Toggle an attachment on a weapon's loadout (one per slot). */
  toggle(kind, attachmentId) {
    if (!this.game.progression.unlocks.isUnlocked(attachmentId)) return;
    const def = AttachmentManager.byId(attachmentId);
    if (!def) return;
    const list = this.selected[kind] || (this.selected[kind] = []);
    const i = list.indexOf(attachmentId);
    if (i !== -1) {
      list.splice(i, 1);
    } else {
      // Evict whatever holds this slot, then mount.
      for (let k = list.length - 1; k >= 0; k--) {
        const other = AttachmentManager.byId(list[k]);
        if (other && other.slot === def.slot) list.splice(k, 1);
      }
      list.push(attachmentId);
    }
    this.game.progression.rank.save({ attachments: this.selected });
  }

  /** Fresh, fully-configured weapon instance for a match. */
  buildWeapon(kind, overrides) {
    const Cls = WEAPON_CLASSES[kind] || AssaultRifle;
    const w = new Cls(overrides);
    AttachmentManager.apply(w, this.selectedFor(kind));
    return w;
  }
}
