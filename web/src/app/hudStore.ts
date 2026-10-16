export interface HudState {
  lives: number;
  ammo: number;
  portrait: string; // URL of the current bro's sheet
  fuel: number | null; // the jet's fuel, 0..1, while flying
}

export function createHudStore(initial: HudState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): HudState => state,
    set(next: HudState): void {
      if (next.lives === state.lives && next.ammo === state.ammo && next.portrait === state.portrait && next.fuel === state.fuel) return;
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
