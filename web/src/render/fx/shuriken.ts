/**
 * A port of the parts of Unity's ParticleSystem (Shuriken) that Broforce's explosions and fire trails use:
 * start values, Sphere/Circle/Cone shapes, rate over time and distance, bursts, size/rotation/velocity/force
 * over lifetime, limit velocity, Birth sub-emitters (inheriting size) and custom data curves. The data comes
 * from the prefabs (shuriken.json); pixelShader.ts draws the particles the way Unlit/PixelExplosion does.
 */
export type Key = [number, number, number, number]; // time, value, inSlope, outSlope

/** MinMaxCurve: 0 constant, 1 curve x scalar, 2 between two curves x scalar, 3 between two constants. */
export interface Curve {
  mode: 0 | 1 | 2 | 3;
  scalar: number;
  min: number;
  maxCurve: Key[];
  minCurve: Key[];
}

export interface ShapeDef {
  type: number; // ParticleSystemShapeType: 0 Sphere, 2 Hemisphere, 4 Cone, 10 Circle
  radius: number;
  radiusThickness: number;
  arc: number; // degrees
  arcMode: number; // 0 random, 3 burst spread
  arcSpread: number;
  angle: number; // cone angle, degrees
  length: number;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler degrees
  scale: [number, number, number];
  randomDirection: number;
  sphericalDirection: number;
  alignToDirection: boolean;
}

export interface BurstDef {
  time: number;
  count: Curve;
  cycles: number;
  interval: number;
}

export interface MaterialDef {
  name: string;
  mainTex: string;
  ramp: string;
  brightness: number;
  worldToPixel: number;
}

export interface SystemDef {
  name: string;
  parent: number;
  isSub: boolean;
  position: [number, number, number];
  duration: number;
  looping: boolean;
  startDelay: Curve;
  worldSpace: boolean;
  simulationSpeed: number;
  initial: {
    lifetime: Curve;
    speed: Curve;
    size: Curve;
    sizeY: Curve;
    size3D: boolean;
    rotation: Curve;
    gravity: Curve;
    maxParticles: number;
  };
  shape: ShapeDef | null;
  emission: { enabled: boolean; rate: Curve; rateOverDistance: Curve; bursts: BurstDef[] };
  size: { curve: Curve; y: Curve; separateAxes: boolean } | null;
  rotation: { curve: Curve } | null;
  velocity: { x: Curve; y: Curve; worldSpace: boolean; speedModifier: Curve | null } | null;
  force: { x: Curve; y: Curve; worldSpace: boolean; randomizePerFrame: boolean } | null;
  clamp: { magnitude: Curve; x: Curve; y: Curve; separateAxis: boolean; dampen: number; drag: Curve | null } | null;
  sub: Array<{ system: number; type: number; properties: number }>;
  custom: [Curve[], Curve[]];
  renderer: { sortMode: number; streams: number[]; sortingFudge: number; material: MaterialDef };
}

export type ShurikenKey = 'tiny' | 'small' | 'medium' | 'large' | 'fireTrail';

export interface ShurikenData {
  systems: Record<ShurikenKey, SystemDef[]>;
  textures: Record<string, { file: string; w: number; h: number }>;
}

const CUSTOM2_STREAMS = [35, 36, 37, 38]; // Custom2X..Custom2XYZW: without one, the shader reads zeros
const SUB_BIRTH = 0;
const INHERIT_SIZE = 2;
const GRAVITY = 9.81; // Physics.gravity.y in Unity units; every system here has gravityModifier 0
const DAMPEN_FPS = 30; // LimitVelocityOverLifetime's dampen is per frame at 30 fps

/** AnimationCurve.Evaluate with Hermite tangents, clamped before the first key and after the last. */
export function evalKeys(keys: readonly Key[], t: number): number {
  const n = keys.length;
  if (n === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0, , out0] = keys[i];
  const [t1, v1, in1] = keys[i + 1];
  const dt = t1 - t0;
  if (dt <= 0) return v1;
  if (!Number.isFinite(out0) || !Number.isFinite(in1)) return v0; // a stepped key
  const s = (t - t0) / dt;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * dt * out0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * dt * in1;
}

/** MinMaxCurve.Evaluate(time, random): `t` is 0-1 along the curve's time axis. */
export function evalCurve(c: Curve, t: number, r: number): number {
  switch (c.mode) {
    case 0:
      return c.scalar;
    case 1:
      return c.scalar * evalKeys(c.maxCurve, t);
    case 2: {
      const lo = evalKeys(c.minCurve, t);
      return c.scalar * (lo + (evalKeys(c.maxCurve, t) - lo) * r);
    }
    default:
      return c.min + (c.scalar - c.min) * r;
  }
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  startX: number; // start size, both axes
  startY: number;
  sx: number; // current size
  sy: number;
  rot: number; // radians
  seq: number; // emission order
  rnd: Float32Array; // per-particle randoms for the over-lifetime curves
  c1: [number, number, number, number]; // Custom1 (shader parameters)
  c2: [number, number, number]; // Custom2 (noise)
  hasC2: boolean;
}

const R_SIZE = 0;
const R_ROT = 1;
const R_VX = 2;
const R_VY = 3;
const R_FX = 4;
const R_FY = 5;
const R_CLAMP = 6;
const R_C1 = 7; // 7..10
const R_C2 = 11; // 11..13
const R_COUNT = 14;

/** One ParticleSystem playing: its emitter, timers and particles. */
export class SystemState {
  readonly particles: Particle[] = [];
  time = 0;
  delay: number;
  private rateAcc = 0;
  private distAcc = 0;
  private readonly burstsFired: number[];
  private seq = 0;
  private stopped = false;
  ox: number; // emitter position (world)
  oy: number;
  oz: number;
  private lastX: number;
  private lastY: number;
  inheritSize = 1; // sub-emitter: the parent particle's size at emission
  follow: Particle | null = null; // Birth sub-emitter: emits where its parent particle is

  constructor(readonly def: SystemDef, readonly index: number, x: number, y: number, z: number, delay: number,
    private readonly rng: () => number) {
    this.ox = this.lastX = x;
    this.oy = this.lastY = y;
    this.oz = z;
    this.delay = delay + Math.max(0, evalCurve(def.startDelay, 0, rng()));
    this.burstsFired = def.emission.bursts.map(() => 0);
  }

  /** Stops emitting (ParticleSystem.Stop with StopEmitting); live particles carry on. */
  stop(): void {
    this.stopped = true;
  }

  get emitting(): boolean {
    return !this.stopped && (this.def.looping || this.time < this.def.duration || this.delay > 0);
  }

  get finished(): boolean {
    return !this.emitting && this.particles.length === 0;
  }

  moveTo(x: number, y: number): void {
    this.ox = x;
    this.oy = y;
  }

  /** Advances by dt; `spawn` receives each new particle (for Birth sub-emitters). */
  step(dt: number, spawn: (s: SystemState, p: Particle) => void): void {
    const d = this.def;
    dt *= d.simulationSpeed;
    const moved = Math.hypot(this.ox - this.lastX, this.oy - this.lastY);
    this.lastX = this.ox;
    this.lastY = this.oy;
    this.updateParticles(dt);
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay;
      this.delay = 0;
    }
    if (this.stopped) return;
    const t0 = this.time;
    this.time += dt;
    if (!d.looping && t0 >= d.duration) return;
    const em = d.emission;
    if (!em.enabled && !d.isSub) return;
    const norm = Math.min(1, this.time / d.duration);
    this.rateAcc += evalCurve(em.rate, norm, this.rng()) * dt;
    this.distAcc += evalCurve(em.rateOverDistance, norm, this.rng()) * moved;
    let n = Math.floor(this.rateAcc) + Math.floor(this.distAcc);
    this.rateAcc -= Math.floor(this.rateAcc);
    this.distAcc -= Math.floor(this.distAcc);
    for (let i = 0; i < n; i++) this.emit(spawn, -1, 0);
    em.bursts.forEach((b, bi) => {
      while (this.burstsFired[bi] < b.cycles && this.time >= b.time + this.burstsFired[bi] * b.interval) {
        this.burstsFired[bi]++;
        n = Math.round(evalCurve(b.count, norm, this.rng()));
        for (let i = 0; i < n; i++) this.emit(spawn, i, n);
      }
    });
    if (d.looping && this.time >= d.duration) {
      this.time -= d.duration;
      this.burstsFired.fill(0);
    }
  }

  /** Emits one particle; `index`/`count` place it in a burst for the arc's BurstSpread mode. */
  private emit(spawn: (s: SystemState, p: Particle) => void, index: number, count: number): void {
    const d = this.def;
    if (this.particles.length >= d.initial.maxParticles) return;
    const norm = Math.min(1, this.time / d.duration);
    const r = this.rng;
    const shape = d.shape ? emitFromShape(d.shape, r, index, count) : { x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 };
    const speed = evalCurve(d.initial.speed, norm, r());
    const size = evalCurve(d.initial.size, norm, r()) * this.inheritSize;
    const sizeY = d.initial.size3D ? evalCurve(d.initial.sizeY, norm, r()) * this.inheritSize : size;
    const rnd = new Float32Array(R_COUNT);
    for (let i = 0; i < R_COUNT; i++) rnd[i] = r();
    const p: Particle = {
      x: this.ox + shape.x, y: this.oy + shape.y, z: this.oz + shape.z,
      vx: shape.dx * speed, vy: shape.dy * speed, age: 0, life: Math.max(1e-4, evalCurve(d.initial.lifetime, norm, r())),
      startX: size, startY: sizeY, sx: size, sy: sizeY, rot: evalCurve(d.initial.rotation, norm, r()), seq: this.seq++, rnd,
      c1: [0, 0, 0, 0], c2: [0, 0, 0], hasC2: d.renderer.streams.some((s) => CUSTOM2_STREAMS.includes(s)),
    };
    this.animate(p, 0);
    this.particles.push(p);
    spawn(this, p);
  }

  /** The over-lifetime modules for one particle at age fraction t (size, custom data). */
  private animate(p: Particle, t: number): void {
    const d = this.def;
    if (d.size) {
      const k = evalCurve(d.size.curve, t, p.rnd[R_SIZE]);
      p.sx = p.startX * k;
      p.sy = p.startY * (d.size.separateAxes ? evalCurve(d.size.y, t, p.rnd[R_SIZE]) : k);
    }
    const [c1, c2] = d.custom;
    for (let i = 0; i < 4; i++) p.c1[i] = c1[i] ? evalCurve(c1[i], t, p.rnd[R_C1 + i]) : 0;
    for (let i = 0; i < 3; i++) p.c2[i] = p.hasC2 && c2[i] ? evalCurve(c2[i], t, p.rnd[R_C2 + i]) : 0;
  }

  private updateParticles(dt: number): void {
    const d = this.def;
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) {
        ps.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      if (d.force) {
        const rx = d.force.randomizePerFrame ? this.rng() : p.rnd[R_FX];
        const ry = d.force.randomizePerFrame ? this.rng() : p.rnd[R_FY];
        p.vx += evalCurve(d.force.x, t, rx) * dt;
        p.vy += evalCurve(d.force.y, t, ry) * dt;
      }
      const g = evalCurve(d.initial.gravity, Math.min(1, this.time / d.duration), 0.5);
      if (g) p.vy -= g * GRAVITY * dt;
      if (d.clamp) {
        const k = 1 - (1 - d.clamp.dampen) ** (dt * DAMPEN_FPS);
        if (d.clamp.separateAxis) {
          const lx = Math.abs(evalCurve(d.clamp.x, t, p.rnd[R_CLAMP]));
          const ly = Math.abs(evalCurve(d.clamp.y, t, p.rnd[R_CLAMP]));
          if (Math.abs(p.vx) > lx) p.vx += (Math.sign(p.vx) * lx - p.vx) * k;
          if (Math.abs(p.vy) > ly) p.vy += (Math.sign(p.vy) * ly - p.vy) * k;
        } else {
          const limit = evalCurve(d.clamp.magnitude, t, p.rnd[R_CLAMP]);
          const speed = Math.hypot(p.vx, p.vy);
          if (speed > limit) {
            const m = 1 + (limit / speed - 1) * k;
            p.vx *= m;
            p.vy *= m;
          }
        }
      }
      let vx = p.vx;
      let vy = p.vy;
      if (d.velocity) {
        vx += evalCurve(d.velocity.x, t, p.rnd[R_VX]);
        vy += evalCurve(d.velocity.y, t, p.rnd[R_VY]);
      }
      p.x += vx * dt;
      p.y += vy * dt;
      if (d.rotation) p.rot += evalCurve(d.rotation.curve, t, p.rnd[R_ROT]) * dt;
      this.animate(p, t);
    }
  }
}

const DEG = Math.PI / 180;

/** Rotates a vector by Unity Euler angles (degrees; applied Z, then X, then Y). */
function rotate(v: [number, number, number], e: [number, number, number]): [number, number, number] {
  let [x, y, z] = v;
  if (e[2]) {
    const c = Math.cos(e[2] * DEG);
    const s = Math.sin(e[2] * DEG);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  if (e[0]) {
    const c = Math.cos(e[0] * DEG);
    const s = Math.sin(e[0] * DEG);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (e[1]) {
    const c = Math.cos(e[1] * DEG);
    const s = Math.sin(e[1] * DEG);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  return [x, y, z];
}

/** ShapeModule: where a particle starts (relative to the emitter) and which way it goes. */
export function emitFromShape(s: ShapeDef, r: () => number, index = -1, count = 0):
  { x: number; y: number; z: number; dx: number; dy: number; dz: number } {
  let pos: [number, number, number];
  let dir: [number, number, number];
  const thick = (exp: number) => 1 - s.radiusThickness + s.radiusThickness * r() ** exp;
  const arcAngle = () => {
    const arc = s.arc * DEG;
    if (s.arcMode === 3 && count > 0 && index >= 0) return (index / count) * arc; // BurstSpread
    return r() * arc;
  };
  switch (s.type) {
    case 0: // Sphere
    case 1:
    case 2: // Hemisphere
    case 3: {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const k = Math.sqrt(1 - u * u);
      dir = [k * Math.cos(a), k * Math.sin(a), s.type >= 2 ? Math.abs(u) : u];
      const rad = s.radius * (s.type === 1 || s.type === 3 ? 1 : thick(1 / 3));
      pos = [dir[0] * rad, dir[1] * rad, dir[2] * rad];
      break;
    }
    case 4: // Cone (base)
    case 7:
    case 8:
    case 9: {
      const a = arcAngle();
      const rho = Math.sqrt(r()) * (s.type === 7 ? 1 : 1);
      const base: [number, number, number] = [Math.cos(a) * rho, Math.sin(a) * rho, 0];
      const tilt = Math.sin(s.angle * DEG);
      dir = [base[0] * tilt, base[1] * tilt, Math.cos(s.angle * DEG)];
      const len = Math.hypot(...dir) || 1;
      dir = [dir[0] / len, dir[1] / len, dir[2] / len];
      pos = [base[0] * s.radius, base[1] * s.radius, 0];
      break;
    }
    default: {
      // Circle (and anything else): in the XY plane, outwards
      const a = arcAngle();
      dir = [Math.cos(a), Math.sin(a), 0];
      const rad = s.radius * (s.type === 11 ? 1 : thick(0.5));
      pos = [dir[0] * rad, dir[1] * rad, 0];
    }
  }
  if (s.randomDirection > 0 || s.sphericalDirection > 0) {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const k = Math.sqrt(1 - u * u);
    const rnd: [number, number, number] = [k * Math.cos(a), k * Math.sin(a), u];
    for (let i = 0; i < 3; i++) dir[i] += (rnd[i] - dir[i]) * s.randomDirection;
  }
  pos = [pos[0] * s.scale[0], pos[1] * s.scale[1], pos[2] * s.scale[2]];
  pos = rotate(pos, s.rotation);
  dir = rotate(dir, s.rotation);
  return {
    x: pos[0] + s.position[0], y: pos[1] + s.position[1], z: pos[2] + s.position[2], dx: dir[0], dy: dir[1], dz: dir[2],
  };
}

/** One prefab instance (ParticleSystem with its child systems) at a world position, after a delay. */
export class ShurikenEffect {
  readonly systems: SystemState[] = [];
  private readonly offsets: Array<[number, number, number]> = [];
  x: number;
  y: number;
  private detached = false;

  constructor(readonly defs: readonly SystemDef[], x: number, y: number, delay: number, private readonly rng: () => number) {
    this.x = x;
    this.y = y;
    defs.forEach((d, i) => {
      const parent = d.parent >= 0 ? this.offsets[d.parent] : [0, 0, 0];
      const off: [number, number, number] = d.parent >= 0
        ? [parent[0] + d.position[0], parent[1] + d.position[1], parent[2] + d.position[2]] : [0, 0, 0];
      this.offsets.push(off);
      // a system used as a sub-emitter only plays for its parent's particles
      if (!d.isSub) this.systems.push(new SystemState(d, i, x + off[0], y + off[1], off[2], delay, rng));
    });
  }

  /** Moves the prefab (a fire trail following its plume). */
  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    for (const s of this.systems) {
      if (s.follow) continue;
      const off = this.offsets[s.index];
      s.moveTo(x + off[0], y + off[1]);
    }
  }

  /** The thing it was parented to is gone (Plume.UnparentTrail): it stops emitting and fades out. */
  detach(): void {
    this.detached = true;
    for (const s of this.systems) s.stop();
  }

  get finished(): boolean {
    return this.systems.every((s) => s.finished);
  }

  step(dt: number): void {
    const spawn = (owner: SystemState, p: Particle) => {
      for (const sub of owner.def.sub) {
        if (sub.type !== SUB_BIRTH) continue;
        const child = new SystemState(this.defs[sub.system], sub.system, p.x, p.y, owner.oz, 0, this.rng);
        child.follow = p;
        if (sub.properties & INHERIT_SIZE) child.inheritSize = p.sx;
        if (this.detached) child.stop();
        this.systems.push(child);
      }
    };
    for (let i = 0; i < this.systems.length; i++) {
      const s = this.systems[i];
      if (s.follow) {
        if (s.follow.age < s.follow.life) s.moveTo(s.follow.x, s.follow.y);
        else s.stop(); // the parent particle died: a Birth sub-emitter stops with it
      }
      s.step(dt, spawn);
    }
    for (let i = this.systems.length - 1; i >= 0; i--) {
      const s = this.systems[i];
      if (s.follow && s.finished) this.systems.splice(i, 1);
    }
  }

  /** Every live particle, back to front: by depth, then system order, then the renderer's sort mode. */
  drawList(): Array<{ p: Particle; mat: MaterialDef }> {
    const out: Array<{ p: Particle; mat: MaterialDef; order: number; z: number; key: number }> = [];
    this.systems.forEach((s, order) => {
      const mode = s.def.renderer.sortMode;
      for (const p of s.particles) {
        // 2 OldestInFront, 3 YoungestInFront, otherwise emission order
        const key = mode === 2 ? -p.seq : p.seq;
        out.push({ p, mat: s.def.renderer.material, order, z: p.z, key });
      }
    });
    out.sort((a, b) => b.z - a.z || a.order - b.order || a.key - b.key);
    return out;
  }
}
