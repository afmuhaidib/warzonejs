// weapons/attachments/FMJRounds.js — Ammo slot. Grants wall penetration:
// bullets punch through one thin-cover tile at reduced damage
// (combat/PenetrationSystem holds the rules; Bullet checks weapon.penetrate).
// Snipers penetrate natively — FMJ brings every other gun up to par.
// Attachment def consumed by AttachmentManager.

export const FMJRounds = {
  id: 'fmj',
  name: 'FMJ Rounds',
  slot: 'ammo',
  desc: 'Bullets penetrate thin cover at 55% damage.',
  apply(weapon) {
    weapon.penetrate = true;
  },
};
