'use strict';

// Plain objects and collections share one observable graph. Multiple writes in
// the same frame notify subscribers once; rendering never owns application state.
export class StateRegistry {
  constructor(initial, schedule = callback => globalThis.requestAnimationFrame(callback)) {
    this.listeners = new Set();
    this.pending = new Set();
    this.scheduled = false;
    this.schedule = schedule;
    this.cache = new WeakMap();
    this.state = this.observe(initial, '');
  }

  changed(path) {
    this.pending.add(path);
    if (this.scheduled) return;
    this.scheduled = true;
    try {
      this.schedule(() => this.flush());
    } catch (error) {
      this.scheduled = false;
      throw error;
    }
  }

  flush() {
    this.scheduled = false;
    const paths = [...this.pending];
    this.pending.clear();
    for (const { keys, render } of this.listeners) {
      if (keys.some(key => paths.some(path => path === key || path.startsWith(`${key}.`) || key.startsWith(`${path}.`)))) {
        // A broken view must not prevent independent views from updating.
        try { render(this.state, paths); }
        catch (error) { globalThis.reportError(error); }
      }
    }
  }

  subscribe(keys, render, immediate = true) {
    const entry = { keys, render };
    this.listeners.add(entry);
    if (immediate) render(this.state, keys);
    return () => this.listeners.delete(entry);
  }

  observe(value, path) {
    if (!value || typeof value !== 'object') return value;
    if (this.cache.has(value)) return this.cache.get(value);
    const proxy = new Proxy(value, {
      get: (target, key) => {
        if (target instanceof Set || target instanceof Map) {
          if (['add', 'set', 'delete', 'clear'].includes(key)) return (...args) => {
            const changed = key === 'clear' ? target.size > 0
              : key === 'delete' ? target.has(args[0])
              : key === 'add' ? !target.has(args[0]) : !target.has(args[0]) || !Object.is(target.get(args[0]), args[1]);
            const result = target[key](...args);
            if (changed) this.changed(path);
            return result === target ? proxy : result;
          };
          const item = Reflect.get(target, key, target);
          return typeof item === 'function' ? item.bind(target) : item;
        }
        return this.observe(target[key], path ? `${path}.${String(key)}` : String(key));
      },
      set: (target, key, next) => {
        if (Object.is(target[key], next)) return true;
        target[key] = next;
        this.changed(path ? `${path}.${String(key)}` : String(key));
        return true;
      },
      deleteProperty: (target, key) => {
        if (!(key in target)) return true;
        delete target[key];
        this.changed(path ? `${path}.${String(key)}` : String(key));
        return true;
      }
    });
    this.cache.set(value, proxy);
    this.cache.set(proxy, proxy);
    return proxy;
  }
}

export function frameDebounce(callback, schedule = requestAnimationFrame) {
  let pending = false;
  let latest;
  return (...args) => {
    latest = args;
    if (pending) return;
    pending = true;
    schedule(() => { pending = false; callback(...latest); });
  };
}
