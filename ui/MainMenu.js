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
    this._step     = 'mode';    // 'mode' | 'opponent' | 'relation' | 'teamSize' | 'duration' | 'netlobby'
    this._relation = null;      // 'with' | 'against'
    this._teamSize = null;      // number
    this._duration = null;      // minutes, null = unlimited
    this._netRelation = 'with'; // online lobby: 'with' (co-op) | 'against' (pvp)
    this._stepFrame = 0;        // frame counter when step last changed — blocks same-frame clicks

    this._navDir   = 0;
    this._navTimer = 0;
    this._stepBlockUntil = 0; // real-time timestamp (ms) after which clicks are allowed

    this._focusId  = null;     // keyboard-focused button id
    this._enterPressed = false; // consumed per-frame
  }

  /** Shared: draw a button, register its rect, return true when clicked or keyboard-activated. */
  static button(ctx, game, list, id, x, y, w, h, label, accent = false, focusId = null) {
    const m = game.input.mouse;
    const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    const focused = focusId === id;
    const active = hover || focused;
    ctx.fillStyle = active ? 'rgba(214, 92, 50, 0.25)' : 'rgba(8, 12, 8, 0.75)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active ? '#d65c32' : accent ? '#d65c32' : 'rgba(141, 149, 127, 0.5)';
    ctx.lineWidth = focused ? 2 : accent ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    if (focused) {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.font = `bold 14px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = active || accent ? '#e8e2cf' : '#aab39a';
    ctx.fillText(label, x + w / 2, y + h / 2);
    list.push({ id, x, y, w, h });
    return hover && m.leftPressed;
  }

  // ─── keyboard navigation ─────────────────────────────────────────────────

  update(dt) {
    const game  = this.game;
    const input = game.input;

    this._stepFrame++;
    this._enterPressed = false;

    const wantDown = input.isDown('ArrowDown')  || input.isDown('ArrowRight');
    const wantUp   = input.isDown('ArrowUp')    || input.isDown('ArrowLeft');
    const dir = wantDown ? 1 : wantUp ? -1 : 0;

    if (this._step === 'mode') {
      // Mode step: arrows cycle through MODES list.
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
        this._goStep('opponent');
      }
    } else {
      // All other steps: arrows move through the registered buttons list.
      const btns = this.buttons.filter((b) => b.id !== 'back'); // keep back reachable but at end
      const backBtn = this.buttons.find((b) => b.id === 'back');
      const navList = backBtn ? [...btns, backBtn] : btns;

      if (navList.length > 0) {
        if (this._focusId === null) this._focusId = navList[0].id;

        if (dir !== this._navDir) {
          this._navDir   = dir;
          this._navTimer = dir !== 0 ? -NAV_INITIAL_DELAY : 0;
          if (dir !== 0) this._navFocus(dir, navList);
        } else if (dir !== 0) {
          this._navTimer += dt;
          if (this._navTimer >= NAV_REPEAT_RATE) {
            this._navTimer -= NAV_REPEAT_RATE;
            this._navFocus(dir, navList);
          }
        }
      }

      if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter')) {
        this._enterPressed = true;
      }
    }

    // Escape goes back one step.
    if (input.wasPressed('Escape')) {
      if      (this._step === 'opponent') this._goStep('mode');
      else if (this._step === 'relation') this._goStep('opponent');
      else if (this._step === 'teamSize') this._goStep('relation');
      else if (this._step === 'duration') this._goStep(this._relation ? 'teamSize' : 'opponent');
      else if (this._step === 'netlobby') { this.game.net?.shutdown(); this._goStep('opponent'); }
    }

    // Mouse movement clears keyboard focus so hover takes over.
    const m = game.input.mouse;
    if (m.x !== this._lastMX || m.y !== this._lastMY) { this._focusId = null; }
    this._lastMX = m.x; this._lastMY = m.y;
  }

  _navFocus(dir, list) {
    const idx = list.findIndex((b) => b.id === this._focusId);
    const next = (idx + dir + list.length) % list.length;
    this._focusId = list[next].id;
  }

  _goStep(s) {
    this._step = s;
    this._stepChanged = this._stepFrame;
    this._stepBlockUntil = performance.now() + 180; // block clicks for 180ms after any step change
    this._focusId = null;
    this._navDir  = 0;
  }

  _navStep(dir) {
    const idx  = MODES.findIndex((m) => m.id === this.selected);
    const base = idx === -1 ? 0 : idx;
    this.selected = MODES[(base + dir + MODES.length) % MODES.length].id;
  }

  /** Instance wrapper: passes focusId so keyboard focus highlights + Enter activates. */
  _btn(ctx, id, x, y, w, h, label, accent = false) {
    const clicked = MainMenu.button(ctx, this.game, this.buttons, id, x, y, w, h, label, accent, this._focusId);
    return clicked || (this._enterPressed && this._focusId === id);
  }

  // ─── deploy ──────────────────────────────────────────────────────────────

  _deploy() {
    const game = this.game;
    game.multiplayerConfig = {
      type:           'npc',
      relation:       null,
      teamSize:       null,
      coopFriendlies: null,
      duration:       this._duration,   // minutes, null = unlimited
    };
    game.modes.start(this.selected);
  }

  _deployMultiplayer() {
    const game = this.game;
    // Store config; _spawnFriendlies reads game.multiplayerConfig.coopFriendlies
    // to override the default friendly count for co-op sessions.
    game.multiplayerConfig = {
      type:           'human',
      relation:       this._relation,
      teamSize:       this._teamSize,
      coopFriendlies: this._relation === 'with' ? this._teamSize - 1 : null,
      duration:       this._duration,   // minutes, null = unlimited
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

    // Block button clicks for a short window after any step change. Frame-based
    // guards aren't enough — some browsers fire a synthetic mousedown from Enter
    // that lands on the next screen's first button.
    const blockClicks = performance.now() < this._stepBlockUntil;
    const mouse = game.input.mouse;
    const savedLeft = mouse.leftPressed;
    const savedEnter = this._enterPressed;
    if (blockClicks) { mouse.leftPressed = false; this._enterPressed = false; }

    // Route to active step.
    if      (this._step === 'mode')     this._drawMode(ctx, W, H, cx);
    else if (this._step === 'opponent') this._drawOpponent(ctx, W, H, cx);
    else if (this._step === 'relation') this._drawRelation(ctx, W, H, cx);
    else if (this._step === 'teamSize') this._drawTeamSize(ctx, W, H, cx);
    else if (this._step === 'duration') this._drawDuration(ctx, W, H, cx);
    else if (this._step === 'netlobby') this._drawNetLobby(ctx, W, H, cx);

    if (blockClicks) { mouse.leftPressed = savedLeft; this._enterPressed = savedEnter; }

    // Footer hint.
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#555a4c';
    ctx.fillText('WASD move · mouse aim · RMB ADS · G frag · T tactical · F knife · Z prone · TAB scores · F1 debug', cx, H - 26);
  }

  _drawBreadcrumb(ctx, W, H, cx) {
    const steps = ['MODE', 'OPPONENT', 'SETUP', 'DURATION', 'DEPLOY'];
    const active = { mode: 0, opponent: 1, relation: 2, teamSize: 3, duration: 3 }[this._step];
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
      if (this._btn(ctx, m.id, cx - cardW / 2, y, cardW, 46,
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
    if (this._btn(ctx, 'loadout', cx - cardW / 2, y, half, 48, 'LOADOUT')) {
      game.state = 'loadout';
    }
    if (this._btn(ctx, 'next', cx + 6, y, half, 48, 'NEXT ▶', true)) {
      this._goStep('opponent');
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

    if (this._btn(ctx, 'npc', cx - cardW / 2, y, cardW, cardH, '🤖  VS NPCs', false)) {
      this._relation = null;
      this._goStep('duration');
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Solo run against AI enemies', cx, y + cardH - 14);

    y += cardH + 20;

    if (this._btn(ctx, 'human', cx - cardW / 2, y, cardW, cardH, '👥  WITH SOMEONE', true)) {
      this._goStep('relation');
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Local squad config — fight AI with or against a friend slot', cx, y + cardH - 14);

    y += cardH + 20;

    if (this._btn(ctx, 'online', cx - cardW / 2, y, cardW, cardH, '🌐  ONLINE — PLAY WITH FRIENDS', true)) {
      this._goStep('netlobby');
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Real friends over the internet — host a room or join a code', cx, y + cardH - 14);

    y += cardH + 30;
    if (this._btn(ctx, 'back', cx - 80, y, 160, 38, '◀ BACK')) {
      this._goStep('mode');
    }
  }

  // Online lobby: host a room (share the code) or join a friend's code.
  _drawNetLobby(ctx, W, H, cx) {
    const game = this.game;
    const net = game.net;
    const cardW = Math.min(480, W - 60);
    let y = H * 0.33;

    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PLAY WITH FRIENDS — ONLINE', cx, y - 28);

    const status = net ? net.status : 'idle';

    // Idle / error: choose co-op vs pvp, then host or join.
    if (status === 'idle' || status === 'error') {
      // Relation toggle.
      const half = cardW / 2 - 6;
      if (this._btn(ctx, 'rel_with', cx - cardW / 2, y, half, 40,
          '🤝 CO-OP', this._netRelation === 'with')) this._netRelation = 'with';
      if (this._btn(ctx, 'rel_against', cx + 6, y, half, 40,
          '⚔️ PvP', this._netRelation === 'against')) this._netRelation = 'against';
      y += 56;

      if (this._btn(ctx, 'host', cx - cardW / 2, y, cardW, 56, '🛰  HOST GAME', true)) {
        net?.host(this._netRelation);
      }
      y += 66;
      if (this._btn(ctx, 'join', cx - cardW / 2, y, cardW, 56, '🔌  JOIN GAME')) {
        const code = (typeof window !== 'undefined' && window.prompt)
          ? window.prompt("Enter your friend's room code:") : '';
        if (code && code.trim()) net?.join(code, this._netRelation);
      }
      y += 70;

      if (status === 'error') {
        ctx.font = `11px ${MONO}`;
        ctx.fillStyle = '#e04f33';
        ctx.fillText('⚠ ' + (net.error || 'Connection failed'), cx, y);
        y += 22;
      }
    } else if (net.role === 'host') {
      // Hosting: show the code + connection state.
      ctx.font = `11px ${MONO}`;
      ctx.fillStyle = '#8d957f';
      ctx.fillText(status === 'loading' ? 'Starting room…' : 'YOUR ROOM CODE — share it with your friend', cx, y - 4);
      y += 26;

      ctx.font = `bold 52px ${MONO}`;
      ctx.fillStyle = '#d65c32';
      ctx.fillText(net.roomCode || '·····', cx, y + 16);
      y += 56;

      ctx.font = `12px ${MONO}`;
      ctx.fillStyle = net.connected ? '#5db84a' : '#d6a13c';
      ctx.fillText(net.connected
        ? `✓ ${net.conns.length} friend(s) connected`
        : 'Waiting for a friend to join…', cx, y);
      y += 30;

      const canStart = net.connected;
      if (this._btn(ctx, 'deploy', cx - cardW / 2, y, cardW, 52,
          canStart ? '▶ DEPLOY' : 'WAITING FOR FRIEND…', canStart)) {
        if (canStart) net.beginMatch(this.selected);
      }
      y += 64;
    } else {
      // Client: connecting / connected, waiting for host.
      ctx.font = `13px ${MONO}`;
      ctx.fillStyle = '#8d957f';
      const txt = status === 'connecting' || status === 'loading'
        ? `Connecting to ${net.roomCode || ''}…`
        : '✓ Connected — waiting for host to start…';
      ctx.fillText(txt, cx, y + 6);
      y += 40;
    }

    y += 14;
    if (this._btn(ctx, 'back', cx - 80, y, 160, 38, '◀ BACK')) {
      net?.shutdown();
      this._goStep('opponent');
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

    if (this._btn(ctx, 'with', cx - cardW / 2, y, cardW, cardH, '🤝  WITH YOUR FRIEND', false)) {
      this._relation = 'with';
      this._goStep('teamSize');
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('Co-op — fight AI enemies together on the same team', cx, y + cardH - 14);

    y += cardH + 20;

    if (this._btn(ctx, 'against', cx - cardW / 2, y, cardW, cardH, '⚔️  AGAINST YOUR FRIEND', true)) {
      this._relation = 'against';
      this._goStep('teamSize');
    }
    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = '#6b7361';
    ctx.fillText('PvP — face off in teams on the same map', cx, y + cardH - 14);

    y += cardH + 40;
    if (this._btn(ctx, 'back', cx - 80, y, 160, 38, '◀ BACK')) {
      this._goStep('opponent');
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
      if (this._btn(ctx, `sz_${sz}`, bx, y, btnW, 56, label, isSelected)) {
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
    if (this._btn(ctx, 'back', cx - cardW / 2, y, cardW / 2 - 6, 44, '◀ BACK')) {
      this._goStep('relation');
      this._teamSize = null;
    }

    const canNext = this._teamSize !== null;
    if (this._btn(ctx, 'next', cx + 6, y, cardW / 2 - 6, 44, canNext ? 'NEXT ▶' : 'SELECT SIZE', canNext)) {
      if (canNext) this._goStep('duration');
    }
  }

  // Step: choose match duration.
  _drawDuration(ctx, W, H, cx) {
    const cardW = Math.min(480, W - 60);
    let y = H * 0.33;

    ctx.font = `bold 15px ${MONO}`;
    ctx.fillStyle = '#e8e2cf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MATCH DURATION', cx, y - 28);

    const OPTIONS = [5, 10, 15, 20, 30, null]; // null = unlimited
    const btnW = Math.min(130, (cardW - (OPTIONS.length - 1) * 10) / OPTIONS.length);
    const totalRowW = OPTIONS.length * btnW + (OPTIONS.length - 1) * 10;
    let bx = cx - totalRowW / 2;
    for (const min of OPTIONS) {
      const label = min === null ? '∞  NO LIMIT' : `${min} MIN`;
      const isSel = this._duration === min;
      if (this._btn(ctx, `dur_${min}`, bx, y, btnW, 56, label, isSel)) {
        this._duration = min;
      }
      bx += btnW + 10;
    }

    y += 80;
    if (this._duration !== null) {
      ctx.font = `11px ${MONO}`;
      ctx.fillStyle = '#d65c32';
      ctx.fillText(
        this._duration === null ? 'Match runs until kill limit' : `Match ends after ${this._duration} minutes`,
        cx, y,
      );
      y += 22;
    }

    y += 16;
    const backStep = this._relation ? 'teamSize' : 'opponent';
    if (this._btn(ctx, 'back', cx - cardW / 2, y, cardW / 2 - 6, 44, '◀ BACK')) {
      this._goStep(backStep);
    }
    const canDeploy = this._duration !== undefined; // always true (null = unlimited is valid)
    if (this._btn(ctx, 'deploy', cx + 6, y, cardW / 2 - 6, 44, '▶ DEPLOY', true)) {
      if (this._relation) this._deployMultiplayer();
      else this._deploy();
    }
  }
}
