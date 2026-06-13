// core/Game.js — Main loop, delta time, state manager, composition root.
// Owns one instance of every subsystem and passes itself (`game`) down as the
// shared context object (canonical field list in ARCHITECTURE.md).
// States: 'playing' -> 'paused' (Esc) and 'playing' -> 'dead' -> respawn.
// Dependencies: every subsystem (this is the only module allowed to import upward).

import { GameCanvas } from './Canvas.js';
import { EventBus } from './EventBus.js';
import { InputManager } from './InputManager.js';
import { AssetLoader } from './AssetLoader.js';
import { Camera } from './Camera.js';
import { DebugOverlay } from '../utils/DebugOverlay.js';
import { GameMap } from '../world/Map.js';
import { MapRenderer } from '../world/MapRenderer.js';
import { Minimap } from '../world/Minimap.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { PlayerCombat } from '../player/PlayerCombat.js';
import { PlayerRenderer } from '../player/PlayerRenderer.js';
import { WeaponManager } from '../weapons/WeaponManager.js';
import { BulletPool } from '../weapons/BulletPool.js';
import { EffectsManager } from '../effects/EffectsManager.js';
import { AIManager } from '../ai/AIManager.js';
import { DifficultyScaler } from '../ai/DifficultyScaler.js';
import { UIManager } from '../ui/UIManager.js';
import { StaminaSystem } from '../player/StaminaSystem.js';
import { SlideSystem } from '../player/SlideSystem.js';
import { ProneSystem } from '../player/ProneSystem.js';
import { LeanSystem } from '../player/LeanSystem.js';
import { MantleSystem } from '../player/MantleSystem.js';
import { ExplosionSystem } from '../combat/ExplosionSystem.js';
import { GrenadeSystem } from '../combat/GrenadeSystem.js';
import { FlashbangSystem } from '../combat/FlashbangSystem.js';
import { SmokeGrenade } from '../combat/SmokeGrenade.js';
import { KnifeSystem } from '../combat/KnifeSystem.js';
import { RankSystem } from '../progression/RankSystem.js';
import { XPSystem } from '../progression/XPSystem.js';
import { UnlockTree } from '../progression/UnlockTree.js';
import { ChallengeSystem } from '../progression/ChallengeSystem.js';
import { AttachmentSystem } from '../progression/AttachmentSystem.js';
import { KillstreakManager } from '../killstreaks/KillstreakManager.js';
import { LoadoutEditor } from '../ui/LoadoutEditor.js';
import { ViewmodelRig } from '../animations/ViewmodelRig.js';
import { ReplayBuffer } from '../replay/ReplayBuffer.js';
import { KillCamPlayer } from '../replay/KillCamPlayer.js';
import { SpectateSystem } from '../replay/SpectateSystem.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { GameModeManager } from '../modes/GameModeManager.js';
import { EquipmentManager } from '../equipment/EquipmentManager.js';
import { SpawnIntro } from '../effects/SpawnIntro.js';
import { TouchInput } from './TouchInput.js';

const RESPAWN_DELAY = 3.0;

export class Game {
  constructor() {
    // --- core ---
    this.canvas = new GameCanvas('game');
    this.events = new EventBus();
    this.input = new InputManager();
    this.assets = new AssetLoader();
    this.debug = new DebugOverlay();

    this.time = 0;
    this.state = 'playing';
    this.deathTimer = 0;

    // --- world ---
    this.map = new GameMap(Math.floor(Math.random() * 1e9));
    this.camera = new Camera(this.canvas);
    this.camera.setBounds(this.map.worldWidth, this.map.worldHeight);
    this.mapRenderer = new MapRenderer(this.map, this.assets);
    this.minimap = new Minimap(this.map);

    // --- combat plumbing (before entities so they can reference it) ---
    this.effects = new EffectsManager(this);
    this.bullets = new BulletPool(this);
    this.pickups = [];

    // --- movement systems ---
    this.movement = {
      stamina: new StaminaSystem(this),
      slide: new SlideSystem(this),
      prone: new ProneSystem(this),
      lean: new LeanSystem(this),
      mantle: new MantleSystem(this),
    };

    // --- combat systems ---
    this.combat = {
      explosions: new ExplosionSystem(this),
      grenades: new GrenadeSystem(this),
      flash: new FlashbangSystem(this),
      smoke: new SmokeGrenade(this),
      knife: new KnifeSystem(this),
    };

    // --- player ---
    this.player = new Player(this.map.playerSpawn);
    this.camera.snapTo(this.player.pos);
    this.playerController = new PlayerController(this);
    this.weapons = new WeaponManager(this);
    this.playerCombat = new PlayerCombat(this);

    // --- ai ---
    this.difficulty = new DifficultyScaler(this);
    this.ai = new AIManager(this);

    // --- progression ---
    this.progression = {};
    this.progression.rank = new RankSystem(this);
    this.progression.xp = new XPSystem(this);
    this.progression.unlocks = new UnlockTree(this);
    this.progression.challenges = new ChallengeSystem(this);
    this.progression.attachments = new AttachmentSystem(this);

    // --- loadout & equipment ---
    const saved = this.progression.rank.load();
    this.loadout = {
      primary: saved.primary || 'AR',
      tactical: saved.tactical || 'flash',
      editor: new LoadoutEditor(this),
    };
    this.audio = new AudioEngine();
    this.audio.init(this);
    this.modes = new GameModeManager(this);
    this.equipment = new EquipmentManager(this);

    // --- ui & animations ---
    this.ui = new UIManager(this);
    this.viewmodel = new ViewmodelRig(this);

    // --- replay ---
    this.spawnIntro = new SpawnIntro();

    this.replay = {
      buffer: new ReplayBuffer(this),
      killcam: new KillCamPlayer(this),
      spectate: new SpectateSystem(this),
    };

    // --- touch controls ---
    this.touch = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      ? new TouchInput(this.canvas)
      : null;
    if (this.touch) this.touch.game = this;

    // --- misc ---
    this.killstreaks = new KillstreakManager(this);

    this.events.on('player:died', () => {
      this.state = 'dead';
      this.deathTimer = RESPAWN_DELAY;
      this.effects.addShake(0.6);
    });

    // Taking fire cancels an in-progress reload — get caught mid-mag-swap and
    // you have to re-trigger it. Keeps reloading out in the open risky.
    this.events.on('player:damaged', () => {
      const weapon = this.weapons.current;
      if (weapon && weapon.reloading) weapon.cancelReload();
    });

    this.state = 'menu';
    this._last = 0;
  }

  saveLoadout() {
    this.progression.rank.save({
      primary: this.loadout.primary,
      tactical: this.loadout.tactical,
    });
  }

  start() {
    this.ai.spawnInitial();
    requestAnimationFrame((t) => {
      this._last = t;
      this.loop(t);
    });
  }

  loop(t) {
    // Clamp dt so a backgrounded tab doesn't produce a giant simulation step.
    const dt = Math.min((t - this._last) / 1000, 0.05);
    this._last = t;
    this.tick(dt > 0 ? dt : 0.016);
    requestAnimationFrame((t2) => this.loop(t2));
  }

  tick(dt) {
    this.debug.update(dt, this);
    if (this.touch) this.touch.update();

    if (this.input.wasPressed('Escape')) {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }

    if (this.state !== 'paused') this.update(dt);
    this.render();
    this.input.endFrame();
    if (this.touch) this.touch.endFrame();
  }

  update(dt) {
    this.time += dt;

    // Don't simulate during menu or gameover — no combat, no state corruption.
    const inMatch = this.state !== 'menu' && this.state !== 'gameover';

    if (this.state === 'dead') {
      this.deathTimer -= dt;
      // Only auto-respawn if the active mode allows it (SnD handles its own respawn).
      if (this.deathTimer <= 0 && this.modes.canRespawn()) this.respawnPlayer();
    }

    if (this.state === 'playing') {
      this.movement.stamina.update(dt);
      this.movement.slide.update(dt);
      this.movement.prone.update(dt);
      this.movement.lean.update(dt);
      this.movement.mantle.update(dt);
      this.playerController.update(dt);
      this.playerCombat.update(dt);
      this.weapons.update(dt);
      this.combat.explosions.update(dt);
      this.combat.grenades.update(dt);
      this.combat.flash.update(dt);
      this.combat.smoke.update(dt);
      this.combat.knife.update(dt);
      this.killstreaks.update(dt);
      this.viewmodel.update(dt);
      this.equipment.update(dt);
    }

    if (inMatch) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        this.pickups[i].update(dt, this);
        if (this.pickups[i].dead) this.pickups.splice(i, 1);
      }
    }

    if (inMatch) {
      this.ai.update(dt);
      this.bullets.update(dt);
      this.effects.update(dt);
      this.replay.buffer.update(dt);
      if (this.replay.killcam.active) this.replay.killcam.update(dt);
      this.replay.spectate.update(dt);
      this.modes.update(dt);
      this.spawnIntro.update(dt);
    }

    // Camera: skip normal follow when killcam or spectate owns the camera.
    this.camera.shakeX = this.effects.screenShake.offsetX;
    this.camera.shakeY = this.effects.screenShake.offsetY;
    if (!this.replay.killcam.active && this.state !== 'dead') {
      this.camera.follow(this.player.pos, dt); // no aim lead — stays centered on player
    }

    this.ui.update(dt);
  }

  respawnPlayer() {
    this.player.respawn(this.map.playerSpawn);
    this.weapons.refill();
    this.camera.snapTo(this.player.pos);
    this.state = 'playing';
    this.events.emit('player:respawned', {});
  }

  render() {
    const ctx = this.canvas.ctx;
    ctx.fillStyle = '#070907';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'playing' || this.state === 'dead' || this.state === 'paused') {
      this.camera.begin(ctx);
      this.mapRenderer.draw(ctx, this.camera, this.canvas);
      this.modes.drawWorld(ctx);
      for (const pickup of this.pickups) pickup.draw(ctx, this);
      this.ai.draw(ctx, this);
      if (this.player.alive) PlayerRenderer.draw(ctx, this.player, this);
      this.bullets.draw(ctx);
      this.effects.draw(ctx);
      this.combat.grenades.drawWorld(ctx);
      this.combat.smoke.drawWorld(ctx, this);
      this.equipment.drawWorld(ctx);
      this.killstreaks.drawWorld(ctx);
      if (this.debug.enabled) this.map.cover.debugDraw(ctx);
      this.spawnIntro.drawWorld(ctx, this.map.playerSpawn);
      this.camera.end(ctx);

      this.mapRenderer.drawAtmosphere(ctx, this.canvas);
      this.equipment.drawScreen(ctx);
      this.killstreaks.drawScreen(ctx);
      this.viewmodel.draw(ctx);
      this.spawnIntro.drawScreen(ctx, this.canvas.width, this.canvas.height);
    }

    this.ui.draw(ctx);
    if (this.touch) this.touch.draw(ctx, this.canvas.width, this.canvas.height);
    this.debug.draw(ctx, this);
  }
}
