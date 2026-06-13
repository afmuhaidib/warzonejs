// weapons/WeaponManager.js — The player's loadout: equip, switch (1/2/3 keys +
// mouse wheel), pick up drops ([E]), and drop the current gun when swapping at
// a full loadout. Exposes `current`, `slots`, `index`, `nearbyPickup` for the HUD.
// Dependencies: the three gun classes, WeaponPickup.

import { AK47 } from './AK47.js';
import { WeaponPickup } from './WeaponPickup.js';

const MAX_SLOTS = 3;
const PICKUP_RANGE = 52;

export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.slots = [new AK47()];
    this.index = 0;
    this.nearbyPickup = null;
    this.SWAP_TIME = 0.45;
    this.swapTimer = 0;
  }

  get current() {
    return this.slots[this.index] || null;
  }

  /** True while a weapon switch animation is in flight (firing blocked). */
  get swapping() {
    return this.swapTimer > 0;
  }

  /** Rebuild slot 1 from the persisted loadout (called at match start). */
  resetLoadout() {
    const lo = this.game.loadout;
    this.slots = [this.game.progression.attachments.buildWeapon(lo.primary)];
    this.index = 0;
    this.swapTimer = 0;
  }

  update(dt) {
    const { input, player, pickups } = this.game;
    this.swapTimer = Math.max(0, this.swapTimer - dt);
    if (!player.alive) return;

    // --- switching ---
    for (let i = 0; i < this.slots.length; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) this.select(i);
    }
    if (input.wheel !== 0) {
      const n = this.slots.length;
      this.select((this.index + Math.sign(input.wheel) + n) % n);
    }

    this.current?.update(dt);

    // --- pickups ---
    this.nearbyPickup = null;
    let bestD = PICKUP_RANGE;
    for (const p of pickups) {
      const d = p.pos.distanceTo(player.pos);
      if (d < bestD) { bestD = d; this.nearbyPickup = p; }
    }
    if (this.nearbyPickup && input.wasPressed('KeyE')) this.take(this.nearbyPickup);
  }

  select(i) {
    if (i === this.index || !this.slots[i] || this.swapping) return;
    const from = this.current;
    from?.cancelReload();
    this.index = i;
    this.swapTimer = this.SWAP_TIME;
    this.game.events.emit('weapon:swap', { from, to: this.current });
  }

  take(pickup) {
    const incoming = pickup.weapon;
    pickup.dead = true;
    this.game.events.emit('pickup', { weapon: incoming });

    // Already carrying this gun type: absorb its ammo as reserve.
    const owned = this.slots.find((w) => w.name === incoming.name);
    if (owned) {
      if (owned.reserve !== Infinity) {
        owned.reserve = Math.min(owned.defaultReserve * 2, owned.reserve + incoming.ammo + incoming.reserve);
      }
      return;
    }

    if (this.slots.length < MAX_SLOTS) {
      this.slots.push(incoming);
      this.select(this.slots.length - 1);
    } else {
      // Full loadout: drop the current gun where we stand and take the new one.
      this.game.pickups.push(new WeaponPickup(this.game.player.pos, this.current));
      this.slots[this.index] = incoming;
    }
  }

  /** Full resupply on respawn. */
  refill() {
    for (const w of this.slots) w.refill();
  }
}
