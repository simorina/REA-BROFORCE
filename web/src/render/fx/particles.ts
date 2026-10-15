import { getColumn, getRow, type TileMap } from '../../engine/map';
import type { Block } from '../../engine/types';
import type { EmitterDef, RGBA } from '../fxdata';
import { raycastBlocks } from './raycast';

/** A legacy Unity particle: position, velocity, energy (remaining life) and size, all in world units. */
export interface Particle {
  def: EmitterDef;
  x: number;
  y: number;
  xI: number;
  yI: number;
  energy: number;
  startEnergy: number;
  size: number;
  color: RGBA;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** What a particle can set off: blood decals on blocks, splashes when it dies, trails while it flies. */
export interface ParticleHooks {
  decal(block: Block, c: number, r: number, side: Side): void;
  splash(size: 'big' | 'small' | 'tiny', x: number, y: number, xI: number, yI: number): void;
  bloodTrail(x: number, y: number, xI: number, yI: number, scaleM: number): void;
  dustTrail(x: number, y: number, force: number, xI: number, yI: number): void;
}

export interface View {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

export const MAX_PARTICLES = 1500;
const OFFSCREEN_BUFFER = 96; // ParticleCollisionAnimator: kills particles not SortOfFollow.IsItSortOfVisible(96, 96)

const sideOf = (nx: number, ny: number): Side => (ny >= 0.5 ? 'top' : ny <= -0.5 ? 'bottom' : nx >= 0.5 ? 'right' : 'left');

/**
 * ParticleCollisionAnimator.Update for every particle of every emitter (no wind, quicksand or timeslicing),
 * plus Unity's ParticleAnimator for emitters that use it.
 */
export class ParticleSystem {
  readonly list: Particle[] = [];
  private readonly lastTrail = new Map<EmitterDef, number>();
  private frame = 0;

  constructor(private readonly hooks: ParticleHooks, private readonly rng: () => number = Math.random) {}

  emit(def: EmitterDef, x: number, y: number, xI: number, yI: number, size: number, energy: number, color: RGBA): void {
    if (energy <= 0 || size <= 0) return;
    this.list.push({ def, x, y, xI, yI, energy, startEnergy: energy, size, color });
    if (this.list.length > MAX_PARTICLES) this.list.splice(0, this.list.length - MAX_PARTICLES);
  }

  step(t: number, map: TileMap, view: View, time: number): void {
    if (t <= 0) return;
    this.frame++;
    const bled = new Set<EmitterDef>();
    for (let j = 0; j < this.list.length; j++) {
      const p = this.list[j];
      if (p.energy <= 0 || p.size <= 0) continue;
      if ((j + this.frame) % 6 === 0 && (Math.abs(p.x - view.x) > view.halfW + OFFSCREEN_BUFFER
        || Math.abs(p.y - view.y) > view.halfH + OFFSCREEN_BUFFER)) {
        p.energy = 0;
        continue;
      }
      if (p.def.collision) this.collisionStep(p, t, map, time, bled);
      else this.animatorStep(p, t, map);
    }
    for (const def of bled) this.lastTrail.set(def, time);
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].energy <= 0 || this.list[i].size <= 0.01) this.list.splice(i, 1);
    }
  }

  private collisionStep(p: Particle, t: number, map: TileMap, time: number, bled: Set<EmitterDef>): void {
    const a = p.def.collision!;
    const doubleT = t * 2;
    const damp = 1 - t * a.dampeningM;
    if (a.randomMotion) {
      p.xI = (p.xI + a.randomMotionM * (1 - this.rng() * 2)) * damp;
      p.yI = (p.yI + a.randomMotionM * (1 - this.rng() * 2)) * damp - a.gravity * t;
    } else {
      p.xI *= damp;
      p.yI = p.yI * damp - a.gravity * t;
    }
    p.energy -= t * a.particleEnergyLossM;
    p.size += p.size * t * a.growSizeM;
    const trailFactor = (time - (this.lastTrail.get(p.def) ?? -Infinity)) / a.bloodTrailFrequency;
    if (!a.collidesWithGround) {
      this.run(p, t, trailFactor, bled);
      return;
    }
    const speed = Math.hypot(p.xI, p.yI);
    const hit = raycastBlocks(map, p.x, p.y, p.xI, p.yI, speed * doubleT + 16); // WillHitBlock
    if (!hit) {
      this.run(p, t, trailFactor, bled);
      return;
    }
    const side = sideOf(hit.nx, hit.ny);
    let dx = p.xI * t;
    let dy = p.yI * t;
    const half = p.size / 2;
    let constrained = false; // ConstrainToColliders: would this step pass the surface?
    if (side === 'right' && p.x + dx - half < hit.x) {
      constrained = true;
      dx = hit.x - p.x + half;
    } else if (side === 'left' && p.x + dx + half > hit.x) {
      constrained = true;
      dx = hit.x - p.x - half;
    }
    if (side === 'top' && p.y + dy - half < hit.y) {
      constrained = true;
      dy = hit.y - p.y + half;
    } else if (side === 'bottom' && p.y + dy + half > hit.y) {
      constrained = true;
      dy = hit.y - p.y - half;
    }
    if (!constrained) {
      this.run(p, t, trailFactor, bled);
      return;
    }
    const block = map.get(hit.c, hit.r);
    if (a.leavesDecals && p.energy > a.minEnergyDecal && block) this.hooks.decal(block, hit.c, hit.r, side);
    p.energy -= a.collisionEnergyLoss > 0 ? a.collisionEnergyLoss : doubleT;
    if (p.energy > 0) {
      p.x += dx;
      p.y += dy;
      // Vector3.Reflect, then collisionSpeedM
      const dot = p.xI * hit.nx + p.yI * hit.ny;
      p.xI = (p.xI - 2 * dot * hit.nx) * a.collisionSpeedM;
      p.yI = (p.yI - 2 * dot * hit.ny) * a.collisionSpeedM;
    } else if (a.createSplashParticles && side === 'top') {
      if (p.size > 3) this.hooks.splash('small', p.x, hit.y, p.xI, p.yI);
      else if (p.size >= 1.8) this.hooks.splash('tiny', p.x, hit.y, p.xI, p.yI);
    }
    if (a.createSplashParticlesAndDie && side === 'top') {
      if (p.size > 3) this.hooks.splash('big', p.x, hit.y, p.xI, p.yI);
      else if (p.size > 2) this.hooks.splash('small', p.x, hit.y, p.xI, p.yI);
      else if (p.size >= 1.8) this.hooks.splash('tiny', p.x, hit.y, p.xI, p.yI);
      p.energy = 0;
    }
  }

  /** ParticleCollisionAnimator.RunParticle */
  private run(p: Particle, t: number, trailFactor: number, bled: Set<EmitterDef>): void {
    if (p.size <= 0.01 || p.energy <= 0) return;
    const a = p.def.collision!;
    p.x += p.xI * t;
    p.y += p.yI * t;
    const quarter = p.startEnergy * 0.25;
    if (a.fadeColor) {
      if (a.linearFade) p.color = [p.color[0], p.color[1], p.color[2], p.energy / p.startEnergy];
      else if (p.energy < quarter) p.color = [p.color[0], p.color[1], p.color[2], p.energy / quarter];
    }
    if (a.fadeSize && p.energy < quarter) {
      p.size -= p.startEnergy * 4 * t;
      if (p.size < 0.3) p.energy = 0;
    }
    if (!a.trailBlood && !(a.trailDust && p.energy > 2)) return;
    const n = Math.min(Math.trunc(trailFactor * (p.energy * 0.4 - 1)), 3);
    if (n <= 0) return;
    bled.add(p.def);
    for (let i = 0; i < n; i++) {
      const back = 1 - i / n;
      const x = p.x - p.xI * back * t;
      const y = p.y - p.yI * back * t;
      if (a.trailBlood) this.hooks.bloodTrail(x, y, p.xI * 0.6, p.yI * 0.6, this.rng() < p.startEnergy * 0.3 ? 1.3 : 1);
      else this.hooks.dustTrail(x, y, 6 * p.energy, p.xI * 0.6, p.yI * 0.6);
    }
  }

  /** Unity's ParticleAnimator (force, damping) with a WorldParticleCollider bounce. */
  private animatorStep(p: Particle, t: number, map: TileMap): void {
    const an = p.def.animator;
    if (an) {
      p.xI += an.force[0] * t;
      p.yI += an.force[1] * t;
      if (an.damping < 1) {
        const d = Math.pow(an.damping, t);
        p.xI *= d;
        p.yI *= d;
      }
      p.size += an.sizeGrow * t;
    }
    p.energy -= t;
    const nx = p.x + p.xI * t;
    const ny = p.y + p.yI * t;
    const bounce = p.def.worldCollider?.bounceFactor ?? 0.5;
    if (map.blockAt(nx, p.y)) p.xI = -p.xI * bounce;
    else p.x = nx;
    if (map.blockAt(p.x, ny)) p.yI = -p.yI * bounce;
    else p.y = ny;
  }
}

/** The UV-animation frame Unity's ParticleRenderer shows: the tiles cycled over the particle's life. */
export function particleFrame(p: Particle): number {
  const tiles = p.def.tiles[0] * p.def.tiles[1];
  if (tiles <= 1) return 0;
  const age = 1 - Math.max(0, p.energy) / p.startEnergy;
  return Math.floor(age * p.def.cycles * tiles) % tiles;
}

/** Whether a point is inside a block (for tests and stain checks). */
export const insideBlock = (map: TileMap, x: number, y: number): boolean => map.get(getColumn(x), getRow(y)) !== null;
