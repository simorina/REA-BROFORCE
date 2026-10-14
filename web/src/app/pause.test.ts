import { describe, expect, it } from 'vitest';
import { createPause, isPauseKey } from './pause';

describe('createPause', () => {
  it('starts running, toggles, and notifies only on change', () => {
    const pause = createPause();
    let calls = 0;
    pause.subscribe(() => calls++);
    expect(pause.get()).toBe(false);
    pause.toggle();
    expect(pause.get()).toBe(true);
    pause.set(true);
    expect(calls).toBe(1);
    pause.set(false);
    expect(pause.get()).toBe(false);
    expect(calls).toBe(2);
  });

  it('Escape and P pause; other keys do not', () => {
    expect(isPauseKey('Escape')).toBe(true);
    expect(isPauseKey('KeyP')).toBe(true);
    expect(isPauseKey('KeyX')).toBe(false);
  });
});
