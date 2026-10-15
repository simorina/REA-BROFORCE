import { describe, expect, it } from 'vitest';
import { TileMap, cellBottom, cellLeft, getColumn, getRow, makeBlock } from './map';
import { TEST_STATS } from './testStats';

function filled(cols: number, rows: number): TileMap {
  const m = new TileMap(cols, rows);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) m.set(c, r, makeBlock('dirt', TEST_STATS));
  return m;
}

describe('grid conversion (Map.GetCollumn / Map.GetRow)', () => {
  it('centres cell c on x = c * 16', () => {
    expect(getColumn(0)).toBe(0);
    expect(getColumn(7.9)).toBe(0);
    expect(getColumn(8)).toBe(1);
    expect(getColumn(-8)).toBe(0);
    expect(getRow(23.9)).toBe(1);
    expect(getRow(24)).toBe(2);
    expect(cellLeft(1)).toBe(8);
    expect(cellBottom(2)).toBe(24);
  });
});

describe('TileMap', () => {
  it('stores blocks and rejects writes outside the grid', () => {
    const m = new TileMap(4, 3);
    m.set(1, 2, makeBlock('brick', TEST_STATS));
    expect(m.get(1, 2)).toEqual({ kind: 'brick', health: 5 });
    expect(() => m.set(4, 0, null)).toThrow(RangeError);
  });

  it('treats the side edges as walls and above/below as open air', () => {
    const m = new TileMap(4, 3);
    expect(m.isSolid(-1, 1)).toBe(true);
    expect(m.isSolid(4, 1)).toBe(true);
    expect(m.isSolid(1, -1)).toBe(false);
    expect(m.isSolid(1, 3)).toBe(false);
  });

  it('blockAt ignores the side walls (projectiles fly in from outside)', () => {
    const m = new TileMap(4, 3);
    expect(m.blockAt(-50, 10)).toBeNull();
  });

  it('destroys a block when its health reaches zero and reports the kind', () => {
    const m = new TileMap(2, 2);
    m.set(0, 0, makeBlock('dirt', TEST_STATS));
    expect(m.damage(0, 0, 4)).toBeNull();
    expect(m.damage(0, 0, 1)).toBe('dirt');
    expect(m.get(0, 0)).toBeNull();
  });

  it('steel survives heavy damage', () => {
    const m = new TileMap(1, 1);
    m.set(0, 0, makeBlock('steel', TEST_STATS));
    expect(m.damage(0, 0, 1000)).toBeNull();
  });

  it('finds blocks whose box touches a circle', () => {
    const m = filled(10, 10);
    expect(m.cellsInCircle(80, 80, 14)).toHaveLength(9); // cell (5,5) and its 8 neighbours
    expect(m.cellsInCircle(80, 80, 7)).toHaveLength(1);
  });

  it('boxHitsSolid treats the right and top edges as exclusive', () => {
    const m = new TileMap(5, 5);
    m.set(2, 0, makeBlock('dirt', TEST_STATS)); // spans x 24..40, y -8..8
    expect(m.boxHitsSolid(12, 8, 24, 23)).toBe(false);
    expect(m.boxHitsSolid(12, 7, 25, 23)).toBe(true);
  });

  it('a destroyed block with a replacement turns into it (Block.replaceOnCollapse)', () => {
    const m = new TileMap(1, 1);
    const dirt = makeBlock('dirt', TEST_STATS);
    dirt.replacement = makeBlock('steel', TEST_STATS);
    m.set(0, 0, dirt);
    expect(m.damage(0, 0, 10)).toBe('dirt');
    expect(m.get(0, 0)?.kind).toBe('steel');
  });

  it('rayBlocked stops short and only counts real blocks', () => {
    const m = new TileMap(10, 3);
    m.set(5, 1, makeBlock('dirt', TEST_STATS)); // x 72..88, y 8..24
    expect(m.rayBlocked(0, 16, 150, 16)).toBe(true);
    expect(m.rayBlocked(0, 30, 150, 30)).toBe(false);
    expect(m.rayBlocked(0, 16, 76, 16, 6)).toBe(false); // ends 6 short of the block
    expect(m.rayBlocked(-50, 16, -10, 16)).toBe(false); // outside the map is open
  });
});

