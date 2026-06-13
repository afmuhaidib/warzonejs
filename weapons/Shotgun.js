// weapons/Shotgun.js — Close-quarters burst: 8 pellets, brutal up close,
// useless past ~300px (short bullet range), slow pump between shots.
// Dependencies: Weapon.

import { Weapon } from './Weapon.js';

export const SHOTGUN = {
  name: 'Combat Shotgun',
  shortName: 'SG',
  auto: false,
  damage: 9,              // per pellet × 8 pellets
  fireRate: 1.4,
  magSize: 6,
  defaultReserve: 36,
  reloadTime: 2.3,
  spread: 0.13,
  pellets: 8,
  bulletSpeed: 1150,
  range: 330,
  barrel: 24,
  soundRadius: 320,
  shake: 0.16,
  flashSize: 18,
  tracerLen: 30,
  color: '#ffb066',
};

export class Shotgun extends Weapon {
  constructor(overrides) {
    super(SHOTGUN, overrides);
  }
}
