export type Team = 'player' | 'enemy';
export type BlastTeam = Team | 'neutral';
export type BlockKind = 'dirt' | 'brick' | 'steel' | 'barrel';
export type UnitKind = 'bro' | 'mook' | 'mook_suicide' | 'mook_bazooka';
export type ProjectileKind = 'bullet' | 'rocket' | 'bomb' | 'football' | 'marker';

export interface Block {
  kind: BlockKind;
  health: number;
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

export interface GameStats {
  units: Record<UnitKind, UnitStats>;
  bullet: BulletStats;
  rocketMook: RocketStats;
  bomb: RocketStats;
  marker: GrenadeStats;
  blocks: Record<BlockKind, { health: number }>;
  barrelRange: number;
  suicide: { range: number; blastForce: number };
}

export interface AiState {
  mode: 'idle' | 'alert' | 'charging' | 'exploded';
  reaction: number;
  burstLeft: number;
  cooldown: number;
  fuse: number;
  patrolTimer: number;
  lostSight: number;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  team: Team;
  x: number; // feet position, world units
  y: number;
  xI: number; // velocity, named as in Broforce
  yI: number;
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
  fireCooldown: number;
  dead: boolean;
  deadTime: number;
  animTime: number;
  ai: AiState | null;
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
}

export const NO_CONTROLS: Controls = {
  left: false, right: false, up: false, down: false, jump: false, fire: false, special: false, dash: false,
};
