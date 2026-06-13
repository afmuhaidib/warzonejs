// world/TileTypes.js — All tile/object definitions and the world tile size.
// Semantics:
//   solid         — blocks movement
//   blocksBullets — stops bullet traces
//   blocksVision  — stops AI/LOS raycasts
// Low cover (CRATE, BARRIER) stops bullets but NOT vision: targets can be tracked
// over it but must be peeked around to be shot. ROCK and WALL are tall.
// Leaf module: no dependencies.

export const TILE_SIZE = 40;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  CRATE: 2,
  BARRIER: 3,
  ROCK: 4,
  ROAD: 5,
};

export const TILE_DEFS = {
  [TILE.FLOOR]: {
    name: 'floor',
    solid: false, blocksBullets: false, blocksVision: false, cover: false,
    base: '#1c231b',
  },
  [TILE.ROAD]: {
    name: 'road',
    solid: false, blocksBullets: false, blocksVision: false, cover: false,
    base: '#22262a',
  },
  [TILE.WALL]: {
    name: 'wall',
    solid: true, blocksBullets: true, blocksVision: true, cover: false,
    base: '#383d37',
  },
  [TILE.CRATE]: {
    name: 'crate',
    solid: true, blocksBullets: true, blocksVision: false, cover: true,
    base: '#4a3a21',
  },
  [TILE.BARRIER]: {
    name: 'barrier',
    solid: true, blocksBullets: true, blocksVision: false, cover: true,
    base: '#3a4030',
  },
  [TILE.ROCK]: {
    name: 'rock',
    solid: true, blocksBullets: true, blocksVision: true, cover: true,
    base: '#3b3e41',
  },
};
