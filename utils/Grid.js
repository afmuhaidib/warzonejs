// utils/Grid.js — Generic dense 2D grid over a flat array.
// Used by the map (tile ids) and pathfinding scratch space. Leaf module: no dependencies.

export class Grid {
  constructor(width, height, fillValue = 0) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(fillValue);
  }

  index(x, y) { return y * this.width + x; }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y) {
    return this.cells[y * this.width + x];
  }

  set(x, y, v) {
    this.cells[y * this.width + x] = v;
  }

  fill(v) {
    this.cells.fill(v);
    return this;
  }

  forEach(fn) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        fn(x, y, this.cells[y * this.width + x]);
      }
    }
  }
}
