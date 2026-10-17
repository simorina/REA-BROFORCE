import { describe, expect, it } from 'vitest';
import { createHudStore } from './hudStore';

describe('createHudStore', () => {
  it('notifies only when lives, ammo or the portrait change', () => {
    const store = createHudStore({ lives: 3, ammo: 4, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 4, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    expect(calls).toBe(0);
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    store.set({ lives: 3, ammo: 3, portrait: '/b.png', fuel: null, boss: null, bossName: null });
    expect(calls).toBe(2);
    expect(store.get()).toEqual({ lives: 3, ammo: 3, portrait: '/b.png', fuel: null, boss: null, bossName: null });
    off();
    store.set({ lives: 2, ammo: 3, portrait: '/b.png', fuel: null, boss: null, bossName: null });
    expect(calls).toBe(2);
  });

  it('notifies when the fuel bar appears, moves or goes', () => {
    const store = createHudStore({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: 1, boss: null, bossName: null });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: 1, boss: null, bossName: null });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: 0.5, boss: null, bossName: null });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    expect(calls).toBe(3);
  });

  it("notifies when the boss's name changes (Epstein, then his Goliath)", () => {
    const store = createHudStore({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: 1, bossName: 'A' });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: 1, bossName: 'B' });
    expect(calls).toBe(1);
  });

  it("notifies when the boss's bar appears, drops or goes", () => {
    const store = createHudStore({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    let calls = 0;
    store.subscribe(() => calls++);
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: 1, bossName: 'X' });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: 1, bossName: 'X' });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: 0.5, bossName: 'X' });
    store.set({ lives: 3, ammo: 3, portrait: '/a.png', fuel: null, boss: null, bossName: null });
    expect(calls).toBe(3);
  });
});
