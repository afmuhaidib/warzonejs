// weapons/attachments/Silencer.js — Muzzle slot. Kills the muzzle flash,
// shrinks the AI hearing radius to a third, marks the gun silenced (GunSounds
// plays the pfft, the silhouette gains a can). Small damage trade.
// Attachment def consumed by AttachmentManager.

export const Silencer = {
  id: 'silencer',
  name: 'Silencer',
  slot: 'muzzle',
  desc: 'No flash, 1/3 sound radius. -5% damage.',
  apply(weapon) {
    weapon.silenced = true;
    weapon.soundRadius *= 0.33;
    weapon.flashSize = 0;
    weapon.damage *= 0.95;
  },
};
