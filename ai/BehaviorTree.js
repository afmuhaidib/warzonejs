// ai/BehaviorTree.js — Core behavior-tree engine: statuses, composites
// (Selector, Sequence), and leaves (Condition, Action). Trees are re-evaluated
// from the root every tick (reactive), so a higher-priority branch (e.g. combat)
// preempts a lower one (patrol) the instant its condition flips. Node-local
// state lives on the enemy's blackboard (enemy.bb), never on the nodes, so one
// tree instance is safely shared by every enemy.
// Leaf module: no dependencies.

export const SUCCESS = 'success';
export const FAILURE = 'failure';
export const RUNNING = 'running';

/** Ticks children in order; returns the first non-FAILURE result. Priority list. */
export class Selector {
  constructor(children) { this.children = children; }
  tick(enemy, game, dt) {
    for (const c of this.children) {
      const r = c.tick(enemy, game, dt);
      if (r !== FAILURE) return r;
    }
    return FAILURE;
  }
}

/** Ticks children in order; bails on the first non-SUCCESS result. Guard + act. */
export class Sequence {
  constructor(children) { this.children = children; }
  tick(enemy, game, dt) {
    for (const c of this.children) {
      const r = c.tick(enemy, game, dt);
      if (r !== SUCCESS) return r;
    }
    return SUCCESS;
  }
}

/** Boolean predicate leaf: fn(enemy, game) -> SUCCESS / FAILURE. */
export class Condition {
  constructor(fn) { this.fn = fn; }
  tick(enemy, game) {
    return this.fn(enemy, game) ? SUCCESS : FAILURE;
  }
}

/** Work leaf: fn(enemy, game, dt) must return a status. */
export class Action {
  constructor(fn) { this.fn = fn; }
  tick(enemy, game, dt) {
    return this.fn(enemy, game, dt);
  }
}

/** Flips SUCCESS <-> FAILURE; passes RUNNING through. */
export class Inverter {
  constructor(child) { this.child = child; }
  tick(enemy, game, dt) {
    const r = this.child.tick(enemy, game, dt);
    if (r === RUNNING) return r;
    return r === SUCCESS ? FAILURE : SUCCESS;
  }
}
