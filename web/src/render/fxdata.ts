import type { BlockKind } from '../engine/types';
import type { ShurikenData } from './fx/shuriken';

/** background.json and effects.json, as written by the extractor's effects module. */
export type RGBA = [number, number, number, number];

export interface SpriteRef {
  file: string;
  w: number; // world size
  h: number;
  offset: [number, number, number]; // SpriteSM offset; z orders the parallax layers (bigger is further)
  rect?: [number, number, number, number]; // x, y from the top, w, h in the texture (absent: the file is the crop)
  pos?: [number, number];
}

export interface BgSprite extends SpriteRef {
  name: string;
  parallax: [number, number]; // ParallaxFollow.parallaxXM / parallaxYM
}

export interface BackgroundData {
  theme: string;
  cloudScatter: 'None' | 'Stormy' | 'BlueSky';
  sky: BgSprite;
  clouds: BgSprite[];
  near: BgSprite[];
  mid: BgSprite[];
  distant: BgSprite[];
}

/** ParticleCollisionAnimator fields (flags as 0/1). */
export interface CollisionAnimator {
  collidesWithGround: number;
  leavesDecals: number;
  minEnergyDecal: number;
  collisionEnergyLoss: number;
  collisionSpeedM: number;
  gravity: number;
  growSizeM: number;
  dampeningM: number;
  randomMotion: number;
  randomMotionM: number;
  linearFade: number;
  fadeColor: number;
  fadeSize: number;
  trailBlood: number;
  trailDust: number;
  bloodTrailFrequency: number;
  particleEnergyLossM: number;
  createSplashParticles: number;
  createSplashParticlesAndDie: number;
}

export interface EmitterDef {
  name: string;
  texture: string;
  tiles: [number, number]; // ParticleRenderer UV animation
  cycles: number;
  size: [number, number];
  energy: [number, number];
  collision?: CollisionAnimator;
  animator?: { force: [number, number]; damping: number; sizeGrow: number; doesAnimateColor: boolean; colors: RGBA[] };
  worldCollider?: { bounceFactor?: number; collisionEnergyLoss?: number; minKillVelocity?: number };
}

export interface PuffDef extends SpriteRef {
  name: string;
  rect: [number, number, number, number];
  frameRate: number;
  spriteSize: number;
  frames: number;
  rows: number;
  loopStartFrame: number;
  loopEndFrame: number;
  numLoops: number;
  requiresGroundBelow: number;
  pauseFrame: number;
  pauseTime: number;
  useGravity: number;
  gravityM: number;
}

export interface BubbleDef extends SpriteRef {
  rect: [number, number, number, number];
  pos: [number, number];
  life: number;
  tweenTime: number;
  flash: number;
  sinSpeed: number;
  animatedBubble: number; // 0: a still picture that tweens in and out (the scout's Rambro face)
  animatedRestFrame: number;
  animatedFinishFrame: number;
  restTime: number;
}

export interface GrassSprite extends SpriteRef {
  rect: [number, number, number, number];
  intensity: number;
}

export interface BlockFx {
  dropDirt: boolean;
  customColors: [RGBA, RGBA] | null;
  blood: Partial<Record<'top' | 'bottom' | 'left' | 'right', SpriteRef & { angle: number }>>;
}

export interface GibDef {
  name: string;
  pos: [number, number];
  rect: [number, number, number, number]; // in the unit's own sheet
  w: number;
  h: number;
  size: number;
  lifeM: number;
  randomLifeM: number;
  frictionM: number;
  drag: number;
  bounceM: number;
  gravityM: number;
  forceMultiplier: number;
  hasBloodTrail: number;
  bloodyM: number;
  onlySmallBloodParticles: number;
  rotationSpeedMultiplier: number;
  lifeLossOnBounce: number;
  lifeLossM: number;
  xI_randomOnBounce: number;
  shrink: number;
  deathOnBounce?: number; // Shrapnel.deathOnBounce (the plumes)
}

/** A Shrapnel prefab (the door's sparks): Gib physics without the Gib's launch spread or blood. */
export interface ShrapnelDef extends SpriteRef {
  name: string;
  rect: [number, number, number, number];
  size: number;
  lifeM: number;
  randomLifeM: number;
  frictionM: number;
  drag: number;
  bounceM: number;
  gravityM: number;
  rotationSpeedMultiplier: number;
  lifeLossOnBounce: number;
  lifeLossM: number;
  xI_randomOnBounce: number;
  shrink: number;
}

/** EffectsController's Plume: a shrapnel spark that drags a fire trail and dies on its first bounce. */
export interface PlumeDef extends ShrapnelDef {
  deathOnBounce: number;
  destroyInsideWalls: number;
}

/** ExplosionRangePop: a white ring as big as the blast, one 128-unit column per 8 units of range over 24. */
export interface RangePopDef extends SpriteRef {
  rect: [number, number, number, number];
  delayBeforeAppear: number;
  delayBeforeDisappear: number;
  grow: number;
  columns: number; // frames across the texture
}

/** What a blast throws besides the explosion: MookSuicide's or GrenadeAirstrike's shrapnel, smoke and flames. */
export interface BlastFx {
  shrapnel: ShrapnelDef;
  smoke: PuffDef[];
  range: number;
  fire?: string[]; // FlameDef names
  explosionSize?: 'small' | 'medium' | 'large' | 'massive' | 'tiny' | 'largeNoWhite';
}

/** A FlickerFader: one texture per frame, packed by the extractor into a strip. */
export interface FlameDef {
  name: string;
  file: string;
  frames: number;
  frameW: number;
  frameH: number;
  frameRate: number;
  startIndex: number;
  w: number;
  h: number;
  offset: [number, number, number];
}

/** DoodadMookDoor: frame and inside, as built and after DestroyDoor, and its final explosion. */
export interface DoorFx {
  frame: SpriteRef;
  frameDestroyed: SpriteRef;
  inside: SpriteRef;
  insideDestroyed: SpriteRef;
  smoke: PuffDef[];
  sparks: ShrapnelDef;
  fire: string[]; // FlameDef names
}

export const EMITTER_KEYS = [
  'dirtDots', 'dirtSmall1', 'dirtSmall2', 'dirtSmall3', 'dirtSmallWhite', 'dirtSmallerWhite', 'bloodBig', 'bloodSmall',
  'bloodDots', 'sparkShower', 'sparkFloat', 'dust',
] as const;
export const PUFF_KEYS = [
  'bloodGush1', 'bloodGush2', 'bloodGush3', 'bloodSpurt1', 'bloodSpurt2', 'bloodSpurt3', 'bloodSplash1', 'bloodSplash2',
  'bloodSmallSplash1', 'bloodSmallSplash2', 'bloodTinySplash1', 'bloodTinySplash2', 'footPoof1', 'footPoof2',
  'footPoof3', 'landPoof1', 'landPoof2', 'muzzleFlash', 'smokeSmall1', 'smokeSmall2', 'smokeSmall3',
  'cricketBeam', 'cricketBall', // the Noisy Cricket's Puff prefabs
] as const;
export const STAR_KEYS = ['stunnedStars1', 'stunnedStars2', 'stunnedStars3'] as const;
export type EmitterKey = (typeof EMITTER_KEYS)[number];
export type PuffKey = (typeof PUFF_KEYS)[number];
export type StarKey = (typeof STAR_KEYS)[number];

export interface EffectsData {
  colors: Record<'dirt' | 'flesh' | 'sand' | 'bone', [RGBA, RGBA]>;
  bloodColor: RGBA;
  emitters: Record<EmitterKey, EmitterDef>;
  puffs: Record<PuffKey, PuffDef>;
  twoLayerPuffs: Record<StarKey, PuffDef>;
  bubbles: Record<'!' | '?' | 'rambro', BubbleDef>;
  grass: { health: number; backing: GrassSprite; blades: GrassSprite[] };
  blocks: Record<BlockKind, BlockFx>;
  gibs: GibDef[];
  door: DoorFx;
  flames: FlameDef[]; // Mook.flames
  scoutDisarmed: string; // ScoutMook.disarmedMaterial's sheet
  rangePop: RangePopDef;
  plume: PlumeDef;
  suicide: BlastFx;
  airstrike: BlastFx;
  barrelFullExplosion: boolean; // BarrelBlock.fullExplosion
}

function need(obj: Record<string, unknown>, keys: readonly string[], where: string): void {
  const missing = keys.filter((k) => !(k in obj));
  if (missing.length > 0) throw new Error(`${where} lacks: ${missing.join(', ')}`);
}

export function parseEffects(raw: unknown): EffectsData {
  const e = raw as EffectsData;
  if (typeof raw !== 'object' || raw === null) throw new Error('effects.json is not an object');
  need(e as unknown as Record<string, unknown>, ['colors', 'bloodColor', 'emitters', 'puffs', 'twoLayerPuffs', 'bubbles', 'grass',
    'blocks', 'gibs', 'door', 'flames', 'scoutDisarmed', 'rangePop', 'plume', 'suicide', 'airstrike', 'barrelFullExplosion'],
  'effects.json');
  need(e.emitters, EMITTER_KEYS, 'effects.json emitters');
  need(e.puffs, PUFF_KEYS, 'effects.json puffs');
  need(e.twoLayerPuffs, STAR_KEYS, 'effects.json twoLayerPuffs');
  need(e.bubbles, ['!', '?', 'rambro'], 'effects.json bubbles');
  need(e.door as unknown as Record<string, unknown>, ['frame', 'frameDestroyed', 'inside', 'insideDestroyed', 'smoke', 'sparks', 'fire'],
    'effects.json door');
  need(e.blocks, ['dirt', 'sand', 'brick', 'temple', 'steel', 'barrel'], 'effects.json blocks');
  return e;
}

/** shuriken.json: the ParticleSystem prefabs (shader explosions and the plumes' fire trail). */
export function parseShuriken(raw: unknown): ShurikenData {
  if (typeof raw !== 'object' || raw === null) throw new Error('shuriken.json is not an object');
  const s = raw as ShurikenData;
  need(s as unknown as Record<string, unknown>, ['systems', 'textures'], 'shuriken.json');
  need(s.systems, ['tiny', 'small', 'medium', 'large', 'fireTrail'], 'shuriken.json systems');
  for (const [key, defs] of Object.entries(s.systems)) {
    for (const d of defs) {
      const m = d.renderer.material;
      if (!(m.mainTex in s.textures) || !(m.ramp in s.textures)) throw new Error(`shuriken.json ${key}/${d.name}: unknown texture`);
      if (m.worldToPixel !== 1) throw new Error(`shuriken.json ${key}/${d.name}: _WorldToPixel ${m.worldToPixel} is not supported`);
    }
  }
  return s;
}

export function parseBackground(raw: unknown): BackgroundData {
  if (typeof raw !== 'object' || raw === null) throw new Error('background.json is not an object');
  const b = raw as BackgroundData;
  need(b as unknown as Record<string, unknown>, ['sky', 'clouds', 'near', 'mid', 'distant', 'cloudScatter'], 'background.json');
  return b;
}

/** Every image file the effects and the backgrounds reference. */
export function effectFiles(fx: EffectsData, ...backgrounds: BackgroundData[]): string[] {
  const files = new Set<string>();
  for (const e of Object.values(fx.emitters)) files.add(e.texture);
  for (const p of [...Object.values(fx.puffs), ...Object.values(fx.twoLayerPuffs), ...Object.values(fx.bubbles)]) files.add(p.file);
  files.add(fx.grass.backing.file);
  for (const g of fx.grass.blades) files.add(g.file);
  for (const b of Object.values(fx.blocks)) for (const s of Object.values(b.blood)) if (s) files.add(s.file);
  const d = fx.door;
  for (const s of [d.frame, d.frameDestroyed, d.inside, d.insideDestroyed, ...d.smoke, d.sparks, ...fx.flames]) files.add(s.file);
  files.add(fx.scoutDisarmed);
  files.add(fx.rangePop.file);
  files.add(fx.plume.file);
  for (const b of [fx.suicide, fx.airstrike]) for (const s of [b.shrapnel, ...b.smoke]) files.add(s.file);
  for (const bg of backgrounds) for (const s of [bg.sky, ...bg.clouds, ...bg.near, ...bg.mid, ...bg.distant]) files.add(s.file);
  return [...files].sort();
}
