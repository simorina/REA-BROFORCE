import { describe, expect, it } from 'vitest';
import { TEST_STATS } from '../engine/testStats';
import { makeUnit } from '../engine/units';
import { TileMap, makeBlock } from '../engine/map';
import { makeTank } from '../engine/tank';
import { LASER, makeLaser, type LaserState } from '../engine/laser';
import {
  blockFrame, flameLook, helicopterFrame, jetFrameCentreY, LASER_FLASH, laserLook, mechFrame, loopFrame, prisonerFrame, special2Frame, stripFrame,
  tankHullFrame, turretFrame, unitFrame,
} from './animation';

const bro = (patch: Partial<ReturnType<typeof makeUnit>>) =>
  Object.assign(makeUnit(1, 'bro', 'player', 0, 8, TEST_STATS.bros.bro_base), { onGround: true }, patch);

describe("flameLook (FlameThrower Bullet's flame: its AnimatedTexture, sinking 32 a second)", () => {
  it('plays its ten frames once at 0.0334 s and holds the last, sinking as it goes', () => {
    expect(flameLook(0, TEST_STATS.flame)).toEqual({ frame: 0, dy: -0 });
    expect(flameLook(0.1, TEST_STATS.flame)).toEqual({ frame: 2, dy: -3.2 });
    expect(flameLook(1, TEST_STATS.flame).frame).toBe(9);
  });
});

describe("a jetpack mook spiralling down (MookJetpack.SetSpiralFrame)", () => {
  const jetMook = (xI: number, yI: number) => {
    const m = makeUnit(2, 'mook_jetpack', 'enemy', 0, 40, TEST_STATS.units.mook_jetpack);
    Object.assign(m, { onGround: false, xI, yI });
    m.jet!.spiral = true;
    return m;
  };

  it('turns with its flight on row 9 (lowerLeftPixel 10 frames down): 12 - (angle / pi + 0.5) * 12.99, faster than 200', () => {
    expect(unitFrame(jetMook(0, 300))).toEqual({ col: 0, row: 9 }); // straight up
    expect(unitFrame(jetMook(300, 0))).toEqual({ col: 6, row: 9 }); // level
    expect(unitFrame(jetMook(0, -300))).toEqual({ col: 12, row: 9 }); // straight down
    expect(unitFrame(jetMook(50, 50)).row).toBe(2); // slow: its jumping frames
  });
});

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

describe('blockFrame', () => {
  it('jungle earth shows its grass only under open air; other blocks have one frame', () => {
    const m = new TileMap(2, 3);
    m.set(0, 0, makeBlock('dirt', TEST_STATS));
    m.set(0, 1, makeBlock('dirt', TEST_STATS));
    m.set(1, 0, makeBlock('brick', TEST_STATS));
    expect(blockFrame(m, 0, 1)).toBe(0); // the top: grass
    expect(blockFrame(m, 0, 0)).toBe(1); // covered: plain earth
    expect(blockFrame(m, 1, 0)).toBe(0);
  });
});

describe('the Goliath', () => {
  it('draws its turning frames: 0 facing right, 3 facing us, 6 facing left', () => {
    expect([0, 2.6, 6, 7, -1].map(mechFrame)).toEqual([0, 3, 6, 6, 0]);
  });
});

describe("Elon Musk's laser (LaserBeamVisuals.LateUpdate)", () => {
  const laser = (phase: LaserState['phase'], time: number): LaserState => ({ ...makeLaser(), phase, time });

  it('swells to half its width as it charges, in the charge tint; burns full width in its own colour; thins out as it dissipates', () => {
    expect(laserLook(laser('off', 0))).toEqual({ width: 0, tint: 0, flash: 0 });
    expect(laserLook(laser('charge', 0))).toEqual({ width: 0, tint: 0, flash: 0 });
    expect(laserLook(laser('charge', LASER.charge / 2)).width).toBeCloseTo(0.25);
    expect(laserLook(laser('charge', LASER.charge))).toEqual({ width: 0.5, tint: 0, flash: 0 });
    expect(laserLook(laser('on', 1))).toEqual({ width: 1, tint: 1, flash: 0 });
    const fading = laserLook(laser('fade', LASER.fade / 2));
    expect([fading.width, fading.tint]).toEqual([0.5, 0.5]);
    expect(laserLook(laser('fade', LASER.fade)).width).toBe(0);
  });

  it('flashes as it lights: from full to nothing over LASER_FLASH', () => {
    expect(laserLook(laser('on', 0)).flash).toBe(1);
    expect(laserLook(laser('on', LASER_FLASH / 2)).flash).toBeCloseTo(0.5);
    expect(laserLook(laser('on', LASER_FLASH)).flash).toBe(0);
  });
});

describe('the extraction helicopter', () => {
  it('hovers on its idle frame instead of cycling through its turn (Helicopter.StartIdleAnim): 0 faces right, 4 left', () => {
    expect(helicopterFrame(1)).toBe(0);
    expect(helicopterFrame(-1)).toBe(4);
  });
});
