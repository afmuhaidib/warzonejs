// main.js — Entry point only.
// Boots core/Game (the composition root) and starts the loop.
// Dependencies: core/Game.js

import { Game } from './core/Game.js';

const game = new Game();
game.start();

// Ensure keyboard events fire immediately without requiring a click first.
const canvas = document.getElementById('game');
canvas.setAttribute('tabindex', '0');
canvas.focus();

// Exposed for console poking during development only.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  window.__game = game;
}
