// combat/KnifeSystem.js — F = knife lunge: a 0.15s dash toward the aim
// direction; any enemy within arc reach during the swing takes a one-hit-kill
// 150 at close range. 1s cooldown. Emits 'melee' for MeleeAnimation and a
// quiet 'sound' (knifing is the stealth option). Firing is blocked during the
// swing by PlayerCombat checking knife.busy.
// Dependencies: EventBus, CollisionMap (lunge respects walls).

const LUNGE_DIST = 85;
const LUNGE_TIME = 0.15;
const SWING_TIME = 0.42;     // matches MeleeAnimation
const HIT_RANGE = 52;
const DAMAGE = 150;
const COOLDOWN = 1;

export class KnifeSystem {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.swing = 0;          // time left in current swing
    this.lunge = 0;          // time left in lunge dash
    this.didHit = false;
  }

  get busy() {
    return this.swing > 0;
  }

  update(dt) {
    const { input, player, map } = this.game;
    this.cooldown -= dt;

    if (player.alive && input.wasPressed('KeyF') && this.cooldown <= 0
      && !player.mantling && !this.game.weapons.swapping) {
      this.cooldown = COOLDOWN;
      this.swing = SWING_TIME;
      this.lunge = LUNGE_TIME;
      this.didHit = false;
      this.game.events.emit('melee', {});
      this.game.events.emit('sound', { pos: player.pos.clone(), radius: 110, team: 'player' });
    }

    if (this.swing > 0) {
      this.swing -= dt;

      // Lunge dash.
      if (this.lunge > 0) {
        this.lunge -= dt;
        const speed = LUNGE_DIST / LUNGE_TIME;
        map.collision.moveCircle(
          player.pos,
          Math.cos(player.angle) * speed * dt,
          Math.sin(player.angle) * speed * dt,
          player.radius
        );
      }

      // Hit check during the slash window (one victim per swing).
      if (!this.didHit && this.swing < SWING_TIME * 0.7) {
        for (const e of this.game.ai.enemies) {
          if (e.pos.distanceTo(player.pos) < HIT_RANGE + e.radius) {
            this.didHit = true;
            this.game.effects.hitSpark(e.pos.x, e.pos.y, '#b8362a', 10);
            const killed = e.health - DAMAGE <= 0;
            e.damage(this.game, DAMAGE, player.pos, player);
            this.game.events.emit('hit', {
              target: e, amount: DAMAGE, headshot: false,
              killed, pos: e.pos.clone(), byTeam: 'player', byPlayer: true, melee: true,
            });
            break;
          }
        }
      }
    }
  }
}
