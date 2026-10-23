import { TILE } from './constants';
import { barrelBlast, type Blast } from './explosions';
import type { Unit } from './types';
import { damageUnit, knock } from './units';
import type { World } from './world';

/**
 * The Tesla arcs that leap off Elon Musk's laser: Broden's lightning (ElectricZap / ElectricZapLineElement). An arc runs
 * from where it starts to its mook in ZapDuration, strikes him for 4 (Broden: 3) with a shove, arcs on from there to
 * the nearest mook ahead within chainXRange (two thirds of it the next time), and fades over the zap's MaxLife.
 */
export const TESLA = {
  unitDamage: 4, knockX: 50, knockY: 25, // DamageObject(3, Plasma, dir*50, 25): ours 4
  unitY: 9, unitYRand: 7, // the end of an arc: his Y + 9 + Random.Range(0, 7)
  chainShrink: 0.66, chainY: 11, chainAhead: 4, // GetNearestEnemyUnit(chainXRange, 11) from the end + dir*4
};

/** One arc: it runs from start to end in zapTime and strikes there (PerformZap), then fades over the zap's life. */
export interface Zap {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  age: number;
  target: number | null; // the mook it strikes
  cell: { c: number; r: number } | null; // the block it strikes
  damage: number;
  chain: number; // chainCount: how many more mooks it may arc on to
  range: number; // chainXRange
  dir: -1 | 1; // chainDirection
  struck: boolean;
  seed: number; // its jagged shape, for the renderer
}

/** Map.GetNearestEnemyUnit: the nearest living enemy within xRange x yRange of (x, y) the way `dir` points (y to his middle). */
export function nearestEnemy(enemies: readonly Unit[], x: number, y: number, xRange: number, yRange: number, dir: number,
  skip: number | null = null): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const m of enemies) {
    if (m.dead || m.id === skip || m.invulnerable > 0) continue;
    const dx = m.x - x;
    const dy = m.y + TESLA.unitY - y; // from his middle
    if (Math.abs(dx) >= xRange || Math.abs(dy) >= yRange || (dir !== 0 && dx !== 0 && Math.sign(dx) !== dir)) continue;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

function makeZap(w: World, x0: number, y0: number, x1: number, y1: number, rest: Partial<Zap>): Zap {
  return {
    id: w.nextId++, x0, y0, x1, y1, age: 0, target: null, cell: null, damage: 0, chain: 0, range: 0, dir: 1, struck: false,
    seed: Math.floor(w.rng() * 1e6), ...rest,
  };
}

/** ElectricZap.Create: an arc from (x, y) to mook `m`, which may arc on `chain` more times within `range`. */
export function arcZap(w: World, x: number, y: number, m: Unit, chain: number, range: number, dir: -1 | 1): void {
  w.zaps.push(makeZap(w, x, y, m.x, m.y + TESLA.unitY + Math.floor(w.rng() * TESLA.unitYRand), {
    target: m.id, damage: TESLA.unitDamage, chain, range, dir,
  }));
}

/**
 * ElectricZapLineElement: each arc strikes once its head reaches the end (a mook takes 4 and a shove, a block its
 * damage), arcs on from there to the nearest mook ahead within chainXRange (two thirds of it the next time), and is
 * gone once its tail has caught up.
 */
export function stepZaps(w: World, t: number, blasts: Blast[]): void {
  const s = w.stats.tesla;
  for (const z of [...w.zaps]) {
    z.age += t;
    if (z.struck || z.age < s.zapTime) continue;
    z.struck = true;
    w.events.push({ type: 'zapHit', x: z.x1, y: z.y1, unit: z.target !== null }); // where it strikes: a blue burst
    if (z.target !== null) {
      const m = w.enemies.find((e) => e.id === z.target);
      if (m && !m.dead) {
        damageUnit(m, z.damage, false, { dir: z.dir });
        knock(m, z.dir * TESLA.knockX, TESLA.knockY);
        w.events.push({ type: 'hit', x: m.x, y: m.y, hitY: z.y1, xI: z.dir * TESLA.knockX, yI: TESLA.knockY });
      }
      if (z.chain > 0) {
        const next = nearestEnemy(w.enemies, z.x1 + z.dir * TESLA.chainAhead, z.y1, z.range, TESLA.chainY, z.dir, z.target);
        if (next) arcZap(w, z.x1, z.y1, next, z.chain - 1, Math.floor(z.range * TESLA.chainShrink), z.dir);
      }
    }
    if (z.cell) {
      const kind = w.map.damage(z.cell.c, z.cell.r, z.damage);
      if (kind) w.events.push({ type: 'block', x: z.cell.c * TILE, y: z.cell.r * TILE, kind, damage: z.damage });
      if (kind === 'barrel') blasts.push(barrelBlast(z.cell.c * TILE, z.cell.r * TILE, w.stats.barrelRange));
    }
  }
  w.zaps = w.zaps.filter((z) => z.age < s.zapTime + s.life);
}
