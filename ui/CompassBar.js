// ui/CompassBar.js — Top-of-screen directional compass: a sliding tape of
// cardinal/intercardinal ticks driven by the player's aim bearing, with a
// numeric bearing readout and objective pips (bomb site / domination points)
// projected onto the tape when the active mode exposes world markers.
// Dependencies: reads player.angle + active mode's points.

import { normalizeAngle } from '../utils/MathUtils.js';

const MONO = '"Courier New", monospace';
const MARKS = [
  { a: 0, label: 'E' }, { a: Math.PI / 4, label: 'SE' },
  { a: Math.PI / 2, label: 'S' }, { a: (3 * Math.PI) / 4, label: 'SW' },
  { a: Math.PI, label: 'W' }, { a: -(3 * Math.PI) / 4, label: 'NW' },
  { a: -Math.PI / 2, label: 'N' }, { a: -Math.PI / 4, label: 'NE' },
];
const SPAN = Math.PI / 2; // visible arc each side of center

export class CompassBar {
  constructor(game) {
    this.game = game;
  }

  draw(ctx) {
    const game = this.game;
    if (!game.player.alive) return;
    const cx = game.canvas.width / 2;
    const w = 300;
    const y = 78;
    const heading = game.player.angle;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 8, 0.45)';
    ctx.fillRect(cx - w / 2, y - 4, w, 22);

    ctx.font = `bold 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const project = (worldAngle) => {
      const d = normalizeAngle(worldAngle - heading);
      if (Math.abs(d) > SPAN) return null;
      return cx + (d / SPAN) * (w / 2);
    };

    for (const m of MARKS) {
      const px = project(m.a);
      if (px === null) continue;
      const major = m.label.length === 1;
      ctx.fillStyle = major ? '#cfd8c2' : '#6b7361';
      ctx.fillText(m.label, px, y);
      ctx.fillRect(px - 0.5, y + 12, 1, 4);
    }

    // Objective pips from the active mode.
    const mode = game.modes.mode;
    const pts = mode?.points || (mode?.site ? [{ name: '◆', pos: mode.site, owner: 'enemy' }] : []);
    for (const pt of pts) {
      const a = Math.atan2(pt.pos.y - game.player.pos.y, pt.pos.x - game.player.pos.x);
      const px = project(a);
      if (px === null) continue;
      ctx.fillStyle = pt.owner === 'player' ? '#9fe09a' : pt.owner === 'enemy' ? '#e04f33' : '#d6a13c';
      ctx.fillText(pt.name, px, y + 2);
    }

    // Center caret + numeric bearing (0 = North).
    ctx.fillStyle = '#d65c32';
    ctx.fillText('▾', cx, y - 6);
    const deg = Math.round(((heading + Math.PI / 2) * 180) / Math.PI + 360) % 360;
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#8d957f';
    ctx.fillText(`${deg}°`, cx, y + 20);
    ctx.restore();
  }
}
