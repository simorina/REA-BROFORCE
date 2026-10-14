import { describe, expect, it } from 'vitest';
import { createHudStore } from './hudStore';

describe('createHudStore', () => {
  it('notifies only when lives or ammo change', () => {
    const store = createHudStore({ lives: 3, ammo: 4 });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 4 });
    expect(calls).toBe(0);
    store.set({ lives: 3, ammo: 3 });
    expect(calls).toBe(1);
    expect(store.get()).toEqual({ lives: 3, ammo: 3 });
    off();
    store.set({ lives: 2, ammo: 3 });
    expect(calls).toBe(1);
  });
});
