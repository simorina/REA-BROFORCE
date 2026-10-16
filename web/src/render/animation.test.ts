import { describe, expect, it } from 'vitest';
import { TEST_STATS } from '../engine/testStats';
import { makeUnit } from '../engine/units';
import { makeTank } from '../engine/tank';
import { jetFrameCentreY, loopFrame, prisonerFrame, special2Frame, stripFrame, tankHullFrame, turretFrame, unitFrame } from './animation';

const bro = (patch: Partial<ReturnType<typeof makeUnit>>) =>
  Object.assign(makeUnit(1, 'bro', 'player', 0, 8, TEST_STATS.bros.bro_base), { onGround: true }, patch);

describe('unitFrame (TestVanDammeAnim.Animate*)', () => {
  it('idles on row 0, column 0', () => {
    expect(unitFrame(bro({}))).toEqual({ col: 0, row: 0 });
  });

  it('runs on row 1 at runningFrameRate 0.025, and dashes on row 3', () => {
    expect(unitFrame(bro({ xI: 110, animTime: 0.06 }))).toEqual({ col: 2, row: 1 });
    expect(unitFrame(bro({ xI: 110, animTime: 0.06, dashing: true }))).toEqual({ col: 2, row: 3 });
  });

  it('uses the new jumping frames on row 2', () => {
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 100 }))).toEqual({ col: 0, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: 100, xI: 0 }))).toEqual({ col: 6, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 100 }))).toEqual({ col: 3, row: 2 });
    expect(unitFrame(bro({ onGround: false, yI: -100, xI: 0 }))).toEqual({ col: 9, row: 2 });
  });

  it("strikes on BroLee's attack rows 7 and 8, columns 24-31", () => {
    const attack = (frame: number, row: 0 | 1) => ({ frame, counter: 0, row, hit: false, struck: false });
    expect(unitFrame(bro({ attack: attack(0, 0) }))).toEqual({ col: 24, row: 7 });
    expect(unitFrame(bro({ attack: attack(3, 1), onGround: false }))).toEqual({ col: 27, row: 8 });
  });

  it('climbs on row 2, columns 12-16', () => {
    expect(unitFrame(bro({ onGround: false, wallClimbing: true, animTime: 0.07 }))).toEqual({ col: 14, row: 2 });
  });

  it('lies dead on column 5, or column 4 while falling', () => {
    expect(unitFrame(bro({ dead: true }))).toEqual({ col: 5, row: 0 });
    expect(unitFrame(bro({ dead: true, onGround: false }))).toEqual({ col: 4, row: 0 });
  });
});

describe('frame helpers', () => {
  it('stripFrame walks an effect strip once and stops on the last frame', () => {
    expect(stripFrame(0.25, 0.5, 16)).toBe(8);
    expect(stripFrame(0.6, 0.5, 16)).toBe(15);
  });

  it('caged prisoners only use the standing frames 0-3 of the Hobro sheet (4-5 are death poses)', () => {
    const frames = new Set<number>();
    for (let t = 0; t < 3; t += 0.01) frames.add(prisonerFrame(t));
    expect([...frames].sort()).toEqual([0, 1, 2, 3]);
  });

  it('loopFrame cycles', () => {
    expect(loopFrame(0.07, 0.03, 21)).toBe(2);
    expect(loopFrame(0.67, 0.03, 21)).toBe(1);
  });

  it('a crouching mook shows its ducking frame; a panicking one runs on columns 21-28', () => {
    const u = makeUnit(2, 'mook', 'enemy', 0, 0, TEST_STATS.units.mook);
    u.onGround = true;
    u.ducking = true;
    expect(unitFrame(u)).toEqual({ col: 6, row: 0 });
    u.ducking = false;
    u.blindTime = 0.5;
    u.xI = 70;
    u.animTime = 0.1;
    expect(unitFrame(u)).toEqual({ col: 23, row: 0 });
  });

  it('a burning mook runs on the panic frames; a waving scout uses its four (ScoutMook.AnimateRunning)', () => {
    const u = makeUnit(2, 'mook', 'enemy', 0, 0, TEST_STATS.units.mook);
    Object.assign(u, { onGround: true, burnTime: 0.4, xI: 70, animTime: 0.1 });
    expect(unitFrame(u)).toEqual({ col: 23, row: 0 });
    const s = makeUnit(3, 'mook_scout', 'enemy', 0, 0, TEST_STATS.units.mook_scout);
    Object.assign(s, { onGround: true, waveTime: 0.3, xI: 90, animTime: 0.2 }); // frame 4 of 4 -> column 21
    expect(unitFrame(s)).toEqual({ col: 21, row: 0 });
  });

  it("the suicide mook's idle special plays row 7, holding frame 9 for a second", () => {
    expect(special2Frame(0)).toBe(0);
    expect(special2Frame(0.2)).toBe(4);
    expect(special2Frame(0.9)).toBe(9);
    expect(special2Frame(1.5)).toBe(12); // 0.095 s past the hold: 10 + 2
    expect(special2Frame(9)).toBe(16);
  });
});


describe('the flex', () => {
  it('shows row 11 and holds frame 23', () => {
    expect(unitFrame(bro({ flex: { frame: 5, counter: 0, block: true } }))).toEqual({ col: 5, row: 11 });
    expect(unitFrame(bro({ flex: { frame: 40, counter: 0, block: true } }))).toEqual({ col: 23, row: 11 });
  });
});

describe('the tank (TankBroTank.Animate*, TankBroTankTurret.SetTurretFrame)', () => {
  it('idles on column 0, rolls through columns 0-2 at 0.0334 s, and uses row 1 by yI in the air', () => {
    const k = makeTank(1, 0, 0, 1);
    k.onGround = true;
    expect(tankHullFrame(k)).toEqual({ col: 0, row: 0 });
    Object.assign(k, { xI: 60, animTime: 0.07 });
    expect(tankHullFrame(k)).toEqual({ col: 2, row: 0 });
    Object.assign(k, { onGround: false, yI: 120 });
    expect(tankHullFrame(k)).toEqual({ col: 1, row: 1 });
    Object.assign(k, { yI: -100 });
    expect(tankHullFrame(k)).toEqual({ col: 7, row: 1 });
  });

  it('the turret: mortar firing on row 0, the transform on row 1, the cannon on row 2', () => {
    const tu = makeTank(1, 0, 0, 1).turret;
    expect(turretFrame(tu)).toEqual({ col: 0, row: 0 });
    Object.assign(tu, { firing: true, frame: 5 });
    expect(turretFrame(tu)).toEqual({ col: 5, row: 0 });
    Object.assign(tu, { firing: false, switching: true, switchFrame: 12, gun: 1 });
    expect(turretFrame(tu)).toEqual({ col: 12, row: 1 });
    Object.assign(tu, { switching: false, firing: true, frame: 7 });
    expect(turretFrame(tu)).toEqual({ col: 7, row: 2 });
    Object.assign(tu, { firing: false });
    expect(turretFrame(tu)).toEqual({ col: 0, row: 2 });
  });
});

describe('the jet sprite', () => {
  it('stands on its wheels: the 64 px frame, whose lowest pixels are 8 up, is centred 24 above the jet', () => {
    expect(jetFrameCentreY(100, 64)).toBe(124);
  });
});
