// utils/ObjectPool.js — Reusable object pool base.
// Avoids per-frame allocation for high-churn objects (bullets, particles).
// The pool only manages the free list; callers track their own active lists.
// Leaf module: no dependencies.

export class ObjectPool {
  /**
   * @param {() => object} factory  creates a fresh instance when the pool is empty
   * @param {number} initialSize    pre-warm count
   */
  constructor(factory, initialSize = 0) {
    this.factory = factory;
    this.free = [];
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  acquire() {
    return this.free.pop() || this.factory();
  }

  release(obj) {
    this.free.push(obj);
  }

  get available() {
    return this.free.length;
  }
}
