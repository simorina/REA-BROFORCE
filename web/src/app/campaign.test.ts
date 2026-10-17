import { afterEach, describe, expect, it, vi } from 'vitest';
import { MISSIONS } from '../levels';
import {
  HELI_FLIGHT, HELI_START, afterMission, campaignComplete, currentMission, flightStart, heliAt, loadProgress, saveProgress,
} from './campaign';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

afterEach(() => vi.unstubAllGlobals());

describe('the campaign', () => {
  it('starts at the first mission and remembers how far it got', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(loadProgress()).toBe(0);
    expect(currentMission(0)).toBe(0);
    saveProgress(2);
    expect(loadProgress()).toBe(2);
    expect(currentMission(2)).toBe(2);
  });

  it('a win on the mission in play opens the next one; a loss leaves it to retry', () => {
    expect(afterMission(0, 0, 'won')).toBe(1);
    expect(afterMission(1, 1, 'lost')).toBe(1);
    expect(afterMission(1, 1, 'won')).toBe(2);
  });

  it('replaying a mission already done does not move the campaign', () => {
    expect(afterMission(2, 0, 'won')).toBe(2);
    expect(afterMission(2, 0, 'lost')).toBe(2);
  });

  it("is complete once the island falls, and the island stays the mission to replay", () => {
    const last = MISSIONS.length - 1;
    expect(campaignComplete(last)).toBe(false);
    const done = afterMission(last, last, 'won');
    expect(done).toBe(MISSIONS.length);
    expect(campaignComplete(done)).toBe(true);
    expect(currentMission(done)).toBe(last);
  });

  it('ignores a broken save, and falls back when storage is unavailable', () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    s.setItem('brolusconi.campaign', 'banana');
    expect(loadProgress()).toBe(0);
    s.setItem('brolusconi.campaign', '99');
    expect(loadProgress()).toBe(MISSIONS.length);
    s.setItem('brolusconi.campaign', '-3');
    expect(loadProgress()).toBe(0);
    const denied = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied });
    expect(() => saveProgress(1)).not.toThrow();
    expect(loadProgress()).toBe(0);
  });
});

describe("the helicopter on the world map", () => {
  const from = { x: 0.2, y: 0.4 };
  const to = { x: 0.6, y: 0.6 };

  it('flies from one mission to the next, above the straight line, and lands there', () => {
    expect(heliAt(from, to, 0)).toMatchObject({ x: 0.2, y: 0.4, landed: false });
    const mid = heliAt(from, to, HELI_FLIGHT / 2);
    expect(mid.x).toBeCloseTo(0.4);
    expect(mid.y).toBeLessThan(0.5); // up in an arc (y grows downwards)
    expect(heliAt(from, to, HELI_FLIGHT)).toEqual({ x: 0.6, y: 0.6, facing: 1, landed: true });
    expect(heliAt(from, to, HELI_FLIGHT * 3)).toEqual({ x: 0.6, y: 0.6, facing: 1, landed: true });
  });

  it('faces the way it flies', () => {
    expect(heliAt(to, from, 0.1).facing).toBe(-1);
  });

  it('comes in from the sea for the first mission, then from the mission before', () => {
    expect(flightStart(0)).toEqual(HELI_START);
    expect(flightStart(1)).toEqual(MISSIONS[0].map);
    expect(flightStart(2)).toEqual(MISSIONS[1].map);
  });
});
