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
// Brononymous (Bro In Black): UseFire / FireWeapon, and NoisyCricket.Update / RunBeam / MakeEffects
export const CRICKET = {
  ox: 14, oy: 9.5, speed: 700, fireDelay: 0.2, kickY: 150, kickX: 150,
  timeScale: 0.99, // NoisyCricket.Update: t = dt * 0.33, run three times; life -= t * 3
  beamStep: 16, killRangeM: 0.7, forceM: 40, extraY: 300, burnRangeM: 1.4, noise: 2,
};
// Neuraliser: from (X + dir * 4, Y + height + 3), a 16-unit step every ~0.02 s, up to 32 steps or 240 units
export const NEURALISER = {
  ox: 4, oy: UNIT_BOX_HEIGHT + 3, step: 16, stepTime: 0.016, stepCost: 0.02, firstDelay: 0.02, maxSteps: 32, reach: 240,
  startRange: 16, range: 24, blindTime: 9, flash: 0.11,
};
// Samuel's special: he becomes Django for this long (our design), and says the line
export const DJANGO = { time: 12, line: 'The D is silent.' };
// DirtyHarry (Dirty Brorry): UseFire / FireWeapon / Update, his prefab's fireRate, and BulletSnakeBroskin.Update
export const REVOLVER = {
  ox: 14, oy: 8.5, speed: 750, jitter: 10, fireDelay: 0.15, fireRate: 0.1, shots: 6,
  reload: 1, reloadFire: 0.86, open: 0.6, close: 0.1, openFrame: 11, timeScale: 0.99,
};
// Rambro's M60, Che's: TestVanDammeAnim.UseFire, from (X + dir * 10, Y + 8) at 400, Random.Range(-20, 20) off level
export const M60 = { ox: 10, oy: 8, speed: 400, jitter: 20 };
// BaBroracus.UseFire / FireWeapon: two flames a squirt, from (X + dir*11, Y + 6) at dir*120 + xI, up to 30 off level, and
// (X + dir*11, Y + 7) at dir*150 + xI, up to 35 off; FlameBullet.HitUnits: Map.HitUnits(.., Fire, 8, X, Y, ..)
export const FLAMETHROWER = { ox: 11, shots: [{ oy: 6, speed: 120, spread: 30 }, { oy: 7, speed: 150, spread: 35 }], variants: 3, hitRange: 8 };
// EllenRipbro.UseSpecial: the FlameWallExplosion from (X + dir*5, Y + 9). FlameWallExplosion.CreateFlashBangPoint: each cell
// hurts what is 12 around (its centre, its bottom + 3) and puts out the shots 9 around the cell it spread from; its puff
// sits on the cell's bottom + 4 and drifts at dc*66; HitUnits' xI is dc*25. Update steps at most 0.0334 s.
export const FLAME_WALL = { ox: 5, oy: 9, hitRange: 12, hitY: 3, quenchRange: 9, puffY: 4, drift: 66, hitXI: 25, maxStep: 0.0334 };
// GrenadeMolotov: RunMovement / Death; GrenadeMolotovFire: Update / Death. The fuse is ours (it bursts on contact anyway).
export const MOLOTOV = {
  fuse: 4, touch: 24, touchDamage: 1, burst: 12, burstDamage: 3, flameY: 2,
  firstAngle: 0.3, firstAngleRand: 0.5, gaps: [0.8, 1.6, 2.4], gapRand: 0.2, speed: 210, speedRand: 50,
};
export const MOLOTOV_FIRE = { tick: 0.0334, tickCost: 0.01667, every: 4, flyRange: 16, flyDamage: 1, landRange: 24, landDamage: 1 };
export const RIFLE = { ox: 14, oy: 8.5, speed: 420, jitter: 10, burst: 2, burstGap: 0.07 }; // BroniversalSoldier.UseFire / Update / FireWeapon
export const GUN_FRAME_RATE = 0.0334; // TestVanDammeAnim.RunGun
export const SHIELD = { points: 36, knock: 15 }; // MookRiotShield.Damage: past 35 of shieldDamage it goes; a stopped shot knocks him (xI * 0.05, 15)
export const GRENADIER = { ox: 8, oy: 24, x: 130, y: 130 }; // MookGrenadier.AnimateThrowingHeldObject: from (X + dir*8, Y + 24) at (dir*130, 130), times the distance
// MookBigGuy: UseFire's minigun from (X + dir*17, Y + 9) at dir*400, yI Random.Range(0, 45) - 15; Knock keeps a twentieth
// of the push (to 200), half of it as blast (to 10) and a fifth of the lift (to 300); Damage: a hit at half health or worse,
// or of 10 or more, stumbles him and holds his fire (hurtStumbleFireDelay)
export const BRUISER = { ox: 17, oy: 9, speed: 400, spreadFrom: -15, spreadCount: 45, knockX: 20, knockMax: 200, blastMax: 10, liftM: 5, liftMax: 300, stumble: 0.15, stumbleDamage: 10 };
// MookJetpack: Start puts its hover 48 over the ground; Update lights the jetpack jetpacksDelay after it is alerted;
// CalculateMovement: under the hover it thrusts up 300/s², in the 12 around it it eases (yI * (1 - 3t) past 50) and sinks
// 250/s², above it it sinks 400/s² with drag 4; sideways it drifts to a stop (1 - 6t). A wrecked jetpack sputters
// spiralDelayDuration (four times that in the air), then it spirals; Land with no health left: 0.8 s of sputter, then the
// spiral; deathCounter 0.7 s from the crash to the blast. Ours: the spiral is a jolt up and back, then a fall.
export const JETPACK = {
  height: 48, delay: 0.55, thrust: 300, band: 12, below: 2, ease: 3, easeAbove: 50, sink: 250, above: 400, aboveDrag: 4, airDrag: 6,
  airCrashM: 4, deadCrash: 0.8, fuse: 0.7, spiralUp: 240, spiralBack: 120, spiralMax: 2.5, blastY: 5, flameEvery: 0.1,
};
// MookNinjaAI.LookForEnemy: hidden, he springs on a bro within 48 and 20 of (X, Y + 8)
export const NINJA = { lookX: 48 };
// DeadManSwitchAlarmTrap.Update: red warnings every 0.067 s till the alarm. AlarmSystem ("Alarm Megaphones"): the siren
// every alarmRate (DisturbWildLife 200 and a flashbang, ours: the mooks within 200 come running), and paratrooperRate
// (the first a third of it in) four mooks at x + (i - 1.5) * 32 from 16 over the screen, if the spot is on screen (256)
// with open sky 256 up at x and x +- 16. Ours: three waves at most.
export const ALARM = { warnEvery: 0.067, alertRange: 200, visible: 64, dropVisible: 256, sky: 256, drop: 4, spacing: 32, dropY: 16, waves: 3 };
// Mine: stepped on (a foot within 10 above its block, on rays at X and X +- 3), it goes off detonationTime later;
// Explode: DamageGround(12, range 20) at its centre, ExplodeUnits(20, 40, 40, 200, 300) 6 below it, DisturbWildLife 120.
// MineFieldSign plants it up to two blocks either side of the sign.
export const MINE = { fuse: 0.3, range: 20, groundDamage: 12, unitDamage: 20, force: 200, extraY: 300, unitY: -6, noise: 120, trigger: 10, feet: 3, signReach: 2 };
// MookMortar.UseFire: FireWeapon(X + dir*17, Y + 6.5, 0, 450) and DisturbWildLife 40; RocketLaunch.MakeEffects
// (seekPlayer): a RocketBombardment from GetScreenMaxY() + 500 at -300 over a player, 16 * (offsetAmount % 7) * offsetSide
// to one side, rounded to a block; offsetSide flips and offsetAmount grows by Random.Range(1, 3) each time
export const MORTAR = { ox: 17, oy: 6.5, speed: 450, noise: 40, skyY: 500, fall: 300, spread: 16, spreadMod: 7 };
export const DOG = { bite: 3, range: 6 }; // MookDog.RunFiring: Map.HitLivingUnits(3, Melee, 6, X, Y + 4)
export const JET_ROCKET = { ox: [32, 8], oy: -5, x: 450, y: -285, jitter: 12 }; // HarrierJet.Update: two shots from (X+32, Y-5), (X+8, Y-5) at (450, -285) + insideUnitCircle * 12
export const JET_DESCENT = { slow: 40, slowZone: 48 }; // HarrierJet.Start: yI -40 over its last 48 px
export const TANK_COUNTDOWN = { first: 0.4667, step: 0.2667, speedup: 4 }; // MookArmouredGuy.Update: deathCountdownCounter
export const TANK_EMPTY_LIMIT = 60; // MookArmouredGuy.Damage: shieldDamage > 60
export const TANK_GIB_YI = 180; // MookArmouredGuy.Gib: DisChargePilot(180)
export const TANK_GIB = { ground: 15, damage: 20, killRange: 32, force: 200, extraY: 150, yOffset: 6 }; // MookArmouredGuy.Gib: ExplodeUnits(20, ..., 200, 150, -15); DamageGround(15, ...)
export const TANK_GIB_RANGE = { massive: 72, small: 36, smallUnits: 48 }; // ... range 72 after the countdown, else 36 (ground) / 48 (units)
export const JUDO_ROW = 7; // ... lowerLeftPixel y = 32 * (8 + attackSpriteRow): sheet rows 7 and 8 from the top

// Design values (not in the original game). Tuned in playtesting; listed in docs/findings.md.
export const TANK_DRIVER_SHIELD = 0.1; // the hidden driver can't be hit (renewed every step he is inside)
export const TANK_EJECT_INVULNERABLE = 0.5; // the driver thrown clear by the gib outlives its blast
export const GRENADIER_THROW_DELAY = 1.5; // a grenade, then a breath
export const GRENADIER_REACH = 160; // full throwing speed reaches the bro this far off (0.5x to 1.5x of it)
export const GRENADE_FUSE = 2.5; // the long fuse
export const GRENADE_EXTRA_Y = 200; // its blast's upward kick
export const DOG_BITE_COOLDOWN = 0.5;
export const JET_BOX = { halfWidth: 24, height: 34 }; // the Harrier's landing gear and fuselage (it stands on its wheels)
export const JET_FAST_DESCENT = 160; // the jet's way down before its last 48 px
export const JET_ENTRY = 32; // it appears this far above the screen top
export const JET_FLY = { x: 110, y: 80, accel: 400 }; // piloted flight (the Harrier was never player-driven)
export const JET_ROCKET_COOLDOWN = 0.4; // rockets instead of its heavy bullets, slower than its 0.133 s
export const JET_BOMB = { oy: -4, yI: -50, cooldown: 0.5 };
export const JET_FUEL = 20;
export const JET_LEAVE_SPEED = 80; // an empty, dry jet rises away
/** Epstein's Goliath (GoliathMech): its health comes from the prefab and its patterns from GoliathMechAI (the stomp's
 *  8 / 16 column reach, the four rockets at -300 over 15 columns); everything else is ours. */
export const MECH = {
  box: { halfWidth: 44, height: 64 }, // its body in the 128 x 70 frame
  line: "This time you're finished!",
  wake: { x: 240, y: 160 },
  arena: 512, // it keeps within this of where it stands
  pause: [1.2, 0.7] as const, // calm, enraged (under half health)
  pattern: [['bombard', 'stomp', 'missiles', 'stomp'], ['stomp', 'bombard', 'stomp', 'sky']] as const,
  guns: [{ x: 44, y: 18 }, { x: -36, y: 18 }] as const, // its chain guns, from its feet
  fire: { time: 2, every: [0.12, 0.08] as const, speed: 300, maxAim: 0.6 },
  stomp: {
    rise: 80, riseSpeed: 200, glide: 180, reach: [128, 256] as const, fall: 520,
    blast: { damage: 20, range: 80, blastForce: 40, blastForceExtraY: 300, life: 0 }, // kills 36 px past its feet
  },
  missiles: { count: 4, gap: 0.3, speed: 160, maxAim: 0.8, from: [{ x: 23, y: 51 }, { x: -19, y: 51 }] as const },
  sky: { count: 4, spread: 240, gap: 60, speed: 300 },
  dying: { time: 1.6, every: 0.2, blast: { damage: 30, range: 64, blastForce: 40, blastForceExtraY: 400, life: 0 } },
  flash: 0.08,
  turnRate: 0.04, // a turning frame
};
/** Jeffrey Epstein, the island's boss. His guard call is MookGeneral.UseSpecial's; everything else is ours. */
export const BOSS = {
  health: 120,
  speed: 60,
  line: 'Nobody leaves my island!',
  fleeLine: "This isn't over!", // beaten with his Goliath still to come
  fleeSpeed: 200,
  fleeTime: 1.5, // then he is gone
  wake: { x: 176, y: 96 }, // the bro this close wakes him
  near: 56, // he backs off from the bro closer than this ...
  far: 128, // ... and comes after him past this
  burst: 3,
  shotGap: 0.12,
  firstBurst: 0.8, // after waking
  burstEvery: [1.6, 1.0] as const, // calm, enraged (under half health)
  callEvery: [8, 5] as const,
  callTime: 0.5, // waving them in, standing still
  maxGuards: 6, // alive at once
  guardSuicide: [0, 0.33] as const, // odds of a suicide mook among the guards (Map.MapData.suicideMookSpawnProbability)
  bulletSpeed: 260,
  maxAim: 0.5, // radians above or below level
};
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
// ours: the flame wall shakes the screen each time it spreads (SortOfFollow.Shake(0.2)); a fifth of our 2-pixel shake would not show
export const FLAME_WALL_SHAKE = 0.5;
