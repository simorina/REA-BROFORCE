import { HALF_TILE, TILE } from './constants';
import type { Block, BlockKind, GameStats } from './types';

const EPS = 0.001;

// Map.GetCollumn / Map.GetRow: (int)((v + 8) * 0.0625). Math.floor matches for v >= -8.
export const getColumn = (x: number): number => Math.floor((x + HALF_TILE) / TILE);
export const getRow = (y: number): number => Math.floor((y + HALF_TILE) / TILE);
export const cellLeft = (c: number): number => c * TILE - HALF_TILE;
export const cellBottom = (r: number): number => r * TILE - HALF_TILE;

export function makeBlock(kind: BlockKind, stats: GameStats): Block {
  return { kind, health: stats.blocks[kind].health };
}

export class TileMap {
  private readonly cells: (Block | null)[];

  constructor(readonly cols: number, readonly rows: number) {
    this.cells = new Array<Block | null>(cols * rows).fill(null);
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  get(c: number, r: number): Block | null {
    return this.inBounds(c, r) ? this.cells[r * this.cols + c] : null;
  }

  set(c: number, r: number, block: Block | null): void {
    if (!this.inBounds(c, r)) throw new RangeError(`cell ${c},${r} is outside ${this.cols}x${this.rows}`);
    this.cells[r * this.cols + c] = block;
  }

  /** For units: the side edges are walls; above the top and below the bottom is open air. */
  isSolid(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols) return true;
    return this.get(c, r) !== null;
  }

  solidAt(x: number, y: number): boolean {
    return this.isSolid(getColumn(x), getRow(y));
  }

  /** For projectiles: only real blocks count, so airstrike bombs can fly in from outside the map. */
  blockAt(x: number, y: number): Block | null {
    return this.get(getColumn(x), getRow(y));
  }

  /** True if any solid cell overlaps the box; the right and top edges are exclusive. */
  boxHitsSolid(left: number, bottom: number, right: number, top: number): boolean {
    for (let c = getColumn(left); c <= getColumn(right - EPS); c++) {
      for (let r = getRow(bottom); r <= getRow(top - EPS); r++) {
        if (this.isSolid(c, r)) return true;
      }
    }
    return false;
  }

  /** Physics.Raycast against the ground layer: true if a block lies on the segment, which stops `shorten` early. */
  rayBlocked(x0: number, y0: number, x1: number, y1: number, shorten = 0): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) - shorten;
    if (len <= 0) return false;
    const steps = Math.ceil(len / 2);
    for (let i = 0; i <= steps; i++) {
      const k = (len * i) / steps / (len + shorten);
      if (this.blockAt(x0 + dx * k, y0 + dy * k)) return true;
    }
    return false;
  }

  /** Applies damage; returns the kind if the block was destroyed (and replaced, if it has a replacement). */
  damage(c: number, r: number, amount: number): BlockKind | null {
    const block = this.get(c, r);
    if (!block) return null;
    block.health -= amount;
    if (block.health > 0) return null;
    this.cells[r * this.cols + c] = block.replacement ?? null;
    return block.kind;
  }

  /** Blocks whose 16x16 box intersects the circle (MapController.DamageGround's OverlapSphere). */
  cellsInCircle(x: number, y: number, radius: number): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let c = getColumn(x - radius); c <= getColumn(x + radius); c++) {
      for (let r = getRow(y - radius); r <= getRow(y + radius); r++) {
        if (!this.get(c, r)) continue;
        const nx = Math.min(Math.max(x, cellLeft(c)), cellLeft(c) + TILE);
        const ny = Math.min(Math.max(y, cellBottom(r)), cellBottom(r) + TILE);
        if ((nx - x) ** 2 + (ny - y) ** 2 < radius * radius) out.push([c, r]);
      }
    }
    return out;
  }
}
