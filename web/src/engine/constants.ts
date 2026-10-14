// Values ported from Broforce's decompiled Assembly-CSharp. Each cites its source; see docs/findings.md.
export const TILE = 16; // Map.TileSize
export const HALF_TILE = 8; // Map.HalfTileSize
export const GRAVITY = 1100; // TestVanDammeAnim.ApplyNormalGravity
export const FIXED_DT = 1 / 60;
export const ACCEL_M = 2; // TestVanDammeAnim.AddSpeedLeft/Right: speed * 2 * t
export const DASH_ACCEL_M = 4; // ... * 4 while dashing
export const LOW_SPEED_ACCEL_M = 2.6; // AddSpeed*: extra speed * 2.6 * t while |xI| < 50
export const LOW_SPEED_THRESHOLD = 50;
export const MIN_START_SPEED = 25; // AddSpeed*: xI snaps to ±25 when starting to run
export const DASH_SPEED_M = 1.33; // TestVanDammeAnim.dashSpeedM
export const GROUND_FRICTION_M = 10; // TestVanDammeAnim.frictionM
export const JUMP_GRACE = 0.1; // TestVanDammeAnim.Jump: realtimeSinceStartup - lastLandTime < 0.1
export const WALL_CLIMB_BOOST = 190; // TestVanDammeAnim.AnimateWallClimb: yI = 190 on frame 1
export const WALL_CLIMB_GRAVITY_M = 0.66; // TestVanDammeAnim.ApplyWallClimbingGravity
export const WALL_CLIMB_CYCLE = 8 * 0.033; // AnimateWallClimb: 8 frames at frameRate 0.033
export const UNIT_HALF_WIDTH = 6; // TestVanDammeAnim.halfWidth
export const UNIT_HEIGHT = 15; // Unit.headHeight
export const MOOK_BULLET_SPEED = 250; // Mook.UseFire
export const BAZOOKA_ROCKET_SPEED = 100; // MookBazooka.UseFire
export const BAZOOKA_FIRE_DELAY = 1.4; // MookBazooka.FireWeapon: fireDelay = 1.4
export const SIGHT_X = 300; // EnemyAI.sightRangeX
export const SIGHT_Y = 20; // EnemyAI.sightRangeY
export const MIN_KNOCK_DIST = 65; // Map.ExplodeUnits: distance clamped to 65 for knock-only
export const AIRSTRIKE_THROW = { x: 200, y: 150, ox: 8, oy: 8 }; // BroBase.UseSpecial
export const AIRSTRIKE_THROW_DUCK = { x: 30, y: 70, ox: 6, oy: 3 }; // BroBase.UseSpecial (ducking)
export const AIRSTRIKE_ROCKETS = [580, 540, 500, 460, 420]; // GrenadeAirstrike.Death y offsets
export const AIRSTRIKE_X_OFFSET = 480; // GrenadeAirstrike.Death: X - 480 - h
export const AIRSTRIKE_SPEED_MIN = 200; // GrenadeAirstrike.Death: 200 + random * 30
export const AIRSTRIKE_SPEED_RAND = 30;
export const SUICIDE_GROUND_DAMAGE = 10; // MookSuicide.MakeEffects: DamageGround(10, range)
export const SUICIDE_UNIT_DAMAGE = 9; // MookSuicide.MakeEffects: ExplodeUnits(9, range, range, blastForce * 40, 300)
export const SUICIDE_FORCE_M = 40;
export const SUICIDE_EXTRA_Y = 300;
export const SUICIDE_FUSE_MIN = 0.6; // MookSuicide.Start: deathCounter = 0.6 + random * 0.2
export const SUICIDE_FUSE_RAND = 0.2;
export const BARREL_GROUND_DAMAGE = 12; // BarrelBlock: DamageGround(12, range)
export const BARREL_UNIT_DAMAGE = 12; // BarrelBlock: ExplodeUnits(12, range * 1.2, range, ..., 200, 300)
export const BARREL_UNIT_RANGE_M = 1.2;
export const BARREL_FORCE = 200;
export const BARREL_EXTRA_Y = 300;
export const BARREL_Y_OFFSET = -6; // BarrelBlock: ExplodeUnits at Y - 6
export const RUN_FRAME_RATE = 0.025; // TestVanDammeAnim.runningFrameRate
export const JUMP_FRAME_RATE = 0.0334; // TestVanDammeAnim.AnimateDeath/Jumping frameRate
export const CLIMB_FRAME_RATE = 0.033; // TestVanDammeAnim.AnimateWallClimb

// Design values (not in the original game). Tuned in playtesting; listed in docs/findings.md.
export const FOOTBALL = {
  kickX: 220, kickY: 160, bounceM: 0.7, frictionM: 0.85, maxBounces: 3, fuse: 1.6,
  damage: 5, range: 32, blastForce: 20, blastForceExtraY: 300,
};
export const AIRSTRIKE_FUSE = 1.0;
export const LIVES_START = 3;
export const MOOK_BURST = 3;
export const MOOK_BURST_PAUSE = 1.0;
export const MOOK_REACTION = 0.4;
export const PATROL_TURN_TIME = 2.5;
export const LOST_SIGHT_TIME = 2.0;
export const SUICIDE_TRIGGER_DX = 20;
export const SUICIDE_TRIGGER_DY = 16;
export const PRISONER_RESCUE_DIST = 16;
export const FLAG_REACH = 12;
export const RESPAWN_DELAY = 1.5;
export const CORPSE_TIME = 3;
export const EXTRACTION_TIME = 3;
export const EXPLOSION_DURATION = 0.5;
export const SPEECH_DURATION = 2.2;
export const CAMERA_LERP = 6;
export const CAMERA_Y_OFFSET = 40;
export const SHAKE_TIME = 0.2;
export const SHAKE_AMOUNT = 2;
