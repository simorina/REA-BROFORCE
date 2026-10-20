import { BARREL_Y_OFFSET, MINE, UNIT_BOX_HEIGHT, UNIT_HEIGHT } from '../../engine/constants';
import type { Blast } from '../../engine/explosions';
import type { TileMap } from '../../engine/map';
import type { Block, Unit, UnitKind } from '../../engine/types';
import type { GameEvent } from '../../engine/world';
import type { BlastFx, EffectsData, EmitterDef, FlameDef, PuffDef, PuffKey, RGBA, ShrapnelDef } from '../fxdata';
import { launchGib, launchShrapnel, stepGib, type GibHooks, type GibInstance } from './gibs';
import { ParticleSystem, type ParticleHooks, type Side, type View } from './particles';
import { makePuff, stepPuff, type PuffInstance } from './puffs';
import { ShurikenEffect, type ShurikenData, type ShurikenKey } from './shuriken';

/** A running ExplosionRangePop: hidden for delayBeforeAppear, then shown for delayBeforeDisappear. */
export interface RangePop {
  x: number;
  y: number;
  col: number; // the texture column: (range - 24) / 8
  appear: number;
  show: number;
}

const WHITE: RGBA = [1, 1, 1, 1];
const BLUE_SPARK: RGBA = [0.45, 0.85, 1, 1]; // NoisyCricket's SparkShrapnel Blue
const ALARM_RED: RGBA = [1, 0.15, 0.1, 1];
const RUN_FRAME_RATE = 0.025; // TestVanDammeAnim.runningFrameRate on the bro and mook prefabs

/** A running FlickerFader: steps through its frames, drifting with drag, after an optional delay. */
export interface FlameInstance {
  def: FlameDef;
  x: number;
  y: number;
  xI: number;
  yI: number;
  delay: number;
  counter: number;
  index: number;
  dead: boolean;
}

/** FlickerFader.Update */
export function stepFlame(f: FlameInstance, dt: number): void {
  const t = Math.min(dt, 0.033);
  if (f.delay > 0) {
    f.delay -= t;
    return;
  }
  f.x += f.xI * t;
  f.y += f.yI * t;
  f.xI *= 1 - t * 15;
  f.yI *= 1 - t * 15;
  f.counter += t;
  if (f.counter > f.def.frameRate) {
    f.counter -= f.def.frameRate;
    f.index++;
    if (f.index >= f.def.frames) f.dead = true;
  }
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const lerpColor = (a: RGBA, b: RGBA, k: number): RGBA => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];

/** A port of the EffectsController / EffectsHolderTheme calls the game makes, fed by the world's events. */
export class Effects {
  readonly particles: ParticleSystem;
  readonly puffs: PuffInstance[] = [];
  readonly gibs: GibInstance[] = [];
  readonly flames: FlameInstance[] = [];
  readonly shuriken: ShurikenEffect[] = []; // shader explosions and fire trails
  readonly rangePops: RangePop[] = [];
  private readonly trails: Array<{ gib: GibInstance; trail: ShurikenEffect }> = [];
  readonly decals = new WeakMap<Block, Set<Side>>();
  private readonly tracked = new WeakMap<Unit, { onGround: boolean; runFrame: number }>();
  private readonly starCounter = new WeakMap<Unit, number>();
  private starIndex = 0;
  private map: TileMap | null = null;
  private readonly gibHooks: GibHooks;

  constructor(readonly data: EffectsData, private readonly rng: () => number = Math.random,
    private readonly shurikenData: ShurikenData | null = null) {
    const hooks: ParticleHooks = {
      decal: (block, c, r, side) => this.bloody(block, c, r, side),
      splash: (size, x, y, xI, yI) => this.bloodSplash(size, x, y, xI, yI),
      bloodTrail: (x, y, xI, yI, scaleM) => this.bloodDots(x, y, 1, 0, 0, 3, xI, yI, scaleM),
      dustTrail: (x, y, force, xI, yI) => this.dustParticles(this.data.emitters.dirtDots, x, y, 1, 0, force, xI, yI),
    };
    this.particles = new ParticleSystem(hooks, rng);
    this.gibHooks = {
      bloodDots: (x, y, radius, force, xI, yI) => this.bloodDots(x, y, 1, radius, radius, force, xI, yI, 1),
      bloodBig: (x, y, force, xI, yI) => this.bloodBig(x, y, 1, 0, 0, force, xI, yI),
    };
  }

  private insideUnitCircle(): [number, number] {
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng());
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  private size(def: EmitterDef, k = this.rng()): number {
    return lerp(def.size[0], def.size[1], k);
  }

  private energy(def: EmitterDef, k = this.rng()): number {
    return lerp(def.energy[0], def.energy[1], k);
  }

  /** EffectsController.CreateDustParticles / CreateParticles (one colour, or a random dirt colour). */
  dustParticles(def: EmitterDef, x: number, y: number, count: number, offsetRadius: number, force: number, xI: number,
    yI: number, color?: RGBA): void {
    for (let i = 0; i < count; i++) {
      const [ux, uy] = this.insideUnitCircle();
      const c = color ?? lerpColor(this.data.colors.dirt[0], this.data.colors.dirt[1], this.rng());
      this.particles.emit(def, x + offsetRadius * ux, y + offsetRadius * uy, xI + force * ux, yI + force * uy,
        this.size(def), this.energy(def), c);
    }
  }

  /** CreateParticles(emitter, ..., color1, color2, ...): one random value picks both size and energy. */
  private particles2(def: EmitterDef, x: number, y: number, count: number, offsetRadius: number, force: number,
    xI: number, yI: number, c1: RGBA, c2: RGBA): void {
    for (let i = 0; i < count; i++) {
      const [ux, uy] = this.insideUnitCircle();
      const k = this.rng();
      this.particles.emit(def, x + offsetRadius * ux, y + offsetRadius * uy, xI + force * ux, yI + force * uy,
        this.size(def, k), this.energy(def, k), lerpColor(c1, c2, this.rng()));
    }
  }

  /** EffectsController.CreateDirtParticles */
  dirtParticles(x: number, y: number, count: number, offsetRadius: number, force: number, xI: number, yI: number): void {
    const e = this.data.emitters;
    this.dustParticles(e.dirtDots, x, y, Math.trunc(count / 2), offsetRadius, force * 1.4, xI, yI);
    const third = Math.trunc(count / 3);
    this.dustParticles(e.dirtSmall1, x, y, third, offsetRadius, force, xI, yI, WHITE);
    this.dustParticles(e.dirtSmall2, x, y, third, offsetRadius, force, xI, yI, WHITE);
    this.dustParticles(e.dirtSmall3, x, y, third, offsetRadius, force * 1.1, xI, yI, WHITE);
  }

  /** EffectsController.CreateDirtWhiteParticles: blocks with their own particle colours (Desert Earth) */
  dirtWhiteParticles(x: number, y: number, count: number, offsetRadius: number, force: number, xI: number, yI: number,
    c1: RGBA, c2: RGBA): void {
    const e = this.data.emitters;
    this.particles2(e.dirtDots, x, y, Math.trunc(count / 2), offsetRadius, force * 1.4, xI, yI, c1, c2);
    this.particles2(e.dirtSmallWhite, x, y, Math.trunc((count * 2) / 3), offsetRadius, force, xI, yI, c1, c2);
    this.particles2(e.dirtSmallerWhite, x, y, Math.trunc(count / 3), offsetRadius, force * 1.1, xI, yI, c1, c2);
  }

  /** EffectsController.CreateBloodParticles: a third big drops, half small, half dots */
  bloodParticles(x: number, y: number, count: number, offX: number, offY: number, force: number, xI: number, yI: number): void {
    this.bloodBig(x, y, Math.trunc(count / 3), offX * 0.1, offY * 0.1, force, xI, yI);
    this.bloodSmall(x, y, Math.trunc(count / 2) + 1, offX * 0.1, offY * 0.1, force, xI, yI);
    this.bloodDots(x, y, Math.trunc(count / 2) + 1, offX * 0.1, offY * 0.1, force, xI, yI, 1);
  }

  bloodBig(x: number, y: number, count: number, offX: number, offY: number, force: number, xI: number, yI: number): void {
    const def = this.data.emitters.bloodBig;
    for (let i = 0; i < count; i++) {
      const a = -1 + this.rng() * 2;
      const b = -1 + this.rng() * 2;
      const shade = 0.8 + this.rng() * 0.2;
      this.particles.emit(def, x + offX * a, y + offY * b, xI + force * a, yI + force * b, this.size(def), this.energy(def),
        [shade, shade, shade, shade]);
    }
  }

  /** CreateBloodParticlesSmall: drops come in pairs, the second nudged towards the first */
  bloodSmall(x: number, y: number, count: number, offX: number, offY: number, force: number, xI: number, yI: number): void {
    const def = this.data.emitters.bloodSmall;
    const step = 2 / force;
    let a = 0;
    let b = 0;
    let paired = false;
    for (let i = 0; i < count; i++) {
      if (!paired || this.rng() > 0.6) {
        a = -1 + this.rng() * 2;
        b = -1 + this.rng() * 2;
        paired = true;
      } else {
        paired = false; // both branches of the C# subtract here
        a -= step;
        b -= step;
      }
      const shade = 0.8 + this.rng() * 0.2;
      this.particles.emit(def, x + offX * a, y + offY * b, xI + force * a, yI + force * b, this.size(def), this.energy(def),
        [shade, shade, shade, shade]);
    }
  }

  /** CreateBloodParticlesDots */
  bloodDots(x: number, y: number, count: number, offX: number, offY: number, force: number, xI: number, yI: number,
    scaleM: number): void {
    const def = this.data.emitters.bloodDots;
    const step = 2 / force;
    let a = 0;
    let b = 0;
    let paired = false;
    if (this.rng() > 0.5) count++;
    for (let i = 0; i < count; i++) {
      if (!paired || this.rng() > 0.6) {
        a = -1 + this.rng() * 2;
        b = -1 + this.rng() * 2;
        paired = true;
      } else {
        paired = false;
        a += a > 0 ? -step : step;
        b += b > 0 ? -step : step;
      }
      this.particles.emit(def, x + offX * a, y + offY * b, xI + force * a, yI + force * b,
        lerp(def.size[0] * scaleM, def.size[1] * scaleM, this.rng()), this.energy(def), [1, 1, 1, 0.7 + this.rng() * 0.4]);
    }
  }

  /** EffectsController.CreateSparkShower: yellow to red sparks, part showering and part floating */
  sparkShower(x: number, y: number, count: number, offsetRadius: number, force: number, xI: number, yI: number,
    redM: number, floatM: number, tint?: RGBA): void {
    const e = this.data.emitters;
    const emit = (def: EmitterDef, n: number) => {
      for (let i = 0; i < n; i++) {
        const [ux, uy] = this.insideUnitCircle();
        const color = tint ?? lerpColor([1, 1, 0.3, 1], [1, 0, 0, 1], (1 - this.rng()) * redM);
        this.particles.emit(def, x + offsetRadius * ux, y + offsetRadius * uy, xI + force * ux, yI + force * uy,
          this.size(def), this.energy(def), color);
      }
    };
    emit(e.sparkShower, Math.trunc(count * (1 - floatM)));
    emit(e.sparkFloat, Math.trunc(count * floatM));
  }

  puff(key: PuffKey, x: number, y: number, flip: 1 | -1 = 1, xI = 0, yI = 0, color: RGBA = WHITE, delay = 0): void {
    this.puffs.push(makePuff(this.data.puffs[key], x, y, flip, xI, yI, color, delay));
  }

  private pick<T>(options: readonly T[]): T {
    return options[Math.min(options.length - 1, Math.floor(this.rng() * options.length))];
  }

  /** CreateBloodGushEffect(..., dots: true, slimes: false): a gush, a spurt and a few dots */
  bloodGush(x: number, y: number, xI: number, yI: number): void {
    const flip = xI >= 0 ? 1 : -1;
    this.puff(this.pick(['bloodGush1', 'bloodGush2', 'bloodGush3'] as const), x, y, flip, 0, 0, this.data.bloodColor);
    this.puff(this.pick(['bloodSpurt1', 'bloodSpurt2', 'bloodSpurt3'] as const), x, y, flip, 0, 0, this.data.bloodColor);
    this.bloodDots(x, y, 3 + Math.floor(this.rng() * 3), 4, 5, 90, -xI * 0.5, yI + 40, 1);
  }

  /** CreateBloodSplashEffect / CreateBloodSmallSplashEffect / CreateBloodTinySplashEffect */
  private bloodSplash(size: 'big' | 'small' | 'tiny', x: number, y: number, xI: number, _yI: number): void {
    const keys = size === 'big' ? (['bloodSplash1', 'bloodSplash2'] as const)
      : size === 'small' ? (['bloodSmallSplash1', 'bloodSmallSplash2'] as const)
        : (['bloodTinySplash1', 'bloodTinySplash2'] as const);
    this.puff(this.pick(keys), x, y, xI >= 0 ? 1 : -1, 0, 0, this.data.bloodColor);
  }

  /** Block.CreateDecal: a face goes bloody unless another block covers it (Block.CanBloody). */
  private bloody(block: Block, c: number, r: number, side: Side): void {
    const map = this.map;
    if (!map) return;
    const [dc, dr] = side === 'top' ? [0, 1] : side === 'bottom' ? [0, -1] : side === 'left' ? [-1, 0] : [1, 0];
    if (map.isSolid(c + dc, r + dr)) return;
    let sides = this.decals.get(block);
    if (!sides) this.decals.set(block, (sides = new Set()));
    sides.add(side);
  }

  /** EffectsController.CreateGibs: every piece of the shared GibHolderBro, cut from the unit's own sheet. */
  gibsFor(sheet: string, x: number, y: number, xForce: number, yForce: number, xI: number, yI: number): void {
    for (const def of this.data.gibs) {
      this.gibs.push(launchGib(def, sheet, x, y, xForce * (0.8 + this.rng() * 0.4), yForce * (0.8 + this.rng() * 0.4), xI, yI, 1,
        this.rng));
    }
  }

  /** EffectsController.CreateEffect(FlickerFader, x, y, z, delay, velocity) */
  flame(def: FlameDef, x: number, y: number, delay = 0, xI = 0, yI = 0): void {
    this.flames.push({ def, x, y, xI, yI, delay, counter: 0, index: def.startIndex, dead: false });
  }

  private flameNamed(name: string): FlameDef {
    return this.data.flames.find((f) => f.name === name) ?? this.data.flames[0];
  }

  /** EffectsController.CreateShrapnel: `count` pieces from a sphere of `radius`, pushed out at `force`. */
  shrapnel(def: ShrapnelDef, x: number, y: number, radius: number, force: number, count: number, xI: number, yI: number): void {
    for (let i = 0; i < count; i++) {
      // Random.onUnitSphere * radius, z dropped
      const a = this.rng() * Math.PI * 2;
      const z = this.rng() * 2 - 1;
      const k = Math.sqrt(1 - z * z) * radius;
      const ox = Math.cos(a) * k;
      const oy = Math.sin(a) * k;
      this.gibs.push(launchShrapnel(def, def.file, x + ox, y + oy, (ox * force) / radius + xI, (oy * force) / radius + yI, this.rng));
    }
  }

  /** EffectsController.CreateEffect(puff, x, y, z, delay, velocity) */
  private delayedPuff(def: PuffDef, x: number, y: number, delay: number, xI: number, yI: number): void {
    this.puffs.push(makePuff(def, x, y, 1, xI, yI, WHITE, delay));
  }

  /** EffectsController.CreateShaderExplosion: an explosion prefab, its every system delayed by `delay`. */
  shaderExplosion(size: ShurikenKey, x: number, y: number, delay = 0): void {
    if (!this.shurikenData) return;
    this.shuriken.push(new ShurikenEffect(this.shurikenData.systems[size], x, y, delay, this.rng));
  }

  /** EffectsController.CreatePlumes: CreateShrapnelCircle with plume sparks, each dragging a FireTrailSmall. */
  plumes(x: number, y: number, count: number, radius: number, force: number, xI: number, yI: number): void {
    const def = this.data.plume;
    const arc = Math.PI * Math.min(2, Math.max(0, 0.1 + count * 0.18));
    const step = arc / count;
    const start = Math.PI / 2 - arc * 0.5 + this.rng() * step;
    for (let i = 0; i < count; i++) {
      const ox = Math.cos(start + step * i);
      const oy = Math.sin(start + step * i);
      const gib = launchShrapnel(def, def.file, ox * radius + x, oy * radius + y, ox * force + xI, oy * force + yI, this.rng);
      this.gibs.push(gib);
      if (!this.shurikenData) continue;
      const trail = new ShurikenEffect(this.shurikenData.systems.fireTrail, gib.x, gib.y, 0, this.rng);
      this.shuriken.push(trail);
      this.trails.push({ gib, trail });
    }
  }

  /** EffectsController.CreateExplosionRangePop */
  rangePop(x: number, y: number, range: number): void {
    const def = this.data.rangePop;
    const col = Math.min(def.columns - 1, Math.floor(Math.max(0, range - 24) / 8));
    this.rangePops.push({ x, y, col, appear: def.delayBeforeAppear, show: def.delayBeforeDisappear });
  }

  /**
   * MookDoor.DestroyDoor with explodeAtEnd: forty sparks (CreateShrapnel), six smoke puffs, two medium and two
   * large shader explosions and six flames thrown out of the doorway, each after its own delay.
   */
  doorBlast(x: number, y: number): void {
    const d = this.data.door;
    const spread = 16;
    this.shrapnel(d.sparks, x, y, 3, 200, 40, 0, 250);
    const puffs: Array<[number, number]> = [[0, 0.9], [0, 0.9], [0, 0.8], [1, 0.7], [1, 0.5], [1, 0.7]];
    puffs.forEach(([which, base], i) => {
      const [ux, uy] = this.insideUnitCircle();
      const delay = base + this.rng() * (i === 2 || i === 5 ? 0.2 : 0.5);
      this.delayedPuff(d.smoke[which], x + ux * spread * 0.25, y + uy * spread * 0.15, delay, ux * spread * 3, uy * spread * 3);
    });
    const blasts: Array<[ShurikenKey, number, number]> = [
      ['medium', 0.25, 0.3 + this.rng() * 0.5], ['large', 0.25, 0.3 + this.rng() * 0.5], ['medium', 0.15, this.rng() * 0.2],
      ['large', 0.15, 0],
    ];
    for (const [size, my, delay] of blasts) {
      const [ux, uy] = this.insideUnitCircle();
      this.shaderExplosion(size, x + ux * spread * 0.25, y + uy * spread * my, delay);
    }
    for (let i = 0; i < 6; i++) {
      const [ux, uy] = this.insideUnitCircle();
      this.flame(this.flameNamed(d.fire[i % d.fire.length]), x + ux * spread * 0.25, y + uy * spread * 0.15,
        0.6 + this.rng() * 0.2, ux * spread * 1.5, uy * spread * 1.5);
    }
  }

  /** MookSuicide.MakeEffects: fiery shrapnel, four smoke puffs, three shader explosions and three flames. */
  private suicideBlast(x: number, y: number): void {
    const fx: BlastFx = this.data.suicide;
    const range = fx.range;
    const size = (fx.explosionSize ?? 'small') as ShurikenKey;
    this.rangePop(x, y, range * 2);
    this.shrapnel(fx.shrapnel, x, y, 3, 160, 40, 0, 60);
    let [ux, uy] = this.insideUnitCircle();
    this.delayedPuff(fx.smoke[0], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.5, ux * range * 3, uy * range * 3);
    [ux, uy] = this.insideUnitCircle();
    const [sx, sy] = this.insideUnitCircle();
    this.delayedPuff(fx.smoke[0], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.2, sx * range * 3, sy * range * 3);
    for (let i = 0; i < 2; i++) {
      [ux, uy] = this.insideUnitCircle();
      this.delayedPuff(fx.smoke[1], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.5, ux * range * 3, uy * range * 3);
    }
    const blasts: Array<[number, number]> = [[0.25, this.rng() * 0.5], [0.15, 0], [0.25, 0.15 + this.rng() * 0.4]];
    for (const [m, delay] of blasts) {
      [ux, uy] = this.insideUnitCircle();
      this.shaderExplosion(size, x + ux * range * m, y + uy * range * m, delay);
    }
    for (const name of fx.fire ?? []) {
      [ux, uy] = this.insideUnitCircle();
      this.flame(this.flameNamed(name), x + ux * range * 0.25, y + uy * range * 0.25, 0.1 + this.rng() * 0.2,
        ux * range * 1.5, uy * range * 1.5);
    }
  }

  /** Mine.Explode: a range pop, six puffs of smoke, three large explosions and a medium one, and ten flames thrown up. */
  private mineBlast(x: number, y: number): void {
    const fx: BlastFx = this.data.suicide;
    const range = MINE.range;
    this.rangePop(x, y, range * 4);
    for (let i = 0; i < 6; i++) {
      const [ux, uy] = this.insideUnitCircle();
      this.delayedPuff(fx.smoke[i < 3 ? 0 : 1], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * (i % 3 === 2 ? 0.2 : 0.5),
        ux * range * 3, uy * range * 3);
    }
    for (const [size, m, delay] of [['large', 0.25, this.rng() * 0.5], ['large', 0.25, this.rng() * 0.5], ['large', 0.25, 0], ['medium', 0.15, 0]] as const) {
      const [ux, uy] = this.insideUnitCircle();
      this.shaderExplosion(size, x + ux * range * m, y + uy * range * m, delay);
    }
    const fire = fx.fire ?? [];
    for (let i = 0; fire.length > 0 && i < 10; i++) {
      const a = this.rng() * Math.PI; // Math.RandomPointOnCircle, flipped upwards
      const [ux, uy] = [Math.cos(a), Math.sin(a)];
      this.flame(this.flameNamed(fire[i % fire.length]), x + ux * range * 0.25, y + uy * range * 0.25, 0.1 + this.rng() * (i < 9 ? 0.4 : 0.3),
        ux * range * (i < 6 || i === 9 ? 3 : 4), uy * range * (i < 6 || i === 9 ? 3 : 4));
    }
  }

  /** GrenadeAirstrike.MakeEffects: as the marker calls the strike in, sparks and six puffs of smoke. */
  airstrikeCalled(x: number, y: number): void {
    const fx = this.data.airstrike;
    const range = fx.range;
    this.shrapnel(fx.shrapnel, x, y, 3, 140, 20, 0, 150);
    let [ux, uy] = this.insideUnitCircle();
    this.delayedPuff(fx.smoke[0], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.5, ux * range * 3, uy * range * 3);
    [ux, uy] = this.insideUnitCircle();
    this.delayedPuff(fx.smoke[0], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.5, ux * range * 3, uy * range * 3);
    const [sx, sy] = this.insideUnitCircle();
    this.delayedPuff(fx.smoke[0], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * 0.2, sx * range * 3, sy * range * 3);
    for (const base of [0.5, 0.5, 0.2]) {
      [ux, uy] = this.insideUnitCircle();
      this.delayedPuff(fx.smoke[1], x + ux * range * 0.25, y + uy * range * 0.25, this.rng() * base, ux * range * 3, uy * range * 3);
    }
  }

  /** EffectsController.CreateSmoke */
  smoke(x: number, y: number, xI: number, yI: number): void {
    this.puff(this.pick(['smokeSmall1', 'smokeSmall2', 'smokeSmall3'] as const), x, y, 1, xI, yI);
  }

  /** The original call sites for each world event. `sheetOf` names the sheet a unit kind is drawn from. */
  onEvent(e: GameEvent, sheetOf: (kind: UnitKind) => string): void {
    switch (e.type) {
      case 'block': {
        // Block.ActuallyCollapse -> EffectsDestroyed(xI, yI, 65 + 24 * damage)
        const b = this.data.blocks[e.kind];
        if (!b.dropDirt) return;
        const force = 65 + 24 * e.damage;
        if (b.customColors) this.dirtWhiteParticles(e.x, e.y, 25, 5, force, 0, 40, b.customColors[0], b.customColors[1]);
        else this.dirtParticles(e.x, e.y, 25, 5, force, 0, 40);
        return;
      }
      case 'hit': {
        // TestVanDammeAnim.Damage, bullets
        const y = Math.min(Math.max(e.hitY, e.y + 3), e.y + UNIT_HEIGHT - 2);
        this.bloodGush(e.x, y, e.xI * 0.2, e.yI * 0.5 + 24);
        return;
      }
      case 'kill':
      case 'death':
        // TestVanDammeAnim.Death
        this.bloodParticles(e.x, e.y + 6, 10, 4, 5, 60, e.xI * 0.5, e.yI * 0.5);
        return;
      case 'gib':
        // TestVanDammeAnim.CreateGibs
        this.gibsFor(sheetOf(e.kind), e.x, e.y, 100, 100, e.xI * 0.25, e.yI * 0.25 + 60);
        return;
      case 'explosion':
        this.explosion(e.source, e.x, e.y, e.range);
        return;
      case 'shieldHit':
        // a bullet off the riot shield: a few sparks
        this.sparkShower(e.x, e.y, 5, 1, 50, 0, 30, 0.3, 0.2);
        return;
      case 'shieldOff':
        // MookRiotShield.DisarmShield: the shield goes flying (CreateShrapnel), in sparks
        this.sparkShower(e.x, e.y + 8, 14, 3, 90, e.xI * 0.4, 200 * 0.3, 0.5, 0.3);
        return;
      case 'bossFled':
        // into the smoke
        for (let i = 0; i < 6; i++) this.smoke(e.x + (i - 2.5) * 4, e.y + 4 + (i % 3) * 5, (i - 2.5) * 12, 30);
        return;
      case 'airstrike':
        this.airstrikeCalled(e.x, e.y);
        return;
      case 'flame':
        // Mook.Update while burning: a random one of its flames at Y + height
        this.flame(this.pick(this.data.flames), e.x, e.y);
        return;
      case 'doorBlast':
        this.doorBlast(e.x, e.y);
        return;
      case 'shot':
        if (e.weapon === 'bullet') {
          // Mook.FireWeapon: CreateMuzzleFlashEffect(x, y, -25, xSpeed * 0.01, ySpeed * 0.01)
          this.puff('muzzleFlash', e.x + e.facing * 10, e.y + 8, e.facing, e.facing * 2.5, 0);
        } else if (e.weapon === 'bigRocket') {
          this.puff('muzzleFlash', e.x + e.facing * 24, e.y + 22, e.facing, e.facing * 2, 0); // CreateMuzzleFlashTankCannonEffect
        } else if (e.weapon === 'rocket') {
          // MookBazooka.UseFire: three puffs of smoke out of the back of the tube, then the muzzle flash
          this.smoke(e.x - e.facing * 10, e.y + 7, e.facing * -60, 0);
          this.smoke(e.x - e.facing * 9, e.y + 7, e.facing * -50, 0);
          this.smoke(e.x - e.facing * 9, e.y + 7, e.facing * -40, 0);
          this.puff('muzzleFlash', e.x + e.facing * 12, e.y + 8, e.facing, e.facing, 0);
        } else if (e.weapon === 'm60') {
          // TestVanDammeAnim.FireWeapon: CreateMuzzleFlashEffect(X + dir * 10, Y + 8, -25, xSpeed * 0.15, ySpeed * 0.15)
          this.puff('muzzleFlash', e.x + e.facing * 10, e.y + 8, e.facing, e.facing * 60, 0);
        } else if (e.weapon === 'revolver') {
          // DirtyHarry.FireWeapon: CreateMuzzleFlashMediumEffect(X + dir * 14, Y + 8.5, -25, xSpeed * 0.06, ySpeed * 0.06)
          this.puff('muzzleFlash', e.x + e.facing * 14, e.y + 8.5, e.facing, e.facing * 45, 0);
        } else if (e.weapon === 'cricket') {
          // Brononymous.FireWeapon: CreateMuzzleFlashEffect(X + dir * 14, Y + 9.5, -25, xSpeed * 0.01, 0)
          this.puff('muzzleFlash', e.x + e.facing * 14, e.y + 9.5, e.facing, e.facing * 7, 0);
        } else if (e.weapon === 'minigun') {
          // MookBigGuy.FireWeapon: CreateMuzzleFlashEffect(X + dir * 17, Y + 9, -25, xSpeed * 0.01, ..)
          this.puff('muzzleFlash', e.x + e.facing * 17, e.y + 9, e.facing, e.facing * 4, 0);
        } else if (e.weapon === 'flamethrower') {
          // BaBroracus.FireWeapon, once a flame: CreateMuzzleFlashEffect(X + dir * 11, Y + 6 / Y + 7, -25, xSpeed * 0.01, ..)
          this.puff('muzzleFlash', e.x + e.facing * 11, e.y + 6, e.facing, e.facing * 1.2, 0);
          this.puff('muzzleFlash', e.x + e.facing * 11, e.y + 7, e.facing, e.facing * 1.5, 0);
        }
        return;
      case 'molotovBurst':
        // GrenadeMolotov.MakeEffects: sparks, smoke and a ring of flames
        this.sparkShower(e.x, e.y, 12, 3, 120, 0, 250, 0.8, 0.3);
        for (let i = 0; i < 3; i++) this.smoke(e.x + (i - 1) * 6, e.y + 4, (i - 1) * 30, 40);
        for (let i = 0; i < 8; i++) {
          const [ux, uy] = this.insideUnitCircle();
          this.flame(this.pick(this.data.flames), e.x + ux * 16, e.y + Math.abs(uy) * 8, this.rng() * 0.3, ux * 48, Math.abs(uy) * 48);
        }
        return;
      case 'django':
        // Samuel becomes Django: a puff of dust around him
        for (let i = 0; i < 5; i++) this.smoke(e.x + (i - 2) * 5, e.y + 4 + (i % 2) * 6, (i - 2) * 20, 20);
        return;
      case 'alarmWarning':
        // DeadManSwitchAlarmTrap: CreateRedWarningEffect (ours: a red flash)
        this.puff('muzzleFlash', e.x, e.y, 1, 0, 0, ALARM_RED);
        return;
      case 'jetpack':
        // MookJetpack.Update: CreatePlumeParticle at its two nozzles; ours: a puff of smoke from one, the thrust is drawn
        this.puff(this.pick(['smokeSmall1', 'smokeSmall2', 'smokeSmall3'] as const), e.x - e.facing * 3, e.y + 1, 1, 0, -30);
        return;
      case 'flameWallPuff':
        // FlameWallExplosion.CreateFlashBangPoint: one of its explosionPuffs, flipped and pushed the way the fire spreads
        this.puff((['flameWallGreen', 'flameWallWhite', 'flameWallRed'] as const)[e.variant] ?? 'flameWallRed', e.x, e.y, e.dir, e.xI, 0, WHITE, e.delay);
        return;
      case 'cricketBeam':
        // NoisyCricket.RunBeam and RunCricketEffects: a beam puff, and blue sparks where the shot is
        this.puff('cricketBeam', e.x, e.y);
        this.sparkShower(e.x, e.y, 2, 0.1, 7, 0, 2, 0, 0, BLUE_SPARK);
        return;
      default:
    }
  }

  /** The MakeEffects of whatever blew up. */
  private explosion(source: Blast['source'], x: number, y: number, range: number): void {
    const [ux, uy] = this.insideUnitCircle();
    switch (source) {
      case 'rocket':
      case 'bomb':
        // Rocket.MakeEffects; RocketBombardment adds three plumes
        this.rangePop(x, y, range * 3);
        this.sparkShower(x, y, 60, 3, 160, 0, 60, 0.6, 0.33);
        this.shaderExplosion('medium', x + ux * range * 0.05, y + uy * range * 0.05);
        if (source === 'bomb') this.plumes(x, y, 3, 8, 270, 0, 0);
        return;
      case 'barrel': {
        // BarrelBlock.Explode, at the block's centre
        const by = y - BARREL_Y_OFFSET;
        const full = this.data.barrelFullExplosion;
        this.rangePop(x, by, range * 2);
        this.sparkShower(x, by, full ? 70 : 45, 3, 200, 0, 250, 0.6, 0.5);
        this.plumes(x, by, 3, 8, full ? 315 : 270, 0, 0);
        if (full) {
          this.shaderExplosion('medium', x + ux * range * 0.25, by + uy * range * 0.25, this.rng() * 0.5);
          const [vx, vy] = this.insideUnitCircle();
          this.shaderExplosion('medium', x + vx * range * 0.25, by + vy * range * 0.25);
        }
        this.shaderExplosion('large', x, by);
        return;
      }
      case 'suicide':
        this.suicideBlast(x, y);
        return;
      case 'mine':
        this.mineBlast(x, y - MINE.unitY);
        return;
      case 'stomp':
        this.rangePop(x, y, range * 2); // MookBigGuyElite.FallDamage: no fire, just the shock
        return;
      case 'shell':
        // HeavyShell.MakeEffects: a range pop and a medium explosion
        this.rangePop(x, y, range * 3);
        this.sparkShower(x, y, 50, 3, 160, 0, 60, 0.6, 0.33);
        this.shaderExplosion('medium', x, y);
        return;
      case 'bigRocket':
        // Rocket.MakeEffects, then RocketMassive's three plumes
        this.rangePop(x, y, range * 3);
        this.sparkShower(x, y, 60, 3, 160, 0, 60, 0.6, 0.33);
        this.shaderExplosion('medium', x + ux * range * 0.05, y + uy * range * 0.05);
        this.plumes(x, y, 3, 15, 240, 0, 0);
        return;
      case 'nuke':
        // MookMotorBike.ExplodeNuclearBomb: CreateNuclearExplosion (ours: the massive explosion, bigger)
        this.rangePop(x, y, range * 2);
        this.sparkShower(x, y, 120, 3, 320, 0, 400, 0.8, 0.6);
        this.plumes(x, y, 8, 14, 360, 0, 0);
        for (const [dx, dy] of [[0, 0], [-40, 10], [40, 10], [0, 40]]) this.shaderExplosion('large', x + dx, y + dy, Math.abs(dx) / 400);
        return;
      case 'vehicle':
        // Tank.MakeEffectsDeath: CreateExplosion over the hull, glass shards (ours: the massive explosion's sparks)
        this.rangePop(x, y + 16, range * 2 + 48);
        this.sparkShower(x, y + 16, 50, 3, 200, 0, 250, 0.6, 0.5);
        this.plumes(x, y + 16, 3, 8, 270, 0, 0);
        this.shaderExplosion('large', x, y + 16);
        return;
      case 'tank':
        // MookArmouredGuy.Gib: CreateMassiveExplosion
        this.rangePop(x, y, range * 2);
        this.sparkShower(x, y, 70, 3, 200, 0, 250, 0.6, 0.5);
        this.plumes(x, y, 5, 10, 315, 0, 0);
        this.shaderExplosion('large', x, y);
        return;
      case 'cricket': {
        // NoisyCricket.MakeEffects: the ball puff, a range pop, two showers of blue sparks and four puffs of smoke
        this.puff('cricketBall', x, y);
        this.rangePop(x, y, range * 2);
        this.sparkShower(x, y, 5, 3, 160, 0, 60, 0, 0, BLUE_SPARK);
        this.sparkShower(x, y, 5, 3, 200, 0, 90, 0, 0, BLUE_SPARK);
        for (let i = 0; i < 4; i++) {
          const [sx, sy] = this.insideUnitCircle();
          this.delayedPuff(this.data.suicide.smoke[i % 2], x + sx * range * 0.25, y + sy * range * 0.25, this.rng() * 0.5,
            sx * range * 3, sy * range * 3);
        }
        return;
      }
      default:
        // the football is ours: a small shader explosion
        this.rangePop(x, y, range * 2);
        this.shaderExplosion('small', x, y);
    }
  }

  /** TestVanDammeAnim.RunBlindStars: a star over a blind or panicking unit's head every 0.6 s. */
  private blindStars(u: Unit, t: number): void {
    if (u.blindTime <= 0 || u.dead) {
      this.starCounter.delete(u);
      return;
    }
    let c = (this.starCounter.get(u) ?? 0) + t;
    if (c > 0.1) {
      c -= 0.5;
      this.starIndex += 1 + Math.floor(this.rng() * 2);
      const key = (['stunnedStars1', 'stunnedStars2', 'stunnedStars3'] as const)[this.starIndex % 3];
      const star = makePuff(this.data.twoLayerPuffs[key], this.rng() * 2 - 1, 6 + UNIT_BOX_HEIGHT * 1.4, 1, 0, 20);
      star.follow = u;
      this.puffs.push(star);
    }
    this.starCounter.set(u, c);
  }

  /** Foot poofs every fourth running frame and a poof on landing (TestVanDammeAnim running and Land). */
  trackUnit(u: Unit, t = 0): void {
    if (t > 0) this.blindStars(u, t);
    const prev = this.tracked.get(u);
    const runFrame = Math.floor(u.animTime / RUN_FRAME_RATE);
    const running = u.onGround && !u.dead && Math.abs(u.xI) > 1;
    if (prev) {
      if (!prev.onGround && u.onGround && !u.dead) {
        const dir = Math.abs(u.xI) >= 30 ? -u.facing : 0;
        this.puff(this.pick(['landPoof1', 'landPoof2'] as const), u.x, u.y, dir < 0 ? -1 : 1);
      }
      if (running && runFrame !== prev.runFrame && runFrame % 4 === 0) {
        this.puff(this.pick(['footPoof1', 'footPoof2', 'footPoof3'] as const), u.x, u.y + 2, 1, -u.facing * 60.5, 1);
      }
    }
    this.tracked.set(u, { onGround: u.onGround, runFrame });
  }

  step(t: number, map: TileMap, view: View, time: number): void {
    this.map = map;
    this.particles.step(t, map, view, time);
    for (const p of this.puffs) stepPuff(p, t, map);
    for (const g of this.gibs) stepGib(g, t, map, view, this.gibHooks, this.rng);
    for (const f of this.flames) stepFlame(f, t);
    // a fire trail follows its plume (parented in Unity) until the plume dies and lets go of it
    for (const tr of this.trails) {
      if (!tr.gib.dead) tr.trail.moveTo(tr.gib.x, tr.gib.y);
      else tr.trail.detach();
    }
    for (const s of this.shuriken) s.step(t);
    for (let i = this.shuriken.length - 1; i >= 0; i--) if (this.shuriken[i].finished) this.shuriken.splice(i, 1);
    for (let i = this.trails.length - 1; i >= 0; i--) if (this.trails[i].trail.finished) this.trails.splice(i, 1);
    for (const r of this.rangePops) {
      if (r.appear > 0) r.appear -= t;
      else r.show -= t;
    }
    for (let i = this.rangePops.length - 1; i >= 0; i--) if (this.rangePops[i].show < 0) this.rangePops.splice(i, 1);
    for (let i = this.puffs.length - 1; i >= 0; i--) if (this.puffs[i].dead) this.puffs.splice(i, 1);
    for (let i = this.gibs.length - 1; i >= 0; i--) if (this.gibs[i].dead) this.gibs.splice(i, 1);
    for (let i = this.flames.length - 1; i >= 0; i--) if (this.flames[i].dead) this.flames.splice(i, 1);
  }
}
