import { TILE, UNIT_BOX_HEIGHT, UNIT_WIDTH } from './constants';
import { barrelBlast, type Blast } from './explosions';
import { getColumn, getRow, type TileMap } from './map';
import type { TeslaStats, Unit } from './types';
import { damageUnit, knock } from './units';
import type { World } from './world';

/**
 * Elon Musk's Tesla gun: Broden's lightning, souped up. FireWeapon from (X + dir*10, Y + 6.5): the shock at point blank
 * (Map.HitUnits, 3 within 20 x 10), then a bolt (ElectricZap) to the nearest mook ahead, else to the wall ahead, else
 * into the air. Ours reaches twice as far as Broden's (rangeM), hits for 4 (his 3) and every bolt arcs on to two more
 * mooks (his: the first of a press), further (60, then 40; his 45 and 30).
 */
export const TESLA = {
  rangeM: 2,
  ox: 10, oy: 6.5, // UseFire's FireWeapon(X + dir*10, Y + 6.5)
  shockX: 9, shockY: 4, shockW: 20, shockH: 10, shockDamage: 3, shockKnock: 25,
  boltX: -13, boltY: 0, // the zapper: x + dir*(3 + zapperXOffset -16), y + 12 + zapperYOffset -12
  seekBack: 15, seekExtra: 35, seekY: 10, // GetNearestEnemyUnit(lightningRange + 35, 10) from x - dir*15
  clear: 16, sightY: 8.5, // no wall in the way, but for the last 16
  unitDamage: 4, knockX: 50, knockY: 25, unitY: 8, unitYRand: 4,
  wallBack: 12, wallExtra: 12, wallRays: [8.5, 3.5, 12.5, 17.5], wallDamage: 8, wallDrop: 4, // the rays at a wall
  airBack: 4, airRand: 8, airY: 5, airYRand: 5,
  chain: 2, chainRange: 60, chainShrink: 0.66, chainY: 11, chainAhead: 4, chainUnitY: 9, chainUnitYRand: 7,
  quenchX: 32, quenchY: 12, quenchW: 32, quenchH: 12, // Map.HitProjectiles in front of him
};

/** One bolt: it runs from start to end in zapTime and strikes there (PerformZap), then fades over the zap's life. */
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

/** Physics.Raycast along x from (x, y) for `length`: where it first meets a block, or null. */
function rayX(map: TileMap, x: number, y: number, dir: number, length: number): { x: number; y: number } | null {
  for (let d = 0; d <= length; d += 2) {
    if (map.solidAt(x + dir * d, y)) return { x: x + dir * d, y };
  }
  return null;
}

function makeZap(w: World, x0: number, y0: number, x1: number, y1: number, rest: Partial<Zap>): Zap {
  return {
    id: w.nextId++, x0, y0, x1, y1, age: 0, target: null, cell: null, damage: 0, chain: 0, range: 0, dir: 1, struck: false,
    seed: Math.floor(w.rng() * 1e6), ...rest,
  };
}

/** Broden.FireWeapon: one zap of the Tesla gun. */
export function teslaZap(w: World, p: Unit, s: TeslaStats): void {
  const dir = p.facing;
  const x = p.x + dir * TESLA.ox;
  const y = p.y + TESLA.oy;
  // Map.HitUnits: the shock at point blank
  const cx = x + dir * TESLA.shockX;
  const cy = y + TESLA.shockY;
  for (const m of w.enemies) {
    if (m.dead || m.invulnerable > 0) continue;
    if (Math.abs(m.x - cx) - TESLA.shockW >= UNIT_WIDTH || Math.abs(m.y + UNIT_BOX_HEIGHT / 2 + 3 - cy) - TESLA.shockH >= UNIT_BOX_HEIGHT) continue;
    damageUnit(m, TESLA.shockDamage, false, { dir });
    knock(m, dir * TESLA.shockKnock, 0);
    w.events.push({ type: 'hit', x: m.x, y: m.y, hitY: cy, xI: dir * TESLA.shockKnock, yI: 0 });
  }
  const bx = x + dir * TESLA.boltX;
  const by = y + TESLA.boltY;
  const reach = s.range * TESLA.rangeM;
  const target = nearestEnemy(w.enemies, x - dir * TESLA.seekBack, y, reach + TESLA.seekExtra, TESLA.seekY, dir);
  if (target && (Math.abs(target.x - x) < TESLA.clear || !rayX(w.map, x, y + TESLA.sightY, dir, Math.abs(target.x - x) - TESLA.clear))) {
    w.zaps.push(makeZap(w, bx, by, target.x, target.y + TESLA.unitY + Math.floor(w.rng() * TESLA.unitYRand), {
      target: target.id, damage: TESLA.unitDamage, chain: TESLA.chain, range: TESLA.chainRange, dir,
    }));
    return;
  }
  let wall: { x: number; y: number } | null = null;
  for (const dy of TESLA.wallRays) {
    wall = rayX(w.map, x - dir * TESLA.wallBack, y + dy, dir, reach + TESLA.wallExtra);
    if (wall) break;
  }
  if (wall) {
    w.zaps.push(makeZap(w, bx, by, wall.x, wall.y - TESLA.wallDrop, { cell: { c: getColumn(wall.x), r: getRow(wall.y) }, damage: TESLA.wallDamage, dir }));
  } else {
    const ex = x + dir * (reach - TESLA.airBack + w.rng() * TESLA.airRand);
    w.zaps.push(makeZap(w, bx, by, ex, y + TESLA.airY + Math.floor(w.rng() * TESLA.airYRand), { dir }));
  }
  // Map.HitProjectiles: the enemy shots in front of him go
  const qx = x + dir * TESLA.quenchX;
  const qy = y + TESLA.quenchY;
  for (const pr of w.projectiles) {
    if (pr.team === 'enemy' && Math.abs(pr.x - qx) < TESLA.quenchW && Math.abs(pr.y - qy) < TESLA.quenchH) pr.dead = true;
  }
}

/**
 * TestVanDammeAnim.StartFiring loads Broden's maxElectricShocks; RunFiring lets one go every fireRate (the first at once)
 * until they are spent, held or not.
 */
export function stepTeslaGun(w: World, p: Unit, fire: boolean, t: number): void {
  const s = w.stats.tesla;
  if (fire && !p.wasFire) {
    p.burstLeft = s.shocks;
    p.burstCounter = s.fireRate;
  }
  p.wasFire = fire;
  if (p.burstLeft <= 0) return;
  p.burstCounter += t;
  if (p.burstCounter < s.fireRate) return;
  p.burstCounter -= s.fireRate;
  p.burstLeft--;
  teslaZap(w, p, s);
  p.gunFrame = 3;
  p.gunCounter = 0;
  w.events.push({ type: 'shot', weapon: 'tesla', x: p.x, y: p.y, facing: p.facing });
}

/**
 * ElectricZapLineElement: each bolt strikes once its head reaches the end (a mook takes 3 and a shove, a block 8),
 * arcs on from there to the nearest mook ahead within chainXRange (two thirds of it the next time), and is gone once
 * its tail has caught up.
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
        if (next) {
          w.zaps.push(makeZap(w, z.x1, z.y1, next.x, next.y + TESLA.chainUnitY + Math.floor(w.rng() * TESLA.chainUnitYRand), {
            target: next.id, damage: TESLA.unitDamage, chain: z.chain - 1, range: Math.floor(z.range * TESLA.chainShrink), dir: z.dir,
          }));
        }
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
