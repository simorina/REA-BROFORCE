export type Team = 'player' | 'enemy';
export type BlastTeam = Team | 'neutral';
export type BlockKind = 'dirt' | 'sand' | 'brick' | 'temple' | 'steel' | 'barrel';
export type EnemyKind = 'mook' | 'mook_suicide' | 'mook_bazooka' | 'mook_scout' | 'mook_shield' | 'mook_grenadier' | 'dog' | 'mook_bruiser'
  | 'mook_jetpack' | 'mook_jetpack_bazooka';
export type UnitKind = 'bro' | EnemyKind | 'boss';
/** The bro prefabs a custom bro takes his unit values from (values.json keys). */
export const BRO_BASES = ['bro_base', 'bro_lee', 'bro_soldier', 'bro_in_black', 'bro_rambro', 'bro_ellen'] as const;
export type BroBase = (typeof BRO_BASES)[number];
export type ProjectileKind = 'bullet' | 'rocket' | 'bomb' | 'football' | 'marker' | 'body' | 'shell' | 'bigRocket' | 'rifle' | 'jetBomb' | 'grenade' | 'cricket' | 'neuraliser' | 'revolver' | 'molotov' | 'molotovFire' | 'flame' | 'flameWall' | 'minigun';

export interface Block {
  kind: BlockKind;
  health: number;
  replacement?: Block; // Block.replaceOnCollapse: what takes its place when it is destroyed
}

/** The island's boss (see boss.ts). */
export interface BossState {
  awake: boolean; // asleep until the bro comes near
  enraged: boolean; // under half health: faster bursts and calls, suicide mooks among his guards
  burstClock: number;
  shots: number; // left in the current burst
  shotTimer: number;
  callClock: number;
  calling: number; // -1, or how long he has been waving his guards in
  guards: number[]; // the ids of the guards he called
  flees: boolean; // his Goliath waits further on: beaten, he runs instead of dying
  fleeing: number; // -1, or how long he has been running
  gone: boolean; // he got away
}

export interface UnitStats {
  speed: number;
  jumpForce: number;
  health: number;
  fireRate: number;
  maxFallSpeed: number;
  canWallClimb: boolean;
  canDash: boolean;
  specialAmmo: number;
  hearingX: number; // Unit.hearingRangeX/Y: added to a noise's range (Map.DisturbWildLife)
  hearingY: number;
  canHideInGrass: boolean; // Mook.canHideInGrass
  canBeSetOnFire: boolean; // Mook.canBeSetOnFire / willPanicWhenOnFire
  panicsOnFire: boolean;
}

/** PolymorphicAI fields from each mook's AI component. */
export interface AiStats {
  sightX: number;
  sightY: number;
  attackTime: number; // how long a Fire action holds the trigger
  sightDelay: number; // reaction time after the "!" before the first shot
  delayBetweenFiring: number;
  patrolRadius: number; // patrolBlocksRadius
  minIdleWait: number;
  maxIdleWait: number;
  hidingLookX: number; // hidingLookXRange: how close a hidden mook lets the player get
}

/** PathAgent.capabilities and agentSize (ladders and roof climbing are left out: no such blocks here). */
export interface PathCaps {
  canJump: boolean;
  jumpHeight: number;
  maxDropDistance: number;
  canWallClimb: boolean;
  fudge: boolean;
  agentSize: number;
}

/** MookDoor fields. */
export interface DoorStats {
  spawningRate: number;
  maxMookCount: number;
  chanceSuicide: number;
  maxAlarmed: number;
  closedAtStart: boolean;
  limited: number; // limitedNumberOfMooks, -1 for no limit
  maxOnCollapse: number;
  maxAfterCollapse: number;
  escapeOnFire: boolean; // spawnEscapingUnitsOnFire
  explodeAtEnd: boolean;
  alwaysWalkOut: boolean;
  startSuspicious: boolean;
}

export interface BulletStats {
  damage: number;
  life: number;
}

export interface RocketStats {
  damage: number;
  range: number;
  blastForce: number;
  blastForceExtraY: number;
  life: number;
}

export interface GrenadeStats {
  bounceM: number;
  frictionM: number;
}

/** TankBroTank and its turret's cannon speed. */
export interface TankStats {
  speed: number;
  jumpForce: number;
  maxFallSpeed: number;
  maxDamage: number; // maxDamageBeforeExploding
  countdownThreshold: number; // deathCountdownExplodeThreshold
  cannonFireSpeed: number; // TankBroTankTurret.cannonFireSpeed
}

/** FlameWallExplosion: a fire that spreads cell by cell, `columns` ahead and `rows` up, a step every `rate` s. */
export interface FlameWallStats {
  columns: number; // maxCollumns
  rows: number; // maxRows
  explosions: number; // totalExplosions: no more cells than this
  rate: number; // explosionRate
  damage: number; // damageAmount, Fire
  puffDelay: number; // maxPuffDelay
  puffY: number; // yExplosionOffset
}

export interface GameStats {
  units: Record<EnemyKind, UnitStats>;
  bros: Record<BroBase, UnitStats>; // Double Bro Seven (bro_base) and BroLee (bro_lee)
  ai: Record<EnemyKind, AiStats>;
  paths: Record<EnemyKind, PathCaps>;
  scoutRunSpeed: number; // ScoutMook.runSpeed: a scout runs this fast once alerted
  dogRunSpeed: number; // MookDog.awareRunSpeed
  grenadeMook: { bounceM: number; frictionM: number; gravityM: number; damage: number; range: number; blastForce: number }; // "GrenadeEvilSmall Long fuse"
  door: DoorStats;
  bullet: BulletStats;
  minigun: BulletStats; // the Bruiser's Bullet MookMiniGun
  jetpack: { range: number; blastForce: number; spiralDelay: number }; // MookJetpack.explosionRange, blastForce, spiralDelayDuration
  rocketMook: RocketStats;
  bomb: RocketStats;
  marker: GrenadeStats;
  tank: TankStats;
  tankShell: { damage: number; range: number; life: number }; // HeavyShell "Shell Heavy Tankbro"
  tankRocket: RocketStats & { acceleration: number; crushLayers: number }; // RocketMassive "Rocket Tankbro BIG"
  rifle: { extraFireDelay: number; damage: number; life: number }; // BroniversalSoldier, "Bullet Rambo"
  cricket: { life: number; damage: number; range: number; blastForce: number; projectileSize: number }; // NoisyCricket
  revolver: { damage: number; life: number; maxPenetrations: number; projectileSize: number }; // "Bullet DirtyBrory"
  molotov: { range: number; size: number; gravityM: number }; // "Grenade Molotove"
  molotovFire: { range: number; size: number; gravityM: number; life: number }; // "Grenade Molotov Fire"
  flamethrower: { fireRate: number }; // B.A. Broracus's (BaBroracus.fireRate): Meloni's
  flame: { life: number; damage: number; size: number; frames: number; frameRate: number }; // FlameThrower Bullet, its AnimatedTexture
  flameWall: FlameWallStats; // Ellen Ripbro's flameWallExplosion (its puffs are effects.json's flameWall*)
  mech: { health: number }; // GoliathMech
  blocks: Record<BlockKind, { health: number }>;
  barrelRange: number;
  suicide: { range: number; blastForce: number };
  grass: { health: number; width: number; height: number }; // DoodadGrass
}

export type MentalState = 'idle' | 'suspicious' | 'alerted' | 'hiding' | 'panicking' | 'attracted';
export type AiActionType =
  | 'wait' | 'move' | 'fire' | 'look' | 'greet' | 'question' | 'face' | 'becomeIdle' | 'laugh' | 'jump' | 'special2'
  | 'followPath';

/** PolymorphicAI's ActionObject: a queued step with a duration and, for move/face/followPath, a grid point. */
export interface AiAction {
  type: AiActionType;
  duration: number;
  c: number;
  r: number;
}

/** PathfindingController's PathPoint: a grid cell and how it is reached. */
export type PathMoveMode = 'normal' | 'wallClimbLeft' | 'wallClimbRight' | 'jump';
export interface PathPoint {
  c: number;
  r: number;
  mode: PathMoveMode;
  g: number; // gValue
  f: number; // fScore
  h: number; // fScoreHeuristic
  previous: PathPoint | null;
}

/** PathAgent's state between steps. */
export interface PathAgentState {
  path: PathPoint[] | null;
  index: number; // currentNodeIndex
  stuck: number; // timeStuckOnThisNode
  reachedCenter: boolean;
  startX: number; // tileStartPos
  startY: number;
  agentX: number; // currentAgentPos (y + 8)
  agentY: number;
  targetX: number; // currentTargetWorldPoint
  targetY: number;
  direction: -1 | 0 | 1;
  jitter: -1 | 0 | 1; // jitterPreventionLastMoveDirection
}

export interface AiState {
  mental: MentalState;
  queue: AiAction[];
  walkDir: -1 | 1;
  setup: boolean;
  grid: Array<{ c: number; r: number }>; // availableGridPoints: where the mook may patrol
  blockOffset: number; // Map.GetUnitXOffset: spreads mooks standing on the same column
  seenPlayer: boolean;
  thoughtsSinceSeen: number;
  suspiciousThinks: number;
  stuckTime: number;
  sameSpotTime: number;
  lastC: number;
  lastR: number;
  bubble: '!' | '?' | null;
  bubbleTime: number;
  attractC: number; // PolymorphicAI.attractPoint
  attractR: number;
  wasJump: boolean;
  agent: PathAgentState;
  repathCount: number;
  speed: number | null; // the mook's speed when something changed it (ScoutAI: runSpeed)
  // ScoutAI
  startC: number | null; // startPoint: where the player was when the scout saw him
  startR: number;
  interest: number | null; // mookInterestPoint: the door the scout runs to
  runDir: -1 | 0 | 1;
  alertDelay: number;
  rambro: number; // ramboBubble: seconds left, and its life
  rambroLife: number;
  // SuicideAI / MookSuicide
  litFuse: boolean;
  suicideDelay: number;
  suicideTimer: number;
  deathFuse: number;
  exploded: boolean;
  droppedGrenade: boolean; // MookGrenadier.DropDeathGrenade, once
  attackingDir: -1 | 0 | 1; // BigGuyAI.attackingDirection: the way the Bruiser keeps shooting
}

/** BroLee's forward strike in progress: Putin's judo throw. */
export interface JudoAttack {
  frame: number; // attackFrames
  counter: number;
  row: 0 | 1; // attackSpriteRow: which of the two strike animations
  hit: boolean; // attackHasHit: a mook was grabbed or a block struck
  struck: boolean; // the strike frame's FireWeaponGround has been tried
}

export interface Unit {
  id: number;
  kind: UnitKind;
  team: Team;
  x: number; // feet position, world units
  y: number;
  xI: number; // velocity, named as in Broforce
  yI: number;
  xIBlast: number; // TestVanDammeAnim.xIBlast: knockback and recoil, added to xI and decaying on its own
  facing: 1 | -1;
  health: number;
  stats: UnitStats;
  onGround: boolean;
  lastGroundedTime: number;
  wallClimbing: boolean;
  climbTimer: number;
  jumpTime: number;
  jumpBuffer: number;
  dashing: boolean;
  fireCooldown: number; // the bro's kick interval
  fireCounter: number; // TestVanDammeAnim.RunFiring, used by mooks
  fireDelay: number;
  wasFire: boolean;
  invulnerable: number; // seconds left; TestVanDammeAnim.SetInvulnerable
  ducking: boolean;
  special2: number; // MookSuicide.AnimateSpecial2: seconds into the idle special, or -1
  blindTime: number; // Mook.blindTime: blinded or panicking for this long
  burnTime: number; // Mook.burnTime: on fire for this long (it runs down twice as fast while alive)
  burnDamage: number; // Mook.burnDamage: dealt when the fire goes out
  burnCounter: number;
  waveTime: number; // ScoutMook.waveTime: waving the others over instead of shooting
  exitDoor: { x: number; dir: number } | null; // Mook.exitingDoor: walking out of a mook door to exitDoorX
  originDoor: number; // index of the MookDoor it counts towards (-1: none)
  flex: { frame: number; counter: number; block: boolean } | null; // GestureElement.Gestures.Flex in progress
  attack: JudoAttack | null; // the judo throw in progress
  attackRow: 0 | 1; // BroLee.attackSpriteRow, kept between strikes
  burstLeft: number; // BroniversalSoldier.burstShotsLeft
  burstCounter: number; // ... burstFireCounter
  gunFrame: number; // TestVanDammeAnim.gunFrame: the muzzle flash after a shot, counting down
  gunCounter: number;
  dead: boolean;
  deadTime: number;
  gibbed: boolean; // blown to pieces: no corpse is left
  reported: { death: boolean; gib: boolean }; // the world has announced these
  animTime: number;
  ai: AiState | null;
  boss: BossState | null; // Jeffrey Epstein's mind, on the boss only
  shield: number; // MookRiotShield: what his shield can still take (0: he has none)
  jet: JetpackState | null; // MookJetpack's jetpack
}

/** MookJetpack: its jetpack, the countdown of a wrecked one, its spiral down and the fuse that blows it up. */
export interface JetpackState {
  on: boolean; // jetpacksOn
  height: number; // jetPackHeight: 48 over the ground it started on
  delay: number; // jetpacksDelay: once alerted, it lights after this
  crash: number; // spiralDelay: counting down to the spiral (negative: none)
  crashDelay: number; // spiralDelayDuration
  spiral: boolean; // spiralling
  spiralTime: number;
  fuse: number; // deathCounter: counting down to the blast (negative: none)
  exploded: boolean;
  flameCounter: number;
}

/** Neuraliser: the line from where Bro In Black used it to its tip (the projectile's x), growing then flashing. */
export interface NeuraliserBeam {
  startX: number;
  dir: 1 | -1;
  started: boolean; // EffectFirstUpdate has run
  growing: boolean;
  growDelay: number;
  steps: number; // totalGrowCount
  flash: number; // flashTime left once it has stopped growing
  flicker: number; // colorCounter: odd black, even white
}

export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  x: number;
  y: number;
  xI: number;
  yI: number;
  life: number;
  bounces: number;
  dead: boolean;
  warning?: number; // Grenade.panicCounter
  body?: EnemyKind; // a 'body': the mook the judo throw grabbed
  call?: 'tank' | 'jet' | 'nuke'; // a 'marker' that calls in special events
  beamX?: number; // a 'cricket': where its last beam puff was left (NoisyCricket.lastBeamPos)
  beam?: NeuraliserBeam; // a 'neuraliser': its beam, from startX to the projectile's x
  pierced?: number[]; // a 'revolver': the units it has gone through (BulletSnakeBroskin.hitUnits)
  power?: number; // a 'revolver': its damage left, one less after each unit
  flame?: { counter: number; count: number }; // a 'molotovFire': GrenadeMolotovFire.flameCounter / flameCount
  dip?: number; // HeavyShell.dipCounter
  crush?: number; // RocketMassive.crushWallLayers left
  variant?: number; // a 'flame': which of FlameThrower Bullet 1-3 it is (drawn green, white, red)
  wall?: FlameWall; // a 'flameWall': FlameWallExplosion's spread
}

/** A cell of a FlameWallExplosion that caught fire (FlashBangPoint): `dc` is the way it spread, sideways. */
export interface FlamePoint {
  c: number;
  r: number;
  dc: number;
}

/** FlameWallExplosion's state: its band of cells, the cells burning at its front and those already burnt. */
export interface FlameWall {
  col: number;
  row: number;
  dir: 1 | -1; // forceDirection
  started: boolean;
  minC: number;
  maxC: number; // exclusive
  minR: number;
  maxR: number; // exclusive
  points: FlamePoint[]; // activeGridPoints
  used: Set<number>; // usedGridPoints
  counter: number;
  left: number; // explosionsRemaining
  time: number;
  maxTime: number;
}

export interface Controls {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  fire: boolean;
  special: boolean;
  dash: boolean;
  gesture: boolean; // the flex
}

export const NO_CONTROLS: Controls = {
  left: false, right: false, up: false, down: false, jump: false, fire: false, special: false, dash: false, gesture: false,
};
