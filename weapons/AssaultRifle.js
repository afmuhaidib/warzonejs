// weapons/AssaultRifle.js — Full-auto workhorse: mid damage, mid range, fast
// fire rate, generous reserve. The baseline gun the player spawns with.
// Dependencies: Weapon.

import { Weapon } from './Weapon.js';

export const ASSAULT_RIFLE = {
  name: 'M4 Carbine',
  shortName: 'AR',
  auto: true,
  damage: 12,
  fireRate: 9,            // shots per second
  magSize: 30,
  defaultReserve: 180,
  reloadTime: 1.7,
  spread: 0.045,          // radians, half-angle
  pellets: 1,
  bulletSpeed: 1500,
  range: 760,
  barrel: 22,
  soundRadius: 280,
  shake: 0.06,
  flashSize: 13,
  tracerLen: 46,
  color: '#ffd27a',
};

export class AssaultRifle extends Weapon {
  constructor(overrides) {
    super(ASSAULT_RIFLE, overrides);
  }
}
