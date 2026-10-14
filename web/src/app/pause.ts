const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

export function isPauseKey(code: string): boolean {
  return PAUSE_KEYS.has(code);
}

/** Paused/running flag for the game loop and the pause overlay (useSyncExternalStore-compatible). */
export function createPause() {
  let paused = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean): void => {
    if (next === paused) return;
    paused = next;
    for (const l of listeners) l();
  };
  return {
    get: (): boolean => paused,
    set,
    toggle: (): void => set(!paused),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Pause = ReturnType<typeof createPause>;
