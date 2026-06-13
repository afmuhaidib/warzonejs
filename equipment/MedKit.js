// equipment/MedKit.js — Press H to instantly heal to full. No cooldown, no charges.

export class MedKit {
  constructor(game) {
    this.game = game;
    this.healing = false;
    this.progress = 0; // 0..1 visual only — drives the HUD arc
  }

  update(dt) {
    const p = this.game.player;

    if (!p.alive) {
      this.healing = false;
      this.progress = 0;
      return;
    }

    if (this.game.input.wasPressed('KeyH') && p.health < p.maxHealth) {
      p.health = p.maxHealth;
      this.healing = true;
      this.progress = 1;
      this.game.events.emit('medkit:used', {});
    } else {
      this.healing = false;
      this.progress = p.health / p.maxHealth;
    }
  }
}
