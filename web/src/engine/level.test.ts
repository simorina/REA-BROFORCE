import { describe, expect, it } from 'vitest';
import { parseLevel, type LevelData } from './level';
import { TEST_STATS } from './testStats';

const tiny: LevelData = { cols: 5, rows: 3, tiles: ['...CF', 'P.mc.', 'ddxss'] };

describe('parseLevel', () => {
  it('reads blocks bottom-up and places entities', () => {
    const lvl = parseLevel(tiny, TEST_STATS);
    expect(lvl.map.get(0, 0)?.kind).toBe('dirt');
    expect(lvl.map.get(2, 0)?.kind).toBe('barrel');
    expect(lvl.map.get(4, 0)?.kind).toBe('steel');
    expect(lvl.player).toEqual({ c: 0, r: 1 });
    expect(lvl.enemies).toEqual([{ c: 2, r: 1, kind: 'mook' }]);
    expect(lvl.cages).toEqual([{ c: 3, r: 1 }]);
    expect(lvl.checkpoints).toEqual([{ c: 3, r: 2 }]);
    expect(lvl.flag).toEqual({ c: 4, r: 2 });
  });

  it("reads the island's beach sand ('a') and temple bricks ('t')", () => {
    const lvl = parseLevel({ cols: 3, rows: 2, tiles: ['P.F', 'ats'] }, TEST_STATS);
    expect(lvl.map.get(0, 0)?.kind).toBe('sand');
    expect(lvl.map.get(1, 0)?.kind).toBe('temple');
  });

  it('rejects unknown tiles and ragged rows', () => {
    expect(() => parseLevel({ ...tiny, tiles: ['...CF', 'P.mQ.', 'ddxss'] }, TEST_STATS)).toThrow("unknown tile 'Q'");
    expect(() => parseLevel({ ...tiny, tiles: ['...CF', 'P.mc', 'ddxss'] }, TEST_STATS)).toThrow('row 1 has 4 columns');
    expect(() => parseLevel({ ...tiny, rows: 4 }, TEST_STATS)).toThrow('expected 4');
  });

  it('needs exactly one player start and one flag', () => {
    expect(() => parseLevel({ ...tiny, tiles: ['....F', '..mc.', 'ddxss'] }, TEST_STATS)).toThrow('no player start');
    expect(() => parseLevel({ ...tiny, tiles: ['.....', 'P.mc.', 'ddxss'] }, TEST_STATS)).toThrow('no flag');
    expect(() => parseLevel({ ...tiny, tiles: ['P...F', 'P.mc.', 'ddxss'] }, TEST_STATS)).toThrow('more than one P');
  });
});
