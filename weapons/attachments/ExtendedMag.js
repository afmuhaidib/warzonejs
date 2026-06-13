// weapons/attachments/ExtendedMag.js — Magazine slot. +50% mag capacity (and
// the bigger mag silhouette in GunRenderer); reloads run a touch longer
// because the mag is heavier.
// Attachment def consumed by AttachmentManager.

export const ExtendedMag = {
  id: 'extmag',
  name: 'Extended Mags',
  slot: 'mag',
  desc: '+50% magazine, slightly slower reload.',
  apply(weapon) {
    weapon.magSize = Math.round(weapon.magSize * 1.5);
    weapon.ammo = weapon.magSize;
    weapon.reloadTime *= 1.1;
    weapon.extendedMag = true;
  },
};
