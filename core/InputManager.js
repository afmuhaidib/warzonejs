// core/InputManager.js — Keyboard + mouse, unified polling interface.
// `isDown(code)` for held keys, `wasPressed(code)` for edge-triggered presses
// (cleared by Game at end of frame via endFrame()). Mouse coords are CSS pixels.
// Dependencies: DOM only.

const PREVENT_DEFAULT = new Set([
  'F1', 'Tab', 'Space', 'KeyR', 'Enter', 'NumpadEnter',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF',
  'KeyG', 'KeyH', 'KeyN', 'KeyT', 'KeyZ', 'KeyC', 'KeyX',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
  'ShiftLeft', 'ControlLeft',
]);

export class InputManager {
  constructor() {
    this.keys = new Set();      // codes currently held
    this.pressed = new Set();   // codes pressed since last endFrame()
    this.mouse = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      left: false,
      right: false,
      leftPressed: false,
      rightPressed: false,
    };
    this.wheel = 0; // accumulated wheel steps this frame (+down / -up)

    window.addEventListener('keydown', (e) => {
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressed.add(e.code);
      }
      // Never block browser shortcuts that use Cmd/Ctrl (e.g. Cmd+Shift+R to force-refresh).
      if (PREVENT_DEFAULT.has(e.code) && !e.metaKey && !e.ctrlKey) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  /** Called by Game once per frame, after update+render. */
  endFrame() {
    this.pressed.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.wheel = 0;
  }
}
