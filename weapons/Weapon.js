// weapons/Weapon.js — Base weapon class: ammo, fire-rate cooldown, reload state
// machine, spread, and the fire routine (spawns bullets, muzzle flash, shell
// casing, screen shake, and the 'sound' event that AI hearing listens for).
// Concrete guns (AssaultRifle/Shotgun/SniperRifle) only supply a config object.
// Dependencies: BulletPool + EffectsManager + EventBus (via game), utils/MathUtils.

import { randRange } from '../utils/MathUtils.js';

export class Weapon {
  /**
   * @param {object} cfg  full stat block (see AssaultRifle.js for the shape)
   * @param {object} overrides  per-instance tweaks (enemy guns deal less damage)
   */
  constructor(cfg, overrides = {}) {
    Object.assign(this, cfg, overrides);

    this.ammo = this.magSize;
    this.reserve = this.defaultReserve;
    this.cooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.currentReloadTime = this.reloadTime;
  }

  get reloadProgress() {
    return this.reloading ? this.reloadTimer / this.currentReloadTime : 0;
  }

  update(dt) {
    this.cooldown -= dt;
    if (this.reloading) {
      this.reloadTimer += dt;
      if (this.reloadTimer >= this.currentReloadTime) {
        const need = this.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        if (this.reserve !== Infinity) this.reserve -= take;
        this.reloading = false;
      }
    }
  }

  /**
   * Tactical reload (rounds left in the mag) is quicker; a full reload (bolt
   * locked back on empty) adds a chamber phase. Pass `game` to broadcast the
   * 'weapon:reload' event (animation + foley) — AI guns skip it.
   */
  startReload(game) {
    if (this.reloading || this.ammo === this.magSize || this.reserve <= 0) return;
    const full = this.ammo === 0;
    this.currentReloadTime = this.reloadTime * (full ? 1.15 : 0.8);
    this.reloading = true;
    this.reloadTimer = 0;
    if (game) game.events.emit('weapon:reload', { weapon: this, full });
  }

  cancelReload() {
    this.reloading = false;
  }

  /** Fire one trigger pull from `shooter` toward `angle`. Returns true if shot. */
  tryFire(game, shooter, angle) {
    if (this.cooldown > 0 || this.reloading) return false;
    if (this.ammo <= 0) {
      this.startReload();
      return false;
    }

    this.ammo--;
    this.cooldown = 1 / this.fireRate;

    // Muzzle origin includes the lean offset (corner peeking).
    const lx = shooter.leanOffset ? shooter.leanOffset.x : 0;
    const ly = shooter.leanOffset ? shooter.leanOffset.y : 0;
    const mx = shooter.pos.x + lx + Math.cos(angle) * (shooter.radius + this.barrel);
    const my = shooter.pos.y + ly + Math.sin(angle) * (shooter.radius + this.barrel);

    // ADS tightens spread; an optic tightens it further while aiming.
    let spread = this.spread;
    const adsMult = shooter.adsSpreadMult ?? 1;
    spread *= adsMult;
    if (adsMult < 0.95 && this.adsSpreadBonus) spread *= this.adsSpreadBonus;

    for (let i = 0; i < this.pellets; i++) {
      const a = angle + randRange(-spread, spread);
      game.bullets.fire(mx, my, a, this, shooter);
    }
    if (shooter.shotsFired !== undefined) shooter.shotsFired += 1;

    if (this.flashSize > 0) game.effects.muzzleFlash(mx, my, angle, this.flashSize);
    game.effects.tracer(mx, my, angle, this.tracerLen);
    game.effects.shellCasing(shooter.pos.x, shooter.pos.y, angle);
    if (shooter.team === 'player') game.effects.addShake(this.shake * (this.recoilMult || 1));

    game.events.emit('sound', {
      pos: shooter.pos.clone(),
      radius: this.soundRadius,
      team: shooter.team,
    });
    game.events.emit('weapon:fired', {
      weapon: this, pos: shooter.pos.clone(), angle,
      team: shooter.team, silenced: !!this.silenced,
    });

    if (this.ammo === 0) this.startReload(shooter.team === 'player' ? game : undefined);
    return true;
  }

  refill() {
    this.ammo = this.magSize;
    this.reserve = this.defaultReserve;
    this.reloading = false;
    this.cooldown = 0;
  }
}
