// player/PlayerCombat.js — Shooting and reload input. Translates mouse/touch
// intent into WeaponManager calls; automatic weapons fire while held,
// semi-autos on click. Firing is blocked while: swapping weapons, mantling,
// mid-knife-swing, sliding, prone-transitioning, or targeting an airstrike.
// Taking damage cancels an in-progress reload (hooked in core/Game).
// Dependencies: WeaponManager, KnifeSystem, MantleSystem, AirstrikeCaller
// (all via game).

export class PlayerCombat {
  constructor(game) {
    this.game = game;
  }

  update(dt) {
    const { input, player, weapons, touch } = this.game;
    if (!player.alive) return;

    const weapon = weapons.current;
    if (!weapon) return;

    const blocked = weapons.swapping
      || player.mantling
      || player.sliding
      || (this.game.combat && this.game.combat.knife.busy)
      || (this.game.movement && this.game.movement.prone.transitioning)
      || (this.game.killstreaks && this.game.killstreaks.airstrike.targeting);

    const held = input.mouse.left || (touch && touch.firing);
    const tapped = input.mouse.leftPressed || (touch && touch.firePressed);
    const wantsFire = weapon.auto ? held : tapped;
    if (wantsFire && !blocked) {
      if (weapon.tryFire(this.game, player, player.angle)) {
        player.lastShotTime = this.game.time;
      }
    }

    if (input.wasPressed('KeyR') || (touch && touch.reloadPressed)) {
      weapon.startReload(this.game);
    }

    // Grenade from touch
    if (touch && touch.grenadePressed) {
      this.game.combat.grenades.tryThrow(this.game);
    }
  }
}
