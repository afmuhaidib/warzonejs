// core/EventBus.js — Global pub/sub event system.
// Decouples systems that would otherwise create import cycles (AI ↔ weapons ↔ UI).
// The full event registry lives in ARCHITECTURE.md. Leaf module: no dependencies.

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    const list = this.listeners.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  emit(name, payload) {
    const list = this.listeners.get(name);
    if (!list) return;
    // Iterate a copy so listeners may subscribe/unsubscribe during dispatch.
    for (const fn of list.slice()) fn(payload);
  }

  clear() {
    this.listeners.clear();
  }
}
