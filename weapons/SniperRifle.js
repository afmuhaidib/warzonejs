// weapons/SniperRifle.js — One-breath rifle: near-hitscan velocity, huge damage,
// laser accuracy, tiny mag, slow bolt cycle. Loud — every shot lights up AI
// hearing across half a lane.
// Dependencies: Weapon.

import { Weapon } from './Weapon.js';

export const SNIPER_RIFLE = {
  name: 'Marksman Rifle',
  shortName: 'SNP',
  auto: false,
  damage: 85,
  fireRate: 0.9,
  magSize: 5,
  defaultReserve: 25,
  reloadTime: 2.6,
  spread: 0.006,
  pellets: 1,
  bulletSpeed: 3400,
  range: 1700,
  barrel: 32,
  soundRadius: 480,
  shake: 0.22,
  flashSize: 16,
  tracerLen: 110,
  color: '#bfe8ff',
};

export class SniperRifle extends Weapon {
  constructor(overrides) {
    super(SNIPER_RIFLE, overrides);
  }
}
