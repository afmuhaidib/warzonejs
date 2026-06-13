// ui/MainMenu.js — Start screen with multi-step flow:
//   step 'mode'     → pick game mode
//   step 'opponent' → VS NPCs  |  WITH SOMEONE
//   step 'relation' → WITH your friend (co-op)  |  AGAINST your friend (PvP)
//   step 'teamSize' → squad size (co-op: 2–6 players) or match size (PvP: 1v1 … 6v6)
// Dependencies: modes/ModeDefinitions (MODES), reads progression for badge.

import { MODES } from '../modes/ModeDefinitions.js';

const MONO = '"Courier New", monospace';

const NAV_INITIAL_DELAY = 0.3;
const NAV_REPEAT_RATE   = 0.12;

// Co-op squad sizes (total human players on the same team vs AI).
const COOP_SIZES = [2, 3, 4, 5, 6];
// PvP team sizes — "NvN".
const PVP_SIZES  = [1, 2, 3, 4, 5, 6];

export class MainMenu {
  constructor(game) {
    this.game = game;
    this.selected = 'ffa';
    this.buttons  = [];

    // Multiplayer flow state.
    this._step     = 'mode';    // 'mode' | 'opponent' | 'relation' | 'teamSize'
    this._relation = null;      // 'with' | 'against'
    this._teamSize = null;      // number

    this._navDir   = 0;
    this._navTimer = 0;
  }

  /** Shared: draw a button, register its rect, return true when clicked. */
  static button(ctx, game, list, id, x, y, w, h, label, accent = false) {
    const m = game.input.mouse;
    const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    ctx.fillStyle = hover ? 'rgba(214, 92, 50, 0.25)' : 'rgba(8, 12, 8, 0.75)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent ? '#d65c32' : hover ? '#d65c32' : 'rgba(141, 149, 127, 0.5)';
    ctx.lineWidth = accent ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = `bold 14px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = hover || accent ? '#e8e2cf' : '#aab39a';
    ctx.fillText(label, x + w / 2, y + h / 2);
    list.push({ id, x, y, w, h });
    return hover && m.leftPressed;
  }

  // ─── keyboard navigation (mode step only) ────────────────────────────────

  update(dt) {
    const game  = this.game;
    const input = game.input;

    if (this._step === 'mode') {
      const wantDown = input.isDown('ArrowDown');
      const wantUp   = input.isDown('ArrowUp');
      const dir = wantDown ? 1 : wantUp ? -1 : 0;

      if (dir !== this._navDir) {
        this._navDir   = dir;
        this._navTimer = dir !== 0 ? -NAV_INITIAL_DELAY : 0;
        if (dir !== 0) this._navStep(dir);
      } else if (dir !== 0) {
        this._navTimer += dt;
        if (this._navTimer >= NAV_REPEAT_RATE) {
          this._navTimer -= NAV_REPEAT_RATE;
          this._navStep(dir);
        }
      }

      if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter')) {
        this._step = 'opponent';
      }
    }

    // Escape goes back one step.
    if (input.wasPressed('Escape')) {
      if      (this._step === 'opponent') this._step = 'mode';
      else if (this._step === 'relation') this._step = 'opponent';
      else if (this._step === 'teamSize') this._step = 'relation';
    }
  }

  _navStep(dir) {
    const idx  = MODES.findIndex((m) => m.id === this.selected);
    const base = idx === -1 ? 0 : idx;
    this.selected = MODES[(base + dir + MODES.length) % MODES.length].id;
  }

  // ─── deploy ──────────────────────────────────────────────────────────────

  _deploy() {
    const game = this.game;
    // Attach multiplayer config so GameModeManager / future network layer can read it.
    game.multiplayerConfig = {
      type:           'npc',
      relation:       null,
      teamSize:       null,
      coopFriendlies: null,
    };
    game.modes.start(this.selected);
  }

  _deployMultiplayer() {
    const game = this.game;
    // Store config; _spawnFriendlies reads game.multiplayerConfig.coopFriendlies
    // to override the default friendly count for co-op sessions.
    game.multiplayerConfig = {
      type:           'human',
      relation:       this._relation,   // 'with' | 'against'
      teamSize:       this._teamSize,   // number
      // Co-op: spawn (teamSize - 1) friendly AIs alongside the human player.
      coopFriendlies: this._relation === 'with' ? this._teamSize - 1 : null,
    };
    game.modes.start(this.selected);
  }

  // ─── draw ────────────────────────────────────────────────────────────────

  draw(ctx) {
    const game = this.game;
    const W = game.canvas.width, H = game.canvas.height;
    const cx = W / 2;
    this.buttons = [];

    // Backdrop.
    ctx.fillStyle = 'rgba(5, 8, 5, 0.82)';
    ctx.fillRect(0, 0, W, H);

    // Title block (always visible).
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 58px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.fillText('WARZONE JS', cx, H * 0.13);
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#d65c32';
    ctx.fillText('— TACTICAL TOP-DOWN OPERATIONS —', cx, H * 0.13 + 38);

    const rank = game.progression.rank;
    ctx.fillStyle = '#8d957f';
    ctx.fillText(`${'★'.repeat(rank.prestige)} LEVEL ${rank.rank}  ·  ${rank.xp} XP`, cx, H * 0.13 + 60);

    // Step breadcrumb.
    this._drawBreadcrumb(ctx, W, H, cx);

    // Route to active step.
    if      (this._step === 'mode')     this._drawMode(ctx, W, H, cx);
    else if (this._step === 'opponent') this._drawOpponent(ctx, W, H, cx);
    else if (this._step === 'relation') this._drawRelation(ctx, W, H, cx);
    else if (this._step === 'teamSize') this._drawTeamSize(ctx, W, H, cx);

    // Footer hint.
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#555a4c';
    ctx.fillText('WASD move · mouse aim · RMB ADS · G frag · T tactical · F knife · Z prone · TAB scores · F1 debug', cx, H - 26);
  }

  _drawBreadcrumb(ctx, W, H, cx) {
    const steps = ['MODE', 'OPPONENT', 'SETUP', 'DEPLOY'];
    const active = { mode: 0, opponent: 1, relation: 2, teamSize: 3 }[this._step];
    ctx.font = `10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const totalW = steps.length * 100;
    let x = cx - totalW / 2 + 50;
    for (let i = 0; i < steps.length; i++) {
      ctx.fillStyle = i === active ? '#d65c32' : i < active ? '#8d957f' : '#3a3e34';
      ctx.fillText((i < active ? '✓ ' : '') + steps[i], x, H * 0.26);
      if (i < steps.length - 1) {
        ctx.fillStyle = '#3a3e34';
        ctx.fillText('›', x + 50, H * 0.26);
      }
      x += 100;
    }
  }

  // Step 1: choose game mode.
  _drawMode(ctx, W, H, cx) {
    const game = this.game;
    const cardW = Math.min(560, W - 60);
    let y = H * 0.31;

    ctx.font = `bold 12px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT GAME MODE', cx, y - 18);

    for (const m of MODES) {
      const isSel = this.selected === m.id;
      if (MainMenu.button(ctx, game, this.buttons, m.id, cx - cardW / 2, y, cardW, 46,
        `${isSel ? '▸ ' : ''}${m.name}`, isSel)) {
        this.selected = m.id;
      }
      ctx.font = `10px ${MONO}`;
      ctx.fillStyle = '#6b7361';
      ctx.fillText(m.desc, cx, y + 36);
      y += 56;
    }

    y += 14;
    const half = cardW / 2 - 6;
    if (MainMenu.button(ctx, game, this.buttons, 'loadout', cx - cardW / 2, y, half, 48, 'LOADOUT')) {
      game.state = 'loadout';
    }
    if (MainMenu.button(ctx, game, this.buttons, 'next', cx + 6, y, half, 48, 'NEXT ▶', true)) {
      this._step = 'opponent';
    }
  }

  // Step 2: NPC vs human.
  _drawOpponent(ctx, W, H, cx) {
    const game  = this.game;
    const cardW = Math.min(480, W - 60);
    const cardH = 72;
    let y = H * 0.35;

    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WHO ARE YOU PLAYING WITH?', cx, y - 28);

    if (MainMenu.button(ctx, game, this.buttons, 'npc', cx - cardW / 2, y, cardW, cardH, '🤖  VS NPCs', false)) {
      this._deploy();
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Solo run against AI enemies — starts immediately', cx, y + cardH - 14);

    y += cardH + 20;

    if (MainMenu.button(ctx, game, this.buttons, 'human', cx - cardW / 2, y, cardW, cardH, '👥  WITH SOMEONE', true)) {
      this._step = 'relation';
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Play with or against a friend — configure your squad', cx, y + cardH - 14);

    y += cardH + 40;
    if (MainMenu.button(ctx, game, this.buttons, 'back', cx - 80, y, 160, 38, '◀ BACK')) {
      this._step = 'mode';
    }
  }

  // Step 3: co-op or versus.
  _drawRelation(ctx, W, H, cx) {
    const game  = this.game;
    const cardW = Math.min(480, W - 60);
    const cardH = 72;
    let y = H * 0.35;

    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOW ARE YOU PLAYING?', cx, y - 28);

    if (MainMenu.button(ctx, game, this.buttons, 'with', cx - cardW / 2, y, cardW, cardH, '🤝  WITH YOUR FRIEND', false)) {
      this._relation = 'with';
      this._step = 'teamSize';
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Co-op — fight AI enemies together on the same team', cx, y + cardH - 14);

    y += cardH + 20;

    if (MainMenu.button(ctx, game, this.buttons, 'against', cx - cardW / 2, y, cardW, cardH, '⚔️  AGAINST YOUR FRIEND', true)) {
      this._relation = 'against';
      this._step = 'teamSize';
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('PvP — face off in teams on the same map', cx, y + cardH - 14);

    y += cardH + 40;
    if (MainMenu.button(ctx, game, this.buttons, 'back', cx - 80, y, 160, 38, '◀ BACK')) {
      this._step = 'opponent';
    }
  }

  // Step 4: squad / team size.
  _drawTeamSize(ctx, W, H, cx) {
    const game  = this.game;
    const isWith = this._relation === 'with';
    const sizes  = isWith ? COOP_SIZES : PVP_SIZES;
    const cardW  = Math.min(480, W - 60);

    let y = H * 0.33;

    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isWith ? 'HOW MANY PLAYERS ON YOUR SQUAD?' : 'CHOOSE MATCH SIZE', cx, y - 28);

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText(
      isWith
        ? 'Total human players on the same team vs AI'
        : 'Players per side — balanced PvP match',
      cx, y - 10
    );

    const btnW = Math.min(140, (cardW - (sizes.length - 1) * 12) / sizes.length);
    const totalRowW = sizes.length * btnW + (sizes.length - 1) * 12;
    let bx = cx - totalRowW / 2;

    for (const sz of sizes) {
      const label = isWith ? `${sz} players` : `${sz}v${sz}`;
      const isSelected = this._teamSize === sz;
      if (MainMenu.button(ctx, game, this.buttons, `sz_${sz}`, bx, y, btnW, 56, label, isSelected)) {
        this._teamSize = sz;
      }
      bx += btnW + 12;
    }

    y += 80;

    if (this._teamSize !== null) {
      const desc = isWith
        ? `${this._teamSize} players on your side against AI enemies`
        : `${this._teamSize} players per team — head-to-head`;
      ctx.font = `11px ${MONO}`;
      ctx.fillStyle = '#d65c32';
      ctx.fillText(desc, cx, y);
      y += 22;
    }

    y += 18;
    if (MainMenu.button(ctx, game, this.buttons, 'back', cx - cardW / 2, y, cardW / 2 - 6, 44, '◀ BACK')) {
      this._step = 'relation';
      this._teamSize = null;
    }

    const canDeploy = this._teamSize !== null;
    if (MainMenu.button(ctx, game, this.buttons, 'deploy',
      cx + 6, y, cardW / 2 - 6, 44,
      canDeploy ? '▶ DEPLOY' : 'SELECT SIZE',
      canDeploy)) {
      if (canDeploy) this._deployMultiplayer();
    }
  }
}
