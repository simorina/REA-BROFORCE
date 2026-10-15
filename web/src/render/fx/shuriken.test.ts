import { describe, expect, it } from 'vitest';
import { drawParticle, unpackTexture, type PixelBuffer, type ShaderTexture } from './pixelShader';
import {
  ShurikenEffect, SystemState, emitFromShape, evalCurve, evalKeys, type Curve, type Particle, type ShapeDef, type SystemDef,
} from './shuriken';

const DT = 1 / 60;
const K = (scalar: number): Curve => ({ mode: 0, scalar, min: 0, maxCurve: [], minCurve: [] });
const LINEAR: Curve = { mode: 1, scalar: 1, min: 0, maxCurve: [[0, 0, 1, 1], [1, 1, 1, 1]], minCurve: [] };
const CIRCLE: ShapeDef = {
  type: 10, radius: 0, radiusThickness: 0, arc: 360, arcMode: 3, arcSpread: 0, angle: 25, length: 5, position: [0, 0, 0],
  rotation: [0, 0, 0], scale: [1, 1, 1], randomDirection: 0, sphericalDirection: 0, alignToDirection: false,
};

/** A system with a burst of `count` at time 0 and nothing else switched on. */
function system(patch: Partial<SystemDef> = {}, count = 4): SystemDef {
  return {
    name: 'test', parent: -1, isSub: false, position: [0, 0, 0], duration: 1, looping: false, startDelay: K(0),
    worldSpace: false, simulationSpeed: 1,
    initial: { lifetime: K(1), speed: K(10), size: K(8), sizeY: K(8), size3D: false, rotation: K(0), gravity: K(0), maxParticles: 100 },
    shape: CIRCLE,
    emission: { enabled: true, rate: K(0), rateOverDistance: K(0), bursts: [{ time: 0, count: K(count), cycles: 1, interval: 0.01 }] },
    size: null, rotation: null, velocity: null, force: null, clamp: null, sub: [], custom: [[K(1), K(0), K(0), K(1)], []],
    renderer: { sortMode: 3, streams: [0, 34, 4, 13, 15], sortingFudge: 0, material: { name: 'm', mainTex: 'a', ramp: 'b', brightness: 1, worldToPixel: 1 } },
    ...patch,
  };
}

const noSpawn = () => undefined;

describe('curves (AnimationCurve / MinMaxCurve)', () => {
  it('evaluates Hermite keys and clamps outside them', () => {
    expect(evalKeys([[0, 0, 1, 1], [1, 1, 1, 1]], 0.25)).toBeCloseTo(0.25, 6); // tangents of a straight line
    expect(evalKeys([[0, 0, 0, 0], [1, 1, 0, 0]], 0.5)).toBeCloseTo(0.5, 6); // smoothstep
    expect(evalKeys([[0, 0, 0, 0], [1, 1, 0, 0]], 0.25)).toBeCloseTo(0.15625, 6);
    expect(evalKeys([[0.2, 3, 0, 0], [0.8, 5, 0, 0]], 0)).toBe(3);
    expect(evalKeys([[0.2, 3, 0, 0], [0.8, 5, 0, 0]], 1)).toBe(5);
  });

  it('handles the four MinMaxCurve modes', () => {
    expect(evalCurve(K(7), 0.5, 0.9)).toBe(7);
    expect(evalCurve({ ...LINEAR, scalar: 2 }, 0.5, 0)).toBeCloseTo(1, 6);
    expect(evalCurve({ mode: 2, scalar: 1, min: 0, maxCurve: [[0, 4, 0, 0]], minCurve: [[0, 2, 0, 0]] }, 0, 0.5)).toBe(3);
    expect(evalCurve({ mode: 3, scalar: 12, min: 10, maxCurve: [], minCurve: [] }, 0, 0.25)).toBe(10.5);
  });
});

describe('ShapeModule', () => {
  it('spreads a burst evenly around a circle (BurstSpread)', () => {
    const dirs = [0, 1, 2, 3].map((i) => emitFromShape(CIRCLE, () => 0.5, i, 4));
    expect(dirs.map((d) => [Math.round(d.dx) + 0, Math.round(d.dy) + 0])).toEqual([[1, 0], [0, 1], [-1, 0], [0, -1]]);
  });

  it('points a cone rotated -90 degrees about X upwards, offset by the shape position', () => {
    const cone = { ...CIRCLE, type: 4, angle: 0, rotation: [-90, 0, 0] as [number, number, number], position: [0, 7, 0] as [number, number, number] };
    const e = emitFromShape(cone, () => 0.3);
    expect(e.dy).toBeCloseTo(1, 6);
    expect(e.y).toBeCloseTo(7, 6);
  });
});

describe('SystemState', () => {
  it('waits out its start delay, bursts, and lets particles die after their lifetime', () => {
    const s = new SystemState(system({ startDelay: K(0.1) }), 0, 50, 20, 0, 0, () => 0.5);
    s.step(DT, noSpawn);
    expect(s.particles).toHaveLength(0);
    for (let i = 0; i < 6; i++) s.step(DT, noSpawn);
    expect(s.particles).toHaveLength(4);
    expect(s.particles.every((p) => Math.hypot(p.vx, p.vy) === 10)).toBe(true);
    for (let i = 0; i < 61; i++) s.step(DT, noSpawn);
    expect(s.particles).toHaveLength(0);
    expect(s.finished).toBe(true);
  });

  it('applies force, then limits the speed with dampen (per frame at 30 fps)', () => {
    const def = system({
      force: { x: K(0), y: K(600), worldSpace: true, randomizePerFrame: false },
      clamp: { magnitude: K(1), x: K(0), y: K(0), separateAxis: false, dampen: 1, drag: null },
    }, 1);
    const s = new SystemState(def, 0, 0, 0, 0, 0, () => 0.5);
    s.step(DT, noSpawn);
    s.step(DT, noSpawn);
    const p = s.particles[0];
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(1, 5);
  });

  it('emits by distance as its emitter moves (rateOverDistance)', () => {
    const def = system({ emission: { enabled: true, rate: K(0), rateOverDistance: K(0.5), bursts: [] }, looping: true });
    const s = new SystemState(def, 0, 0, 0, 0, 0, () => 0.5);
    for (let i = 1; i <= 10; i++) {
      s.moveTo(i * 4, 0);
      s.step(DT, noSpawn);
    }
    expect(s.particles).toHaveLength(20); // 40 units at 0.5 a unit
  });

  it('evaluates size over lifetime and the custom data curves the shader reads', () => {
    const s = new SystemState(system({ size: { curve: LINEAR, y: LINEAR, separateAxes: false }, custom: [[LINEAR], []] }, 1),
      0, 0, 0, 0, 0, () => 0.5);
    for (let i = 0; i < 31; i++) s.step(DT, noSpawn);
    const p = s.particles[0];
    expect(p.sx).toBeCloseTo(8 * p.age, 5);
    expect(p.c1[0]).toBeCloseTo(p.age, 5);
  });
});

describe('ShurikenEffect', () => {
  it('a Birth sub-emitter follows its parent particle and inherits its size', () => {
    const parent = system({ shape: { ...CIRCLE, radius: 0 }, initial: { ...system().initial, speed: K(0), size: K(35) },
      sub: [{ system: 1, type: 0, properties: 2 }] }, 1);
    const child = system({ parent: 0, isSub: true, initial: { ...system().initial, size: K(1.8), speed: K(0) },
      emission: { enabled: false, rate: K(0), rateOverDistance: K(0), bursts: [{ time: 0, count: K(1), cycles: 1, interval: 0.01 }] } });
    const fx = new ShurikenEffect([parent, child], 100, 50, 0, () => 0.5);
    expect(fx.systems).toHaveLength(1); // the sub-emitter does not play on its own
    fx.step(DT);
    fx.step(DT);
    const sub = fx.systems.find((s) => s.def === child);
    expect(sub?.particles).toHaveLength(1);
    expect(sub?.particles[0].startX).toBeCloseTo(63, 5); // 1.8 x the parent's 35
    expect([sub?.particles[0].x, sub?.particles[0].y]).toEqual([100, 50]);
  });

  it('draws far particles first, then by system and age', () => {
    const near = system({ shape: { ...CIRCLE, position: [0, 0, -5] } }, 1);
    const far = system({ shape: { ...CIRCLE, position: [0, 0, 1] } }, 2);
    const fx = new ShurikenEffect([near, far], 0, 0, 0, () => 0.5);
    fx.step(DT);
    expect(fx.drawList().map((d) => d.p.z)).toEqual([1, 1, -5]);
  });

  it('a detached trail stops emitting and finishes once its particles are gone', () => {
    const trail = system({ looping: true, emission: { enabled: true, rate: K(0), rateOverDistance: K(1), bursts: [] } });
    const fx = new ShurikenEffect([trail], 0, 0, 0, () => 0.5);
    fx.moveTo(5, 0);
    fx.step(DT);
    expect(fx.systems[0].particles).toHaveLength(5);
    fx.detach();
    fx.moveTo(50, 0);
    for (let i = 0; i < 70; i++) fx.step(DT);
    expect(fx.finished).toBe(true);
  });
});

describe('Unlit/PixelExplosion in software', () => {
  /** A one-texel texture. */
  const tex = (r: number, g: number, b: number, a: number): ShaderTexture => ({ w: 1, h: 1, rgba: new Uint8ClampedArray([r, g, b, a]) });
  const ramp: ShaderTexture = { w: 2, h: 1, rgba: new Uint8ClampedArray([10, 20, 30, 0, 200, 100, 50, 255]) };
  const buffer = (): PixelBuffer => ({ data: new Uint8ClampedArray(20 * 20 * 4), width: 20, height: 20, left: 0, top: 20 });
  const particle = (patch: Partial<Particle> = {}): Particle => ({
    x: 10, y: 10, z: 0, vx: 0, vy: 0, age: 0, life: 1, startX: 4, startY: 4, sx: 4, sy: 4, rot: 0, seq: 0,
    rnd: new Float32Array(14), c1: [1, 0, 0, 1], c2: [0, 0, 0], hasC2: false, ...patch,
  });
  const mat = { name: 'm', mainTex: 'a', ramp: 'b', brightness: 2, worldToPixel: 1 };
  const pixel = (b: PixelBuffer, x: number, y: number) => Array.from(b.data.slice(((b.top - 1 - y) * b.width + x - b.left) * 4, ((b.top - 1 - y) * b.width + x - b.left) * 4 + 4));

  it('unpacks RGB | alpha textures', () => {
    const packed = new Uint8ClampedArray([1, 2, 3, 255, 9, 9, 9, 255]);
    expect(Array.from(unpackTexture(packed, 2, 1).rgba)).toEqual([1, 2, 3, 9]);
  });

  it('fills the quad with the ramp colour of its heat, brightened by the ramp alpha', () => {
    const b = buffer();
    drawParticle(b, particle(), mat, tex(255, 0, 0, 255), ramp, 0);
    // heat 1 picks the last ramp texel; its alpha 1 multiplies by _Brightness 2
    expect(pixel(b, 10, 10)).toEqual([255, 200, 100, 255]);
    expect(pixel(b, 8, 8)).toEqual([255, 200, 100, 255]);
    expect(pixel(b, 13, 10)).toEqual([0, 0, 0, 0]); // outside the 4 x 4 quad
  });

  it('discards where the shape is below the dissolve threshold', () => {
    const b = buffer();
    // shape = r = 0.39: with no dissolve (c1.w 0) 0.39 - 1 < 0 discards; c1.w 1 adds 0.99 and keeps it
    drawParticle(b, particle({ c1: [1, 0, 0, 0] }), mat, tex(100, 0, 0, 0), ramp, 0);
    expect(pixel(b, 10, 10)).toEqual([0, 0, 0, 0]);
    drawParticle(b, particle({ c1: [1, 0, 0, 1] }), mat, tex(100, 0, 0, 0), ramp, 0);
    expect(pixel(b, 10, 10)).toEqual([10, 20, 30, 255]); // heat 0.39 picks the first texel (alpha 0: no boost)
  });
});
