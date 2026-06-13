// weapons/attachments/Grip.js — Underbarrel slot. Reduces recoil magnitude
// (FireAnimation reads recoilMult), camera shake per shot, and base spread.
// Attachment def consumed by AttachmentManager.

export const Grip = {
  id: 'grip',
  name: 'Foregrip',
  slot: 'grip',
  desc: '-recoil, -spread.',
  apply(weapon) {
    weapon.spread *= 0.85;
    weapon.shake *= 0.7;
    weapon.recoilMult = 0.6;
  },
};
