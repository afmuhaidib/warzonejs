// player/FriendlyRenderer.js — Draws friendly AI as tactical soldiers.
// Multicam green kit, visible gear, suppressor, name callsign.

export class FriendlyRenderer {
  static draw(ctx, agent, game) {
    if (!agent.alive) return;

    const r = agent.radius;
    ctx.save();
    ctx.translate(agent.pos.x, agent.pos.y);

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(3, 5, r + 3, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(agent.angle);

    // Suppressor on barrel
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r * 0.45, 0);
    ctx.lineTo(r + 22, 0);
    ctx.stroke();
    // Suppressor can
    ctx.strokeStyle = '#1e2016';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(r + 10, 0);
    ctx.lineTo(r + 22, 0);
    ctx.stroke();

    // Body — multicam olive/green
    ctx.fillStyle = '#374a2e';
    ctx.strokeStyle = '#111a0c';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Chest rig / plate carrier straps
    ctx.strokeStyle = '#263520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.55);
    ctx.lineTo(-r * 0.3,  r * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, 0);
    ctx.lineTo( r * 0.35, 0);
    ctx.stroke();

    // Helmet — darker green with cam cover texture
    ctx.fillStyle = '#2e3d22';
    ctx.strokeStyle = '#1a2412';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // NVG mount on helmet
    ctx.fillStyle = '#111';
    ctx.fillRect(r * 0.18, -r * 0.08, r * 0.28, r * 0.16);

    // Visor glint
    ctx.fillStyle = 'rgba(120, 200, 140, 0.12)';
    ctx.beginPath();
    ctx.arc(r * 0.1, -r * 0.1, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // ── Screen-space overlays (name + HP bar) ──
    ctx.save();
    ctx.translate(agent.pos.x, agent.pos.y - r - 18);

    // HP bar bg
    const bW = 32, bH = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-bW / 2, 0, bW, bH);
    const pct = Math.max(0, agent.health / agent.maxHealth);
    ctx.fillStyle = pct > 0.55 ? '#5db84a' : pct > 0.28 ? '#d6a13c' : '#c83a26';
    ctx.fillRect(-bW / 2, 0, bW * pct, bH);

    // Callsign
    ctx.font = '8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#9fc090';
    ctx.fillText(agent.name.toUpperCase(), 0, 0);

    ctx.restore();
  }

  static drawMinimap(ctx, agent, scale, ox, oy) {
    if (!agent.alive) return;
    const mx = ox + agent.pos.x * scale;
    const my = oy + agent.pos.y * scale;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(agent.angle);
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(-3, -2.5); ctx.lineTo(-3, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
