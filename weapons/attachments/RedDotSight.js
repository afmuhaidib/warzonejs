// weapons/attachments/RedDotSight.js — Optic slot. Tighter ADS spread and a
// slight extra zoom; AimDownSights reads weapon.optic for the zoom curve and
// GunRenderer draws the sight housing.
// Attachment def consumed by AttachmentManager.

export const RedDotSight = {
  id: 'reddot',
  name: 'Red Dot Sight',
  slot: 'optic',
  desc: 'Tighter ADS reticle, +zoom.',
  apply(weapon) {
    weapon.optic = 'reddot';
    weapon.adsSpreadBonus = 0.8; // multiplies spread further while aiming
  },
};
