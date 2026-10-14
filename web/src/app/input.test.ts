import { describe, expect, it } from 'vitest';
import { Keyboard, controlsFromKeys } from './input';

const key = (type: string, code: string) => Object.assign(new Event(type), { code });

describe('input', () => {
  it('maps arrows/WASD, jump, fire, special and dash', () => {
    const c = controlsFromKeys(new Set(['ArrowLeft', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft']));
    expect(c).toEqual({ left: true, right: false, up: false, down: false, jump: true, fire: true, special: true, dash: true });
    expect(controlsFromKeys(new Set(['KeyD', 'KeyS'])).right).toBe(true);
  });

  it('tracks key presses and releases', () => {
    const target = new EventTarget();
    const kb = new Keyboard();
    kb.attach(target);
    target.dispatchEvent(key('keydown', 'KeyX'));
    expect(kb.snapshot().fire).toBe(true);
    target.dispatchEvent(key('keyup', 'KeyX'));
    expect(kb.snapshot().fire).toBe(false);
  });

  it('blur releases held keys', () => {
    const target = new EventTarget();
    const kb = new Keyboard();
    kb.attach(target);
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    target.dispatchEvent(new Event('blur'));
    expect(kb.snapshot().right).toBe(false);
    kb.detach();
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    expect(kb.snapshot().right).toBe(false);
  });
});
