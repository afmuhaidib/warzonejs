// core/Canvas.js — Canvas setup, resize handling, 2D context.
// Owns the backing-store scale (devicePixelRatio); all game code works in CSS pixels.
// Dependencies: DOM only.

export class GameCanvas {
  constructor(elementId = 'game') {
    this.el = document.getElementById(elementId);
    this.ctx = this.el.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this._resizeTimer = null;
    this.resize();
    window.addEventListener('resize', () => {
      // Debounce: iOS fires resize multiple times during orientation change.
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(), 16);
    }, { passive: true });
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    // Use clientWidth/Height — unlike innerWidth/Height these exclude the iOS
    // browser chrome (address bar) so the canvas is sized to the actual viewport.
    this.width = document.documentElement.clientWidth || window.innerWidth;
    this.height = document.documentElement.clientHeight || window.innerHeight;
    this.el.width = Math.round(this.width * this.dpr);
    this.el.height = Math.round(this.height * this.dpr);
    this.el.style.width = this.width + 'px';
    this.el.style.height = this.height + 'px';
    // Base transform maps CSS pixels -> device pixels. save()/restore() in the
    // render path always returns to this transform.
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }
}
