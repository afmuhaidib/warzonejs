// weapons/attachments/ACOG.js — Optic slot. Big zoom magnification at the cost
// of a slower ADS transition (AimDownSights reads weapon.optic for both) and a
// touch more base spread from the bulk.
// Attachment def consumed by AttachmentManager.

export const ACOG = {
  id: 'acog',
  name: 'ACOG Scope',
  slot: 'optic',
  desc: 'High zoom, slower ADS.',
  apply(weapon) {
    weapon.optic = 'acog';
    weapon.adsSpreadBonus = 0.65;
    weapon.spread *= 1.08; // clumsy from the hip
  },
};
