// ai/EnemyRenderer.js — Draws one enemy: shadow, body, helmet, barrel, the
// awareness "?" pip while suspicious, and a health bar once damaged. With the
// F1 debug overlay on, also draws the vision cone, current path, line to the
// last known player position, and the behavior-state label.
// Pure draw module. Dependencies: reads enemy + perception state.

const STATE_COLORS = {
  patrol: '#6b7361',
  alert: '#d6a13c',
  investigate: '#d6a13c',
  engage: '#d65c32',
  suppress: '#e04f33',
  flank: '#c878e8',
  retreat: '#78a0e8',
};

export class EnemyRenderer {
  static draw(ctx, e, game) {
    const r = e.radius;

    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 4, r + 2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.rotate(e.angle);

    // Barrel.
    ctx.strokeStyle = '#15120c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r * 0.4, 5);
    ctx.lineTo(r + e.weapon.barrel, 3);
    ctx.stroke();

    // Body — desert tan so hostiles read instantly against the player's green.
    ctx.fillStyle = '#5a4a30';
    ctx.strokeStyle = '#171208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Helmet + red optic.
    ctx.fillStyle = '#6e5a3a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c83a26';
    ctx.fillRect(r * 0.2, -2, r * 0.4, 4);

    ctx.restore();

    // Awareness pip while ramping up (not yet locked on).
    if (e.bb.awareness > 0.1 && e.bb.awareness < 1) {
      ctx.fillStyle = '#d6a13c';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -r - 8);
      ctx.fillStyle = 'rgba(30, 36, 28, 0.9)';
      ctx.fillRect(-12, -r - 6, 24, 3);
      ctx.fillStyle = '#d6a13c';
      ctx.fillRect(-12, -r - 6, 24 * e.bb.awareness, 3);
    }

    // Health bar once damaged.
    if (e.health < e.maxHealth) {
      const pct = e.health / e.maxHealth;
      ctx.fillStyle = 'rgba(8, 12, 8, 0.8)';
      ctx.fillRect(-15, -r - 13, 30, 5);
      ctx.fillStyle = pct > 0.5 ? '#7ab648' : pct > 0.25 ? '#d6a13c' : '#c83a26';
      ctx.fillRect(-14, -r - 12, 28 * pct, 3);
    }

    // Suppression: heavily-pinned soldiers flash an amber rattle ring.
    if (e.bb.suppression > 0.45) {
      ctx.strokeStyle = `rgba(230, 170, 60, ${0.25 + 0.3 * e.bb.suppression})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5 + Math.sin(game.time * 22) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Combat bark above the head.
    if (e.bb.barkTimer > 0 && e.bb.bark) {
      const a = Math.min(1, e.bb.barkTimer * 2.5);
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(e.bb.bark).width;
      ctx.fillStyle = `rgba(12, 14, 10, ${0.7 * a})`;
      ctx.fillRect(-w / 2 - 4, -r - 30, w + 8, 14);
      ctx.fillStyle = `rgba(240, 224, 200, ${a})`;
      ctx.fillText(e.bb.bark, 0, -r - 19);
    }

    ctx.restore();

    if (game.debug.enabled) EnemyRenderer.drawDebug(ctx, e, game);
  }

  static drawDebug(ctx, e, game) {
    const p = e.perception;
    ctx.save();

    // Vision cone.
    ctx.fillStyle = e.bb.canSee ? 'rgba(224, 79, 51, 0.08)' : 'rgba(159, 224, 154, 0.05)';
    ctx.beginPath();
    ctx.moveTo(e.pos.x, e.pos.y);
    ctx.arc(e.pos.x, e.pos.y, p.viewDist, e.angle - p.fovHalf, e.angle + p.fovHalf);
    ctx.closePath();
    ctx.fill();

    // Path.
    if (e.bb.path) {
      ctx.strokeStyle = 'rgba(120, 160, 232, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y);
      for (let i = e.bb.pathIndex; i < e.bb.path.length; i++) {
        ctx.lineTo(e.bb.path[i].x, e.bb.path[i].y);
      }
      ctx.stroke();
    }

    // Last known player position.
    if (e.bb.lastKnownPos) {
      ctx.strokeStyle = 'rgba(214, 92, 50, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y);
      ctx.lineTo(e.bb.lastKnownPos.x, e.bb.lastKnownPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeRect(e.bb.lastKnownPos.x - 5, e.bb.lastKnownPos.y - 5, 10, 10);
    }

    // State + squad label.
    ctx.font = '10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = STATE_COLORS[e.state] || '#9fe09a';
    const role = e.bb.role ? `·${e.bb.role}` : '';
    ctx.fillText(`${e.state}${role} [sq${e.squad}]`, e.pos.x, e.pos.y + e.radius + 14);

    // Personality + suppression readout.
    ctx.fillStyle = e.personality.color;
    const supp = e.bb.suppression > 0.1 ? ` supp:${e.bb.suppression.toFixed(1)}` : '';
    ctx.fillText(`${e.personality.label}${supp}`, e.pos.x, e.pos.y + e.radius + 25);

    ctx.restore();
  }
}
