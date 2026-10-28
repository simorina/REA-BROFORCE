import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadBroSetting, loadMusicSetting, saveBroSetting, saveMusicSetting } from './settings';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

afterEach(() => vi.unstubAllGlobals());

describe('the chosen bro', () => {
  it('is remembered', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadBroSetting('brolusconi')).toBe('brolusconi');
    saveBroSetting('putin');
    expect(loadBroSetting('brolusconi')).toBe('putin');
  });

  it('falls back when storage is unavailable', () => {
    const denied = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied });
    expect(() => saveBroSetting('putin')).not.toThrow();
    expect(loadBroSetting('brolusconi')).toBe('brolusconi');
  });
});

describe('the music switch', () => {
  it('is on until it is turned off, and is remembered', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadMusicSetting()).toBe(true);
    saveMusicSetting(false);
    expect(loadMusicSetting()).toBe(false);
    saveMusicSetting(true);
    expect(loadMusicSetting()).toBe(true);
  });
});
