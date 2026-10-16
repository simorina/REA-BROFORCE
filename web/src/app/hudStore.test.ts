import { describe, expect, it } from 'vitest';
import { createHudStore } from './hudStore';

describe('createHudStore', () => {
  it('notifies only when lives, ammo or the portrait change', () => {
    const store = createHudStore({ lives: 3, ammo: 4, portrait: '/a.png' });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 4, portrait: '/a.png' });
    expect(calls).toBe(0);
    store.set({ lives: 3, ammo: 3, portrait: '/a.png' });
    store.set({ lives: 3, ammo: 3, portrait: '/b.png' });
    expect(calls).toBe(2);
    expect(store.get()).toEqual({ lives: 3, ammo: 3, portrait: '/b.png' });
    off();
    store.set({ lives: 2, ammo: 3, portrait: '/b.png' });
    expect(calls).toBe(2);
  });
});
