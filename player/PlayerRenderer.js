// player/PlayerRenderer.js — Draws the player: shadow, body, helmet, weapon
// barrel along the aim direction. Crouching shrinks the silhouette. Pure draw
// module: no state, no side effects.
// Dependencies: reads player + current weapon from the game context.

export class PlayerRenderer {
  static draw(ctx, player, game) {
    const r = player.crouching ? player.radius * 0.85 : player.radius;
    const weapon = game.weapons.current;
    const barrel = weapon ? weapon.barrel : 20;

    ctx.save();
    ctx.translate(player.pos.x, player.pos.y);

    // "YOU" marker — bright pulsing arrow above the player so they're always identifiable.
    const pulse = 0.72 + Math.sin(game.time * 3.5) * 0.28;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#f0e060';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    const ay = -r - 10;
    ctx.beginPath();
    ctx.moveTo(0, ay - 8);
    ctx.lineTo(6, ay);
    ctx.lineTo(3, ay);
    ctx.lineTo(3, ay + 5);
    ctx.lineTo(-3, ay + 5);
    ctx.lineTo(-3, ay);
    ctx.lineTo(-6, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 4, r + 2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright outline so the player pops against friendlies.
    ctx.strokeStyle = '#f0e060';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(player.angle);

    // Weapon barrel.
    ctx.strokeStyle = '#15170f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 5);
    ctx.lineTo(r + barrel, 3);
    ctx.stroke();

    // Body.
    ctx.fillStyle = '#2e3b27';
    ctx.strokeStyle = '#0d110b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shoulder pads.
    ctx.fillStyle = '#22301e';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.65, r * 0.32, 0, Math.PI * 2);
    ctx.arc(-r * 0.25, r * 0.65, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Helmet.
    ctx.fillStyle = '#3c4c30';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(r * 0.12, -r * 0.12, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
