// weapons/AK47.js — High-damage full-auto with heavy kick and slower fire rate
// than the M4. Hits harder per bullet but punishes spray.
// Dependencies: Weapon.

import { Weapon } from './Weapon.js';

export const AK47_DEF = {
  name: 'AK-47',
  shortName: 'AK',
  auto: true,
  damage: 18,             // vs M4's 12 — one-fewer-bullet kills
  fireRate: 6.5,          // shots/s vs M4's 9 — slower, heavier
  magSize: 30,
  defaultReserve: 150,
  reloadTime: 2.1,        // slower tactical reload
  spread: 0.068,          // more kick than M4 (0.045)
  pellets: 1,
  bulletSpeed: 1420,
  range: 820,             // slightly longer effective range
  barrel: 24,
  soundRadius: 310,
  shake: 0.1,
  flashSize: 16,
  tracerLen: 50,
  color: '#ffb84d',       // warmer muzzle flash colour
};

export class AK47 extends Weapon {
  constructor(overrides) {
    super(AK47_DEF, overrides);
  }
}
