// ui/UIManager.js — Renders all screen-space UI layers in order:
// HUD → minimap → kill feed → state overlays (death / pause).
// Owns the per-layer instances; Game just calls update(dt) + draw(ctx).
// Dependencies: player/PlayerHUD, world/Minimap (via game), KillFeed,
// DeathScreen, PauseMenu.

import { PlayerHUD } from '../player/PlayerHUD.js';
import { KillFeed } from './KillFeed.js';
import { DeathScreen } from './DeathScreen.js';
import { PauseMenu } from './PauseMenu.js';
import { MainMenu } from './MainMenu.js';
import { EndGameScreen } from './EndGameScreen.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.hud = new PlayerHUD(game);
    this.killFeed = new KillFeed(game);
    this.deathScreen = new DeathScreen(game);
    this.pauseMenu = new PauseMenu(game);
    this.mainMenu = new MainMenu(game);
    this.endGameScreen = new EndGameScreen(game);
  }

  update(dt) {
    if (this.game.state === 'menu') {
      this.mainMenu.update(dt);
    }
    this.hud.update(dt);
    this.killFeed.update(dt);
  }

  draw(ctx) {
    const state = this.game.state;
    if (state === 'menu') {
      this.mainMenu.draw(ctx);
      return;
    }
    if (state === 'loadout') {
      this.game.loadout.editor.draw(ctx);
      return;
    }
    if (state === 'gameover') {
      this.endGameScreen.draw(ctx);
      return;
    }

    if (this.game.replay.killcam.active) {
      this.game.replay.killcam.draw(ctx);
    } else {
      this.hud.draw(ctx); // skips itself while dead
      if (state === 'dead') {
        this.game.replay.spectate.drawOverlay(ctx);
        this.deathScreen.draw(ctx);
      }
    }

    this.game.minimap.draw(ctx, this.game);
    this.killFeed.draw(ctx);
    if (state === 'paused') this.pauseMenu.draw(ctx);
  }
}
