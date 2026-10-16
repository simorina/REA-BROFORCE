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
export const JUMP_TIME = 0.123; // TestVanDammeAnim.JUMP_TIME: yI stays at jumpForce while jump is held
export const JUMP_BUFFER = 0.2; // TestVanDammeAnim: pressedJumpInAirSoJumpIfTouchGroundGrace = 0.2
export const WALL_CLIMB_BOOST = 190; // TestVanDammeAnim.AnimateWallClimb: yI = 190 on frame 1
export const WALL_CLIMB_GRAVITY_M = 0.66; // TestVanDammeAnim.ApplyWallClimbingGravity
export const WALL_CLIMB_CYCLE = 8 * 0.033; // AnimateWallClimb: 8 frames at frameRate 0.033
export const UNIT_HALF_WIDTH = 6; // TestVanDammeAnim.halfWidth
export const UNIT_HEIGHT = 15; // Unit.headHeight
export const UNIT_WIDTH = 8; // Unit.width on the unit prefabs
export const UNIT_BOX_HEIGHT = 6; // Unit.height on the unit prefabs: ExplodeUnits aims at Y + height / 2
export const MOOK_BULLET_SPEED = 250; // Mook.UseFire
export const BAZOOKA_ROCKET_SPEED = 100; // MookBazooka.UseFire
export const BAZOOKA_FIRE_DELAY = 1.4; // MookBazooka.FireWeapon: fireDelay = 1.4
export const SIGHT_PROBE_BACK = 5; // HeroController.CanSeePlayer: looks from x - direction * 5, y + 10 ...
export const SIGHT_PROBE_UP = 10;
export const SIGHT_EYE = 6; // ... along a ray between both units' y + 6, stopping 6 short
export const FIRE_START_LIMIT = 0.3; // TestVanDammeAnim.StartFiring: fireRate < 0.3 fires on the first frame
export const AI_FACE_LINGER = 0.05; // PolymorphicAI.RunQueue: FacePoint ends at duration < -0.05
export const AI_STUCK_TIME = 0.3; // RunQueue: Move gives up after 0.3 s against a wall ...
export const AI_SAME_SPOT_TIME = 2; // ... or 2 s on the same cell
export const AI_GREET_WAIT = 0.2; // PolymorphicAI.FullyAlert: Wait 0.2, GreetPlayer, Wait sightDelay
export const ALERT_TOUCH = 8; // TestVanDammeAnim.AlertNearbyMooks: Map.AlertNearbyMooks(X, Y, 8, 8)
export const NOISE_ROCKET = 80; // Rocket.MakeEffects: Map.DisturbWildLife(x, y, 80, 5)
export const NOISE_BARREL = 120; // BarrelBlock: Map.DisturbWildLife(X, Y, 120, 5)
export const SUICIDE_SPEED_ALERTED = 140; // MookSuicide.AnimateRunning: speed = 140 while alerted
export const SUICIDE_TIMER = 4; // SuicideAI.suicideTimer: explodes 4 s after lighting the fuse ...
export const SUICIDE_DELAY = 0.5; // SuicideAI.suicideDelay: ... and not in the first 0.5 s
export const SUICIDE_BLOCKED_M = 2.5; // SuicideAI.GetInput: the timer runs 2.5x faster against a wall
export const SUICIDE_TRIGGER = 24; // SuicideAI.GetInput: HeroController.IsPlayerNearby(..., 24, 24)
export const SUICIDE_DEATH_FUSE = 0.7; // MookSuicide.Damage: deathCounter = 0.7 when killed
export const SPECIAL2_TIME = 9 * 0.045 + 1 + 7 * 0.045; // MookSuicide.AnimateSpecial2: frames 0-16 at 0.045 s, frame 9 held 1 s
export const BAZOOKA_RECOIL = 40; // MookBazooka.FireWeapon: xIBlast = -facing * 40
export const GRENADE_WARNING_LIFE = 0.5; // Grenade.RunWarnings: in the last 0.5 s of its life ...
export const GRENADE_PANIC_RATE = 0.045; // ... every 0.045 s ...
export const GRENADE_PANIC_RANGE = 28; // ... Map.PanicUnits(x, y, 28, 0.9, false, true)
export const GRENADE_PANIC_TIME = 0.9;
export const DOOR_EXIT_INVULNERABLE = 0.6; // Mook.Start: a mook walking out of a door is invulnerable for 0.6 s
export const DOOR_FIRE_DAMAGE = 3; // MookDoor.ReleaseMook: KnockAndDamageUnit(this, newMook, 3, DamageType.Fire)
export const SCOUT_WAVE_TIME = 0.4; // ScoutMook.FireWeapon: waveTime = 0.4
export const FLEX_ROW = 11; // TestVanDammeAnim.AnimateGesture: Flex is gesture 3, lowerLeftPixel y = (9 + 3) * 32
export const FLEX_FRAMES = 24; // ... 24 frames, then it holds the last one ...
export const FLEX_HOLD = 30; // ... for 30 more before it may end
export const FLEX_FRAME_RATE = 0.0667;
export const FLEX_SLOW_RATE = 0.24; // frames 7, 12 and 19 are held 0.24 s
export const FLEX_SLOW_FRAMES = [7, 12, 19];
export const FLEX_EVENT_FRAMES = [8, 18]; // PlayFlexSound and TriggerFlexEvent
export const FLEX_RESTART_FRAME = 20; // SetGestureAnimation: pressing again restarts the flex from frame 20 on
export const ALLURE_RANGE = { x: 96, y: 30 }; // BroBase.TriggerFlexEvent: FlexAlluring -> Map.AttractMooks(X, Y, 96, 30)
export const BOMB_FIRE_RANGE_M = 1.2; // RocketBombardment.MakeEffects: Map.HitUnits(..., 1, Fire, range * 1.2, ...)
export const SUICIDE_BURN_EXTRA = 30; // MookSuicide.MakeEffects: Map.BurnUnitsAround(this, 5, 1, range + 30, ...)
export const GIB_THRESHOLD = -10; // TestVanDammeAnim.gibThreshold: Damage gibs a unit whose health drops below it
export const RESPAWN_DELAY = 1.8; // HeroController.broRespawnDelay
export const SPAWN_INVULNERABLE = 0.5; // Player.SpawnHero: SetInvulnerable(0.5)
export const RESCUE_INVULNERABLE = 0.75; // RescueBro.Free: SetInvulnerable(0.75)
export const INVULNERABLE_FLASH = 25; // InvulnerabilityFlash: tint 0.5 + sin(time * 25) * 0.23
export const CHECKPOINT_RANGE_X = 48; // Map.CheckCheckPoint: |dx| < 48, or < 10 when running at it faster than 30
export const CHECKPOINT_RANGE_X_FAST = 10;
export const CHECKPOINT_FAST_SPEED = 30;
export const CHECKPOINT_RANGE_Y = 40; // Map.CheckCheckPoint: |checkPoint.Y + 20 - y| < 40
export const CHECKPOINT_Y_OFFSET = 20;
export const CHECKPOINT_SPAWN_UP = 16; // CheckPoint.ActivateInternal: SetCheckPoint(x, y + 16)
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
export const BARREL_GROUND_DAMAGE = 12; // BarrelBlock: DamageGround(12, range)
export const BARREL_UNIT_DAMAGE = 12; // BarrelBlock: ExplodeUnits(12, range * 1.2, range, ..., 200, 300)
export const BARREL_UNIT_RANGE_M = 1.2;
export const BARREL_FORCE = 200;
export const BARREL_EXTRA_Y = 300;
export const BARREL_Y_OFFSET = -6; // BarrelBlock: ExplodeUnits at Y - 6
export const RUN_FRAME_RATE = 0.025; // TestVanDammeAnim.runningFrameRate
export const JUMP_FRAME_RATE = 0.0334; // TestVanDammeAnim.AnimateDeath/Jumping frameRate
export const CLIMB_FRAME_RATE = 0.033; // TestVanDammeAnim.AnimateWallClimb
export const JUDO_FRAME_RATE = 0.045; // BroLee.AnimateAttackForwards: frameRate 0.045 on every frame
export const JUDO_FRAMES = 8; // ... StopBrocAttack once attackFrames reaches 8
export const JUDO_STRIKE_FRAME = 2; // BroLee.Awake: attackForwardsStrikeFrame = 2
export const JUDO_STRIKE_LAST = 5; // BroLee.RunFiring: units are hit while attackFrames <= 5
export const JUDO_HIT = { range: 13, x: 7, y: 7 }; // BroLee.RunFiring: Map.HitUnits(..., 13, X + dir * 7, Y + 7, ...)
export const JUDO_GROUND = { damage: 5, x: 9, y: 6, reach: 8 }; // AnimateAttackForwards: FireWeaponGround(X + dir * 9, Y + 6, dir, 8); groundSwordDamage 5
export const JUDO_COL = 24; // AnimateAttackForwards: column 24 + attackFrames ...
export const TANK_BOX = { halfWidth: 15, height: 28 }; // MookArmouredGuy.Awake: halfWidth 15; TankBroTank.Start: height 28
export const TANK_RUN_FRAME_RATE = 0.0334; // TankBroTank prefab runningFrameRate
export const TANK_DROP_HEIGHT = 200; // GrenadeAirstrike.SpawnTank: screenMaxY + 200
export const TANK_CRUSH = { units: 5, unitsRange: 10, offset: 8, ground: 4, top: 1, groundRange: 11 }; // TankBroTank.AnimateRunning: CrushGroundWhileMoving(4, 5, 10, 8)
export const TANK_EXIT_YI = 130; // MookArmouredGuy.PressHighFiveMelee: DisChargePilot(130)
export const TANK_EXIT_Y = 32; // MookArmouredGuy.DisChargePilotRPC: the pilot appears at Y + 32 ...
export const TANK_EXIT_BOOST = 100; // ... with yI = disChargeYI + 100
export const TURRET_FRAME_RATE = 0.0334; // TankBroTankTurret.frameRate
export const TANK_SHELL = { ox: 17, oy: 33, speed: 150, m: 0.9 }; // TankBroTankTurret.FireShell: (X + dir*17, Y + 33) at (dir*150, 150) * 0.9
export const TANK_CANNON = { ox: 24, oy: 22 }; // TankBroTankTurret.FireCannon: (X + dir*24, Y + 22) at dir*cannonFireSpeed
export const HEAVY_SHELL_DIP = { coast: 0.1, slow: 0.35, fall: 0.4, drag: 1.5, gravity: 600 }; // HeavyShell.RunProjectile
export const SHELL_BLAST = { force: 350, extraY: 300 }; // HeavyShell.MakeEffects: ExplodeUnits(..., 350, 300)
export const TANK_ROCKET_CRUSH = { damage: 15, range: 16, ox: 9 }; // RocketMassive.Bounce: DamageGround(15, Crush, 16, X + dir*9, Y)
export const JUDO_ROW = 7; // ... lowerLeftPixel y = 32 * (8 + attackSpriteRow): sheet rows 7 and 8 from the top

// Design values (not in the original game). Tuned in playtesting; listed in docs/findings.md.
export const TANK_DRIVER_SHIELD = 0.1; // the hidden driver can't be hit (renewed every step he is inside)
export const FOOTBALL = {
  kickX: 220, kickY: 160, bounceM: 0.7, frictionM: 0.85, maxBounces: 3, fuse: 1.6,
  damage: 5, range: 32, blastForce: 20, blastForceExtraY: 300,
};
export const AIRSTRIKE_FUSE = 1.0;
export const JUDO_THROW = { x: 180, y: 240, ox: 10, oy: 10, fuse: 2 }; // the grabbed mook, thrown ahead in an arc
export const JUMP_GRACE = 0.1; // coyote time after walking off a ledge (not in TestVanDammeAnim)
export const LIVES_START = 3;
export const PRISONER_RESCUE_DIST = 16;
export const FLAG_REACH = 12;
export const CORPSE_TIME = 3;
export const BUBBLE_TIME = 17 * 0.0334 + 0.5; // ReactionBubble: "!" pops to frame 10, rests 0.5 s, folds by frame 17
export const FLAG_RAISE_TIME = 0.6; // a checkpoint flag climbing its pole
export const EXTRACTION_TIME = 3;
export const EXPLOSION_DURATION = 0.5;
export const SPEECH_DURATION = 2.2;
export const CAMERA_LERP = 6;
export const CAMERA_Y_OFFSET = 40;
export const SHAKE_TIME = 0.2;
export const SHAKE_AMOUNT = 2;
