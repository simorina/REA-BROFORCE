import { describe, expect, it } from 'vitest';
import { TileMap, makeBlock } from '../../engine/map';
import { TEST_STATS } from '../../engine/testStats';
import { makeUnit } from '../../engine/units';
import { TEST_EFFECTS } from '../testFx';
import { Effects } from './controller';
import { constrainToBlocks, launchGib, stepGib } from './gibs';
import { particleFrame, type View } from './particles';
import { makePuff, puffRect, stepPuff } from './puffs';
import { raycastBlocks } from './raycast';
import type { ShurikenData, SystemDef } from './shuriken';

const VIEW: View = { x: 100, y: 60, halfW: 200, halfH: 112 };
const DT = 1 / 60;

function floor(cols = 20): TileMap {
  const m = new TileMap(cols, 10);
  for (let c = 0; c < cols; c++) m.set(c, 0, makeBlock('brick', TEST_STATS)); // top face at y = 8
  return m;
}
/** A deterministic rng cycling through a few values. */
function cycle(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('raycastBlocks (Physics.Raycast on the grid)', () => {
  it('finds the face a ray enters and its normal', () => {
    const hit = raycastBlocks(floor(), 40, 40, 0, -1, 100);
    expect(hit).toMatchObject({ x: 40, y: 8, nx: 0, ny: 1, c: 3, r: 0 }); // x = 40 is column 3
    const side = raycastBlocks(floor(), 10, 30, 1, 0, 100);
    expect(side).toBeNull();
  });

  it('stops at maxDist and ignores the cell it starts in', () => {
    expect(raycastBlocks(floor(), 40, 40, 0, -1, 20)).toBeNull();
    expect(raycastBlocks(floor(), 40, 0, 0, -1, 100)).toBeNull(); // inside row 0, the ray leaves the map
  });
});

describe('particles (ParticleCollisionAnimator)', () => {
  it('a big blood drop falls, bloodies the top of the block it lands on, splashes and dies', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    const map = floor();
    fx.bloodBig(40, 40, 1, 0, 0, 0, 0, 0);
    expect(fx.particles.list).toHaveLength(1);
    let splashed = false;
    for (let i = 0; i < 60; i++) {
      fx.step(DT, map, VIEW, i * DT);
      splashed ||= fx.puffs.some((p) => p.def.name.startsWith('BloodSplash'));
    }
    expect(fx.particles.list).toHaveLength(0); // createSplashParticlesAndDie
    expect(fx.decals.get(map.get(3, 0)!)?.has('top')).toBe(true);
    expect(splashed).toBe(true);
  });

  it("doesn't bloody a face another block covers (Block.CanBloody)", () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    const map = floor();
    map.set(3, 1, makeBlock('brick', TEST_STATS)); // covers the top of (3, 0)
    fx.bloodBig(40, 60, 1, 0, 0, 0, 0, 0);
    for (let i = 0; i < 60; i++) fx.step(DT, map, VIEW, i * DT);
    expect(fx.decals.get(map.get(3, 1)!)?.has('top')).toBe(true);
    expect(fx.decals.get(map.get(3, 0)!)).toBeUndefined();
  });

  it('dirt bits bounce off the floor, lose speed and cycle their 4x4 UV frames', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    const map = floor();
    fx.dustParticles(TEST_EFFECTS.emitters.dirtSmall1, 40, 30, 1, 0, 0, 0, -100, [1, 1, 1, 1]);
    const p = fx.particles.list[0];
    const frames = new Set<number>();
    let minY = Infinity;
    for (let i = 0; i < 120; i++) {
      fx.step(DT, map, VIEW, i * DT);
      minY = Math.min(minY, p.y);
      frames.add(particleFrame(p));
    }
    expect(minY).toBeGreaterThanOrEqual(8);
    expect(frames.size).toBeGreaterThan(4);
  });

  it('particles far off screen are dropped', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.sparkShower(2000, 60, 30, 3, 160, 0, 60, 0.6, 0.33);
    expect(fx.particles.list.length).toBe(20 + 9); // (int)(30 * 0.67) showering, (int)(30 * 0.33) floating
    for (let i = 0; i < 30; i++) fx.step(DT, floor(), VIEW, i * DT); // each is checked every sixth frame
    expect(fx.particles.list.length).toBe(0);
  });
});

describe('puffs', () => {
  it('play their strip and die after frames x frameRate', () => {
    const def = TEST_EFFECTS.puffs.bloodGush1; // 7 frames at 0.025
    const p = makePuff(def, 0, 0);
    const map = floor();
    let t = 0;
    while (!p.dead && t < 1) {
      stepPuff(p, DT, map);
      t += DT;
    }
    expect(t).toBeGreaterThan(def.frames * def.frameRate - DT);
    expect(t).toBeLessThan(def.frames * def.frameRate + 2 * DT);
  });

  it('pick the frame rect along the strip', () => {
    const p = makePuff(TEST_EFFECTS.puffs.footPoof1, 0, 0);
    p.frame = 3;
    expect(puffRect(p)).toEqual([24, 0, 8, 8]);
  });
});

describe('gibs (Shrapnel / BloodyShrapnel / Gib)', () => {
  const head = TEST_EFFECTS.gibs.find((g) => g.name === 'BodyHead')!;

  it('launch from their offset on the body, pushed outwards by the force', () => {
    const g = launchGib(head, 'mook', 100, 50, 100, 100, 0, 60, 1, () => 0.5);
    expect([g.x, g.y]).toEqual([99, 67]);
    expect(g.xI).toBeCloseTo((-1 / 16) * 100);
    expect(g.yI).toBeCloseTo((17 / 16) * 100 + 60);
    expect(g.life).toBeCloseTo(2.5 * head.lifeM);
  });

  it('fall, bounce on blocks, shrink and, while fast, leave a trail of blood', () => {
    const map = floor();
    const g = launchGib(head, 'mook', 100, 20, 0, 0, 400, 0, 1, () => 0.5);
    let blood = 0;
    const hooks = { bloodDots: () => blood++, bloodBig: () => blood++ };
    let bounced = false;
    for (let i = 0; i < 120 && !g.dead; i++) {
      const before = g.yI;
      stepGib(g, DT, map, VIEW, hooks, () => 0.5);
      if (before < 0 && g.yI > 0) bounced = true;
      expect(g.y).toBeGreaterThanOrEqual(8);
    }
    expect(bounced).toBe(true);
    expect(blood).toBeGreaterThan(0);
    expect(g.w).toBeLessThan(head.w);
  });

  it('constrainToBlocks stops a move at the face, size away from it', () => {
    const m = constrainToBlocks(floor(), 40, 12, 2, 0, -10);
    expect(m.bounceY).toBe(true);
    expect(12 + m.yIT).toBe(10);
  });
});

describe('Effects call sites', () => {
  it('a destroyed brick throws 25 bits of dirt; Desert Earth uses its own colours', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'block', x: 32, y: 16, kind: 'brick', damage: 10 }, () => 'mook');
    expect(fx.particles.list.length).toBe(12 + 3 * 8);
    const dirt = new Effects(TEST_EFFECTS, () => 0.5);
    dirt.onEvent({ type: 'block', x: 32, y: 16, kind: 'dirt', damage: 10 }, () => 'mook');
    expect(dirt.particles.list.length).toBe(12 + 16 + 8);
    expect(dirt.particles.list.some((p) => p.def.name === 'DirtParticlesSmallWhite' || p.def.texture.includes('White'))).toBe(true);
  });

  it('a gibbed unit throws all six pieces of its own sheet', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'gib', x: 50, y: 20, team: 'enemy', kind: 'mook', xI: 0, yI: 0 }, (k) => `sheet:${k}`);
    expect(fx.gibs.map((g) => g.sheet)).toEqual(Array(6).fill('sheet:mook'));
  });

  it('a bullet hit gushes blood: a gush, a spurt and dots', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.1, 0.9, 0.4));
    fx.onEvent({ type: 'hit', x: 50, y: 20, hitY: 100, xI: 250, yI: 0 }, () => 'mook');
    expect(fx.puffs.map((p) => p.def.name)).toEqual([expect.stringMatching(/Gush/), expect.stringMatching(/Spurt/)]);
    expect(fx.puffs[0].y).toBe(20 + 15 - 2); // clamped to the head
    expect(fx.particles.list.length).toBeGreaterThanOrEqual(3);
  });

  it('running units kick up a foot poof every fourth frame, and landing makes a poof', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    const u = makeUnit(1, 'mook', 'enemy', 50, 8, TEST_STATS.units.mook);
    u.onGround = false;
    fx.trackUnit(u);
    u.onGround = true;
    u.xI = 70;
    for (let i = 0; i <= 16; i++) {
      u.animTime = i * 0.025;
      fx.trackUnit(u);
    }
    const names = fx.puffs.map((p) => p.def.name);
    expect(names.filter((n) => n.startsWith('Land'))).toHaveLength(1);
    expect(names.filter((n) => n.startsWith('Foot'))).toHaveLength(4);
  });
});

describe("the alarmist's dead man's switch", () => {
  it('flashes red where he lies (EffectsController.CreateRedWarningEffect)', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'alarmWarning', x: 50, y: 18 }, () => 'mook');
    expect(fx.puffs).toHaveLength(1);
    expect(fx.puffs[0].color[1]).toBeLessThan(0.5);
  });
});

describe("the jetpack mooks' thrust", () => {
  it('leaves a little puff of smoke from between its nozzles, pushed down', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'jetpack', x: 100, y: 60, facing: 1 }, () => 'mook');
    expect(fx.flames).toHaveLength(0);
    expect(fx.puffs.map((p) => [p.def.name.startsWith('SmokeSmall'), p.x, p.y, p.yI])).toEqual([[true, 97, 61, -30]]);
  });
});

describe("the Bruiser's minigun", () => {
  it('flashes at the muzzle, 17 ahead and 9 up (MookBigGuy.FireWeapon)', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'shot', weapon: 'minigun', x: 100, y: 8, facing: -1 }, () => 'mook');
    expect(fx.puffs.map((p) => [p.def.name, p.x, p.y, p.flip])).toEqual([['MuzzleFlash Puff1', 83, 17, -1]]);
  });
});

describe("Giorgia Meloni's fire", () => {
  it('each burning cell of her flame wall puffs its flame in the tricolour, after its delay, drifting its way', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'flameWallPuff', x: 64, y: 28, variant: 0, delay: 0.02, dir: 1, xI: 66 }, () => 'mook');
    fx.onEvent({ type: 'flameWallPuff', x: 80, y: 28, variant: 2, delay: 0, dir: -1, xI: -66 }, () => 'mook');
    expect(fx.puffs.map((p) => p.def.name)).toEqual(['Flame Wall Puff Test', 'Flame Wall Puff Test 3']);
    expect(fx.puffs[0]).toMatchObject({ x: 64, y: 28, delay: 0.02, flip: 1, xI: 66 });
    expect(fx.puffs[0].def.file).toContain('flameWallGreen');
    expect(fx.puffs[1]).toMatchObject({ flip: -1, xI: -66 });
    expect(fx.puffs[1].def.file).toContain('flameWallRed');
  });

  it("a hell Bruiser's flame wall puffs hell's own flames", () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'flameWallPuff', x: 64, y: 28, variant: 1, delay: 0, dir: -1, xI: -66, hell: true }, () => 'mook');
    expect(fx.puffs.map((p) => p.def.name)).toEqual(['Flame Wall Puff Hell 2']);
  });

  it("her flamethrower flashes at the nozzle for each of its two flames (BaBroracus.FireWeapon: CreateMuzzleFlashEffect)", () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    fx.onEvent({ type: 'shot', weapon: 'flamethrower', x: 50, y: 8, facing: 1 }, () => 'mook');
    expect(fx.puffs.map((p) => [p.def.name, p.x, p.y])).toEqual([['MuzzleFlash Puff1', 61, 14], ['MuzzleFlash Puff1', 61, 15]]);
  });
});

describe('flames and the mook door blowing up', () => {
  it("FlickerFader: steps a frame every frameRate and dies after its last", () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5);
    const def = TEST_EFFECTS.flames[0];
    fx.flame(def, 10, 20);
    for (let t = 0; t < def.frameRate * (def.frames - 0.5); t += DT) fx.step(DT, floor(), VIEW, t);
    expect(fx.flames).toHaveLength(1);
    expect(fx.flames[0].index).toBe(def.frames - 1);
    for (let i = 0; i < 3; i++) fx.step(DT, floor(), VIEW, 1);
    expect(fx.flames).toHaveLength(0);
  });

  it('a burning unit leaves flames; DestroyDoor throws 40 sparks, 6 delayed smoke puffs and 6 delayed flames', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.1, 0.6, 0.35, 0.8));
    fx.onEvent({ type: 'flame', x: 10, y: 20 }, () => 'mook');
    expect(fx.flames).toHaveLength(1);
    fx.onEvent({ type: 'doorBlast', x: 100, y: 40 }, () => 'mook');
    expect(fx.gibs).toHaveLength(40);
    // CreateShrapnel(.., 3, 200, 40, 0, 250): a sphere of radius 3 pushed out at 200, plus 250 up
    expect(fx.gibs.every((g) => g.sheet === TEST_EFFECTS.door.sparks.file)).toBe(true);
    expect(fx.gibs.every((g) => Math.hypot(g.xI, g.yI - 250) <= 200.001)).toBe(true);
    expect(fx.puffs).toHaveLength(6);
    expect(fx.puffs.every((p) => p.delay >= 0.5)).toBe(true);
    expect(fx.flames.slice(1).every((f) => f.delay >= 0.6 && f.delay <= 0.8)).toBe(true);
  });
});

describe('explosions (each MakeEffects)', () => {
  const K = (scalar: number) => ({ mode: 0 as const, scalar, min: 0, maxCurve: [], minCurve: [] });
  const def = (name: string): SystemDef => ({
    name, parent: -1, isSub: false, position: [0, 0, 0], duration: 1, looping: name === 'trail', startDelay: K(0),
    worldSpace: name === 'trail', simulationSpeed: 1,
    initial: { lifetime: K(0.5), speed: K(0), size: K(8), sizeY: K(8), size3D: false, rotation: K(0), gravity: K(0), maxParticles: 50 },
    shape: null,
    emission: { enabled: true, rate: K(0), rateOverDistance: K(name === 'trail' ? 0.2 : 0), bursts: name === 'trail' ? [] : [{ time: 0, count: K(1), cycles: 1, interval: 0.01 }] },
    size: null, rotation: null, velocity: null, force: null, clamp: null, sub: [], custom: [[], []],
    renderer: { sortMode: 3, streams: [0, 34, 4, 13, 15], sortingFudge: 0, material: { name: 'm', mainTex: 'a', ramp: 'b', brightness: 1, worldToPixel: 1 } },
  });
  const SHURIKEN: ShurikenData = {
    systems: { tiny: [def('tiny')], small: [def('small')], medium: [def('medium')], large: [def('large')], fireTrail: [def('trail')] },
    textures: {},
  };
  const kinds = (fx: Effects) => fx.shuriken.map((s) => s.defs[0].name).sort();
  const boom = (source: 'rocket' | 'bomb' | 'football' | 'barrel' | 'suicide', range: number) =>
    ({ type: 'explosion' as const, x: 100, y: 40, big: true, source, range });

  it('a bazooka rocket: range pop, sparks and one medium explosion (Rocket.MakeEffects)', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.3, 0.7), SHURIKEN);
    fx.onEvent(boom('rocket', 28), () => 'mook');
    expect(kinds(fx)).toEqual(['medium']);
    expect(fx.rangePops).toHaveLength(1);
    expect(fx.rangePops[0].col).toBe(7); // (28 * 3 - 24) / 8
    expect(fx.particles.list.length).toBeGreaterThan(0);
  });

  it('an airstrike bomb adds three plumes, each dragging a fire trail (RocketBombardment)', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.3, 0.7), SHURIKEN);
    fx.onEvent(boom('bomb', 28), () => 'mook');
    expect(kinds(fx)).toEqual(['medium', 'trail', 'trail', 'trail']);
    const plumes = fx.gibs.filter((g) => g.def.name === TEST_EFFECTS.plume.name);
    expect(plumes).toHaveLength(3);
    expect(plumes.every((g) => g.yI > 0 && Math.hypot(g.xI, g.yI) === 270)).toBe(true);
  });

  it('a barrel: two medium and a large explosion, plumes at 315 (BarrelBlock.Explode, fullExplosion)', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.3, 0.7), SHURIKEN);
    fx.onEvent(boom('barrel', 50), () => 'mook');
    expect(kinds(fx)).toEqual(['large', 'medium', 'medium', 'trail', 'trail', 'trail']);
    expect(fx.rangePops[0].col).toBe(9); // (50 * 2 - 24) / 8
  });

  it("a suicide mook: its own fiery shrapnel, smoke, three small explosions and flames", () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.3, 0.7), SHURIKEN);
    fx.onEvent(boom('suicide', 40), () => 'mook_suicide');
    expect(kinds(fx)).toEqual(['small', 'small', 'small']);
    expect(fx.gibs).toHaveLength(40);
    expect(fx.puffs).toHaveLength(4);
    expect(fx.flames).toHaveLength(3);
  });

  it('a plume dies on its first bounce and lets its trail go; the trail then finishes', () => {
    const fx = new Effects(TEST_EFFECTS, () => 0.5, SHURIKEN);
    fx.plumes(40, 9, 1, 0, 300, 0, 0);
    for (let i = 0; i < 120; i++) fx.step(DT, floor(), VIEW, i * DT);
    expect(fx.gibs).toHaveLength(0);
    expect(fx.shuriken).toHaveLength(0);
  });

  it('the airstrike marker throws sparks and six puffs of smoke as it calls the strike in', () => {
    const fx = new Effects(TEST_EFFECTS, cycle(0.3, 0.7), SHURIKEN);
    fx.onEvent({ type: 'airstrike', x: 60, y: 20 }, () => 'mook');
    expect(fx.gibs).toHaveLength(20);
    expect(fx.puffs).toHaveLength(6);
  });
});
