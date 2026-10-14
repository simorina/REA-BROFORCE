export interface HudState {
  lives: number;
  ammo: number;
}

export function createHudStore(initial: HudState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): HudState => state,
    set(next: HudState): void {
      if (next.lives === state.lives && next.ammo === state.ammo) return;
      state = next;
      for (const l of listeners) l();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type HudStore = ReturnType<typeof createHudStore>;
