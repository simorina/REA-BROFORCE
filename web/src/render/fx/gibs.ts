import { TILE } from '../../engine/constants';
import { getColumn, getRow, type TileMap } from '../../engine/map';
import type { GibDef, ShrapnelDef } from '../fxdata';
import type { View } from './particles';

/** A flying body part cut from its unit's sheet: Shrapnel's physics, BloodyShrapnel's trail, Gib's sprite. */
export interface GibInstance {
  def: GibDef;
  sheet: string; // which unit sheet the piece is cut from
  flip: 1 | -1;
  x: number;
  y: number;
  xI: number;
  yI: number;
  r: number; // degrees
  rI: number;
  life: number;
  startLife: number;
  w: number;
  h: number;
  wI: number;
  hI: number;
  bloodyLeft: number;
  lastX: number;
  lastY: number;
  randomOnBounce: number;
  dead: boolean;
}

export interface GibHooks {
  bloodDots(x: number, y: number, radius: number, force: number, xI: number, yI: number): void;
  bloodBig(x: number, y: number, force: number, xI: number, yI: number): void;
}

const OFFSCREEN_BUFFER = 48; // Shrapnel.Update: dies when not SortOfFollow.IsItSortOfVisible(48, 48)

/** EffectsController.CreateGib + Gib.Launch + Shrapnel.Launch */
export function launchGib(def: GibDef, sheet: string, cx: number, cy: number, xForce: number, yForce: number,
  xI: number, yI: number, flip: 1 | -1, rng: () => number): GibInstance {
  const x = cx + def.pos[0] * flip;
  const y = cy + def.pos[1];
  const vx = ((def.pos[0] * flip) / 16) * xForce + xI;
  const vy = (def.pos[1] / 16) * yForce + yI;
  const life = (2.5 + (-0.5 + rng()) * def.randomLifeM) * def.lifeM;
  const gvx = vx * def.forceMultiplier;
  return {
    def, sheet, flip, x, y, xI: gvx, yI: vy * def.forceMultiplier, r: 0,
    rI: -(Math.sign(gvx) || 1) * (200 + rng() * 300) * def.rotationSpeedMultiplier,
    life, startLife: life, w: def.w, h: def.h, wI: -def.w / life, hI: -def.h / life,
    bloodyLeft: def.bloodyM, lastX: x, lastY: y, randomOnBounce: def.xI_randomOnBounce, dead: false,
  };
}

/** EffectsController.CreateShrapnel's Shrapnel.Launch: a bare piece of shrapnel at (x, y) with its own speed. */
export function launchShrapnel(def: ShrapnelDef, sheet: string, x: number, y: number, xI: number, yI: number,
  rng: () => number): GibInstance {
  const gib: GibDef = { ...def, pos: [0, 0], forceMultiplier: 1, hasBloodTrail: 0, bloodyM: 0, onlySmallBloodParticles: 0 };
  const life = (2.5 + (-0.5 + rng()) * def.randomLifeM) * def.lifeM;
  return {
    def: gib, sheet, flip: 1, x, y, xI, yI, r: 0, rI: -(Math.sign(xI) || 1) * (200 + rng() * 300) * def.rotationSpeedMultiplier,
    life, startLife: life, w: def.w, h: def.h, wI: -def.w / life, hI: -def.h / life, bloodyLeft: 0, lastX: x, lastY: y,
    randomOnBounce: def.xI_randomOnBounce, dead: false,
  };
}

/** Map.ConstrainToBlocks for a point of radius `size` moving by (xIT, yIT) this step. */
export function constrainToBlocks(map: TileMap, x: number, y: number, size: number, xIT: number, yIT: number):
  { xIT: number; yIT: number; bounceX: boolean; bounceY: boolean } {
  let bounceX = false;
  let bounceY = false;
  if (xIT === 0 && yIT === 0) return { xIT, yIT, bounceX, bounceY };
  const tx = xIT > 0 ? x + xIT + size : xIT < 0 ? x + xIT - size : x;
  const ty = yIT > 0 ? y + yIT + size : yIT < 0 ? y + yIT - size : y;
  const c = getColumn(x);
  const r = getRow(y);
  const c2 = getColumn(tx);
  const r2 = getRow(ty);
  if (r2 !== r && map.get(c, r2)) {
    yIT = yIT < 0 ? r2 * TILE + 8 + size - y : r2 * TILE - 8 - size - y;
    bounceY = true;
  }
  if (c2 !== c && map.get(c2, r)) {
    xIT = xIT < 0 ? c2 * TILE + 8 + size - x : c2 * TILE - 8 - size - x;
    bounceX = true;
  }
  if (!bounceX && !bounceY && c2 !== c && r2 !== r && map.get(c2, r2)) {
    yIT = yIT < 0 ? r2 * TILE + 8 + size - y : r2 * TILE - 8 - size - y;
    bounceY = true;
  }
  return { xIT, yIT, bounceX, bounceY };
}

/** Shrapnel.Update / RunMovement / Bounce and BloodyShrapnel.Update for one step. */
export function stepGib(g: GibInstance, t: number, map: TileMap, view: View, hooks: GibHooks, rng: () => number): void {
  if (g.dead) return;
  const d = g.def;
  t = Math.min(t, 0.133);
  g.r += g.rI * t;
  g.yI -= 500 * t * d.gravityM;
  if (d.shrink) {
    g.w += g.wI * t;
    g.h += g.hI * t;
  }
  if (d.drag > 0) {
    g.xI -= g.xI * t * d.drag;
    g.yI -= g.yI * t * d.drag;
  }
  const m = constrainToBlocks(map, g.x, g.y, d.size, g.xI * t, g.yI * t);
  if (m.bounceX || m.bounceY) bounce(g, m.bounceX, m.bounceY, rng);
  g.lastX = g.x;
  g.lastY = g.y;
  g.x += m.xIT;
  g.y += m.yIT;
  if (g.life > 0 && (Math.abs(g.x - view.x) > view.halfW + OFFSCREEN_BUFFER || Math.abs(g.y - view.y) > view.halfH + OFFSCREEN_BUFFER)) {
    g.life = -0.1;
  }
  g.life -= t;
  if (g.life <= 0 || g.w <= 0 || g.h <= 0) g.dead = true;
  // BloodyShrapnel: a trail of blood thinning out as bloodyM runs down
  if (!d.hasBloodTrail || g.bloodyLeft <= 0) return;
  g.bloodyLeft -= t * 1.4;
  const dx = g.x - g.lastX;
  const dy = g.y - g.lastY;
  const n = Math.trunc(Math.hypot(dx, dy) * 0.2 * g.bloodyLeft);
  for (let i = 0; i < n; i++) {
    const back = 1 - i / n;
    const x = g.x - dx * t * back;
    const y = g.y - dy * t * back;
    if (d.onlySmallBloodParticles || rng() > g.bloodyLeft - 0.5) hooks.bloodDots(x, y, d.size, 9, g.xI * 0.6, g.yI * 0.6);
    else hooks.bloodBig(x, y, 12, g.xI * 0.6, g.yI * 0.6);
  }
}

function bounce(g: GibInstance, bounceX: boolean, bounceY: boolean, rng: () => number): void {
  const d = g.def;
  if (bounceX) {
    g.xI *= -d.bounceM * 1.5;
    g.yI *= 0.8;
  }
  if (g.yI < -70 && g.randomOnBounce > 0) {
    g.xI += (rng() * 2 - 1) * g.randomOnBounce;
    g.randomOnBounce *= 0.66;
  }
  if (bounceY) {
    g.xI *= 0.8 * d.frictionM;
    g.yI *= -d.bounceM;
    g.life -= 0.1;
    g.rI *= 0.8;
  }
  if (d.lifeLossOnBounce) g.life -= g.startLife * d.lifeLossM;
  if (d.deathOnBounce) g.dead = true; // Shrapnel.Bounce: deathOnBounce
}
