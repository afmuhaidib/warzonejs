// ui/LoadoutEditor.js — Pre-game customization (game.state === 'loadout'):
// pick the primary weapon (rank-gated), toggle its attachments per slot
// (rank-gated, one per slot), choose the tactical (flash/smoke), review the
// daily challenges. Edits flow through AttachmentSystem (persisted) and
// game.loadout. Back returns to the menu.
// Dependencies: AttachmentSystem, UnlockTree, AttachmentManager defs, MainMenu.button.

import { MainMenu } from './MainMenu.js';
import { ATTACHMENTS } from '../weapons/attachments/AttachmentManager.js';

const MONO = '"Courier New", monospace';
const WEAPONS = [
  { id: 'AR', name: 'M4 CARBINE' },
  { id: 'SG', name: 'COMBAT SHOTGUN' },
  { id: 'SNP', name: 'MARKSMAN RIFLE' },
];

export class LoadoutEditor {
  constructor(game) {
    this.game = game;
    this.buttons = [];
  }

  draw(ctx) {
    const game = this.game;
    const W = game.canvas.width, H = game.canvas.height;
    const cx = W / 2;
    const unlocks = game.progression.unlocks;
    const attach = game.progression.attachments;
    this.buttons = [];

    ctx.fillStyle = 'rgba(5, 8, 5, 0.88)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 30px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText('LOADOUT', cx, 50);

    // --- primary weapon row ---
    const colW = 190;
    let x = cx - (colW * WEAPONS.length + 20) / 2;
    const y0 = 100;
    for (const w of WEAPONS) {
      const unlocked = unlocks.isUnlocked(w.id);
      const sel = game.loadout.primary === w.id;
      const label = unlocked ? `${sel ? '▸ ' : ''}${w.name}` : `🔒 LVL ${unlocks.rankFor(w.id)}`;
      if (MainMenu.button(ctx, game, this.buttons, 'w-' + w.id, x, y0, colW, 44, label, sel) && unlocked) {
        game.loadout.primary = w.id;
        game.saveLoadout();
      }
      x += colW + 10;
    }

    // --- attachments for the selected primary ---
    ctx.font = `bold 13px ${MONO}`;
    ctx.fillStyle = '#d65c32';
    ctx.fillText(`ATTACHMENTS — ${game.loadout.primary}`, cx, 178);

    const sel = attach.selectedFor(game.loadout.primary);
    let ay = 198;
    for (const a of ATTACHMENTS) {
      const unlocked = unlocks.isUnlocked(a.id);
      const on = sel.includes(a.id);
      const label = unlocked
        ? `${on ? '■' : '□'} ${a.name.toUpperCase()}  [${a.slot}]`
        : `🔒 ${a.name.toUpperCase()} — LVL ${unlocks.rankFor(a.id)}`;
      if (MainMenu.button(ctx, game, this.buttons, 'a-' + a.id, cx - 230, ay, 460, 32, label, on) && unlocked) {
        attach.toggle(game.loadout.primary, a.id);
      }
      ctx.font = `9px ${MONO}`;
      ctx.fillStyle = '#6b7361';
      ctx.textAlign = 'center';
      ctx.fillText(a.desc, cx, ay + 26);
      ay += 40;
    }

    // --- tactical ---
    ay += 8;
    ctx.font = `bold 13px ${MONO}`;
    ctx.fillStyle = '#d65c32';
    ctx.fillText('TACTICAL [T]', cx, ay);
    ay += 14;
    for (const t of ['flash', 'smoke']) {
      const on = game.loadout.tactical === t;
      if (MainMenu.button(ctx, game, this.buttons, 't-' + t,
        cx - 230 + (t === 'smoke' ? 235 : 0), ay, 225, 34,
        `${on ? '▸ ' : ''}${t.toUpperCase()}BANG`.replace('SMOKEBANG', 'SMOKE'), on)) {
        game.loadout.tactical = t;
        game.saveLoadout();
      }
    }
    ay += 46;

    // --- daily challenges readout ---
    const ch = game.progression.challenges;
    ctx.font = `bold 12px ${MONO}`;
    ctx.fillStyle = '#e8c878';
    ctx.fillText('DAILY CHALLENGES (2× XP)', cx, ay);
    ay += 16;
    ctx.font = `10px ${MONO}`;
    for (const id of ch.dailyIds) {
      const def = ch.defs.find((d) => d.id === id);
      const done = ch.isDone(id);
      ctx.fillStyle = done ? '#9fe09a' : '#8d957f';
      ctx.fillText(`${done ? '✔' : '·'} ${def.name}: ${def.desc} — ${ch.progressOf(id)}/${def.goal}`, cx, ay);
      ay += 15;
    }

    if (MainMenu.button(ctx, game, this.buttons, 'back', cx - 110, H - 70, 220, 42, '← BACK', true)) {
      game.state = 'menu';
    }
  }
}
