// ui/PauseMenu.js — Overlay while game.state === 'paused' (Esc toggles):
// title, controls reference, current loadout. Pure draw; no state.
// Dependencies: reads game state.

const MONO = '"Courier New", monospace';

const CONTROLS = [
  ['WASD', 'Move'],
  ['SHIFT', 'Sprint (louder footsteps)'],
  ['CTRL / C', 'Crouch (harder to spot)'],
  ['MOUSE', 'Aim / Fire'],
  ['R', 'Reload'],
  ['1-3 / WHEEL', 'Switch weapon'],
  ['E', 'Take weapon'],
  ['F1', 'AI debug overlay'],
  ['ESC', 'Resume'],
];

export class PauseMenu {
  constructor(game) {
    this.game = game;
  }

  draw(ctx) {
    const game = this.game;
    const cx = game.canvas.width / 2;
    let y = game.canvas.height / 2 - 150;

    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 5, 0.78)';
    ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 44px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText('— PAUSED —', cx, y);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#d65c32';
    ctx.fillText('WARZONE JS', cx, y + 34);

    y += 80;
    ctx.font = `14px ${MONO}`;
    for (const [key, what] of CONTROLS) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#d6a13c';
      ctx.fillText(key, cx - 14, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#aab39a';
      ctx.fillText(what, cx + 14, y);
      y += 24;
    }
    ctx.restore();
  }
}
