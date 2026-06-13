// core/AssetLoader.js — Generates and caches all drawn assets.
// There are no image files in this project: every "asset" is an offscreen canvas
// produced once by a draw function and cached by key (tile sprites, noise
// overlays, the pre-rendered world). Dependencies: DOM only.

export class AssetLoader {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get-or-create a procedural asset.
   * @param {string} key
   * @param {number} w
   * @param {number} h
   * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
   * @returns {HTMLCanvasElement}
   */
  make(key, w, h, draw) {
    if (this.cache.has(key)) return this.cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    draw(canvas.getContext('2d'), canvas.width, canvas.height);
    this.cache.set(key, canvas);
    return canvas;
  }

  get(key) { return this.cache.get(key); }
  has(key) { return this.cache.has(key); }
}
