import * as THREE from 'three';
import { restingAttitude, stepAttitude, type Attitude } from './attitude';
import { groupArrays, type GlobeData, type GlobeGlow, type GlobeGroup } from './data';
import { FRONT_DOT } from './markers';
import {
  cameraDir, flight, flightAt, landingRadius, LANDING_SECONDS, normalize, stepZoom, zoomFov, type Flight, type Vec3,
} from './orbit';
import { makeMaterial, type Shared } from './shaders';

export type MissionState = 'done' | 'next' | 'locked';
export interface GlobeMission {
  territory: string;
  state: MissionState;
}

const ZOOM_START_DISTANCE = 5; // WorldCamera.zoomStartDistance: once the helicopter is this far off, the view widens
const RGBM_RANGE = 5; // unity_Lightmap_HDR.x for gamma-space RGBM lightmaps
const ROTOR_SPEED = 32; // rad/s, ours
const TAIL_ROTOR_SPEED = 45;
const FACTORS: Record<number, THREE.BlendingDstFactor> = {
  0: THREE.ZeroFactor, 1: THREE.OneFactor, 5: THREE.SrcAlphaFactor, 10: THREE.OneMinusSrcAlphaFactor,
};

type Pivot = { object: THREE.Object3D; axis: THREE.Vector3; speed: number; angle: number };

/** Broforce's WorldMap3D scene in three.js: the globe, its props, the helicopter flying from mission to mission. */
export class GlobeView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly shared: Shared;
  private readonly loader = new THREE.TextureLoader();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly owned: Array<{ dispose(): void }> = [];
  private readonly heli = new THREE.Group();
  private readonly rotors: Pivot[] = [];
  private readonly borders = new Map<string, THREE.Mesh[]>();
  private readonly centres: THREE.Vector3[]; // where each mission's icon hangs
  private readonly landings: Vec3[]; // each mission's landing zone, as a direction
  private readonly grounds: number[]; // ... and how far it is from the centre, Helicopter3D.LandingOffset above
  private heliDir: Vec3;
  private att: Attitude;
  private trip: { f: Flight; t: number; start: Vec3 } | null = null;
  private landing: { t: number; done: () => void; fired: boolean } | null = null;
  private landAfterTrip: (() => void) | null = null;
  private zoom = 0;
  private zoomingIn = true;
  private time = 0;
  private selected: number;

  constructor(canvas: HTMLCanvasElement, private readonly globe: GlobeData, bin: ArrayBuffer,
    private readonly missions: readonly GlobeMission[], selected: number, start: Vec3 | null) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the game renders in gamma space: no conversion
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(canvas.width, canvas.height, false);
    const c = globe.camera;
    this.scene.background = new THREE.Color(c.background[0], c.background[1], c.background[2]);
    this.camera = new THREE.PerspectiveCamera(c.fovOut, canvas.width / canvas.height, c.near, c.far);
    this.scene.add(this.camera); // it carries the glows
    const l = globe.light.towards;
    this.shared = {
      time: { value: 0 }, fogColor: { value: new THREE.Color(...(globe.fog.color as [number, number, number])) },
      fogNear: { value: globe.fog.start }, fogFar: { value: globe.fog.end },
      lightDir: { value: new THREE.Vector3(l[0], l[1], l[2]).normalize() }, heliPos: { value: new THREE.Vector3() },
      lmScale: { value: RGBM_RANGE },
    };
    const lightmap = this.texture(globe.lightmap.file, true, false);
    for (const g of globe.groups) {
      const mesh = this.mesh(bin, g, lightmap);
      mesh.renderOrder = globe.materials[g.material].state.queue;
      if (g.territory) {
        mesh.visible = false; // WorldTerritory3D.ShowTerritoryBorders: only the selected territory's
        this.borders.set(g.territory, [...(this.borders.get(g.territory) ?? []), mesh]);
      }
      this.scene.add(mesh);
    }
    for (const glow of globe.glows) this.camera.add(this.glow(glow));
    this.buildHelicopter(bin, lightmap);
    const offset = globe.helicopter3d.LandingOffset ?? 0.15;
    const places = missions.map((m) => globe.territories[m.territory] ?? { centre: [0, 0, 5], landing: [0, 0, 5] });
    this.centres = places.map((p) => new THREE.Vector3(p.centre[0], p.centre[1], p.centre[2]));
    this.landings = places.map((p) => normalize([p.landing[0], p.landing[1], p.landing[2]]));
    this.grounds = places.map((p) => Math.hypot(p.landing[0], p.landing[1], p.landing[2]) + offset);
    this.buildFlags(bin, lightmap);
    this.selected = selected;
    const target = this.landings[selected] ?? [0, 0, 1];
    this.heliDir = start ?? target;
    if (start) this.flyFrom(start, selected);
    this.att = restingAttitude(this.trip ? flightAt(this.trip.f, 0).heading : [0, 1, 0]); // it came in facing its way
    if (!this.trip) this.showBorder(selected);
  }

  private texture(file: string, linear: boolean, repeat = true): THREE.Texture {
    const key = `${file}|${linear}|${repeat}`;
    let t = this.textures.get(key);
    if (!t) {
      t = this.loader.load(`/${file}`);
      t.colorSpace = THREE.NoColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter;
      t.minFilter = linear ? THREE.LinearMipmapLinearFilter : THREE.LinearMipmapNearestFilter;
      this.textures.set(key, t);
    }
    return t;
  }

  private mesh(bin: ArrayBuffer, g: GlobeGroup, lightmap: THREE.Texture): THREE.Mesh {
    const a = groupArrays(bin, g);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    geo.setAttribute('aLmUv', new THREE.BufferAttribute(a.uv2 ?? new Float32Array(g.vertexCount * 2), 2));
    geo.setAttribute('aColor', new THREE.BufferAttribute(a.color ?? new Uint8Array(g.vertexCount * 4).fill(255), 4, true));
    geo.setIndex(new THREE.BufferAttribute(a.index, 1));
    const mat = makeMaterial(this.globe.materials[g.material], g.lightmapped, this.shared,
      (file, linear) => (file ? this.texture(file, linear ?? false) : this.blank()), lightmap);
    this.owned.push(geo, mat);
    return new THREE.Mesh(geo, mat);
  }

  private blankTexture: THREE.Texture | null = null;

  private blank(): THREE.Texture {
    if (!this.blankTexture) {
      this.blankTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      this.blankTexture.needsUpdate = true;
      this.owned.push(this.blankTexture);
    }
    return this.blankTexture;
  }

  /** A quad the camera carries `distance` ahead (Blue Glow round the rim, backGlow behind the globe): texture × colour. */
  private glow(g: GlobeGlow): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture(g.texture, true, false), color: new THREE.Color(g.color[0], g.color[1], g.color[2]), opacity: g.color[3],
      blending: THREE.CustomBlending, blendSrc: (FACTORS[g.blend[0]] ?? THREE.OneFactor) as THREE.BlendingSrcFactor,
      blendDst: FACTORS[g.blend[1]] ?? THREE.OneFactor, transparent: g.queue >= 2500, depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(g.size, g.size);
    this.owned.push(mat, geo);
    const quad = new THREE.Mesh(geo, mat);
    quad.position.set(0, 0, -g.distance);
    quad.renderOrder = g.queue; // the background queue's disc before the globe, the additive ring after it
    quad.frustumCulled = false;
    return quad;
  }

  /** A model's parts, each at its frame; the rotors on pivots so they spin about their own centres. */
  private model(bin: ArrayBuffer, parts: GlobeGroup[], lightmap: THREE.Texture, rotors = false): THREE.Group {
    const group = new THREE.Group();
    for (const p of parts) {
      const mesh = this.mesh(bin, p, lightmap);
      const m = new THREE.Matrix4().fromArray(p.matrix ?? new THREE.Matrix4().toArray());
      const pivot = new THREE.Object3D();
      pivot.position.setFromMatrixPosition(m);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(m).setPosition(0, 0, 0);
      pivot.add(mesh);
      group.add(pivot);
      if (rotors && p.name === 'Helicopter_MainRotor') this.rotors.push({ object: pivot, axis: new THREE.Vector3(0, 1, 0), speed: ROTOR_SPEED, angle: 0 });
      if (rotors && p.name === 'Helicopter_SideRotor') this.rotors.push({ object: pivot, axis: new THREE.Vector3(0, 0, 1), speed: TAIL_ROTOR_SPEED, angle: 0 });
    }
    return group;
  }

  private buildHelicopter(bin: ArrayBuffer, lightmap: THREE.Texture): void {
    this.heli.add(this.model(bin, this.globe.models.helicopter, lightmap, true));
    this.heli.matrixAutoUpdate = false;
    this.scene.add(this.heli);
  }

  /** WorldMapFlagPole.RaiseFlag: the US flag on each liberated territory's pole. */
  private buildFlags(bin: ArrayBuffer, lightmap: THREE.Texture): void {
    if (this.globe.models.flag.length === 0) return;
    const flag = this.model(bin, this.globe.models.flag, lightmap);
    this.missions.forEach((m, i) => {
      const frame = this.globe.territories[m.territory]?.flag;
      if (m.state !== 'done') return;
      const f = flag.clone();
      f.matrixAutoUpdate = false;
      f.matrix.copy(frame ? new THREE.Matrix4().fromArray(frame) : this.surfaceFrame(new THREE.Vector3(...this.landings[i]), this.grounds[i], 0.7));
      this.scene.add(f);
    });
  }

  /** Up the globe's normal at `dir`, facing `forward` (or east), scaled, standing at `radius`. */
  private surfaceFrame(dir: THREE.Vector3, radius: number, scale: number, forward?: THREE.Vector3): THREE.Matrix4 {
    const up = dir.clone().normalize();
    let fwd = forward?.clone() ?? new THREE.Vector3(0, 1, 0).cross(up);
    if (fwd.lengthSq() < 1e-8) fwd = new THREE.Vector3(1, 0, 0);
    fwd.sub(up.clone().multiplyScalar(fwd.dot(up))).normalize();
    const side = fwd.clone().cross(up);
    return new THREE.Matrix4().makeBasis(fwd, up, side).scale(new THREE.Vector3(scale, scale, scale))
      .setPosition(up.clone().multiplyScalar(radius));
  }

  private showBorder(mission: number | null): void {
    const pick = mission === null ? null : this.missions[mission]?.territory;
    for (const [territory, meshes] of this.borders) for (const m of meshes) m.visible = territory === pick;
  }

  private flyFrom(from: Vec3, to: number): void {
    this.trip = { f: flight(from, this.landings[to], this.globe.helicopter3d.angularMoveSpeed ?? 25), t: 0, start: from };
    this.showBorder(null);
  }

  /** The helicopter flies to mission `i` (Helicopter3D, steered for the player). */
  select(i: number): void {
    if (this.busy || (i === this.selected && !this.trip)) return;
    this.selected = i;
    this.flyFrom(this.heliDir, i);
  }

  /** The helicopter sets down on the chosen mission's landing zone, once it gets there; `done` runs when it has. */
  land(done: () => void): void {
    if (this.busy) return;
    if (this.trip) this.landAfterTrip = done;
    else this.landing = { t: 0, done, fired: false };
  }

  get flying(): boolean {
    return this.trip !== null;
  }

  /** Landing, or about to. */
  get busy(): boolean {
    return this.landing !== null || this.landAfterTrip !== null;
  }

  get fov(): number {
    return this.camera.fov;
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  /** Where mission `i`'s territory centre is on screen (-1..1, y up), and whether it faces the camera (WMIcon). */
  icon(i: number): { x: number; y: number; front: boolean } {
    const c = this.centres[i];
    if (!c) return { x: 0, y: 0, front: false };
    const p = c.clone().project(this.camera);
    const front = c.clone().normalize().dot(this.camera.position.clone().normalize()) > FRONT_DOT;
    return { x: p.x, y: p.y, front };
  }

  update(dt: number): void {
    this.time += dt;
    this.shared.time.value = this.time;
    const h = this.globe.helicopter3d;
    const height = h.heightOffGround ?? 5.9;
    let move: Vec3 | null = null;
    if (this.trip) {
      this.trip.t += dt;
      const s = flightAt(this.trip.f, this.trip.t);
      this.heliDir = s.dir;
      move = s.done ? null : s.heading;
      const st = this.trip.start;
      const chord = Math.hypot(s.dir[0] - st[0], s.dir[1] - st[1], s.dir[2] - st[2]) * height;
      if (chord > ZOOM_START_DISTANCE) this.zoomingIn = false;
      if (s.done) {
        this.trip = null;
        this.zoomingIn = true;
        this.showBorder(this.selected); // over its territory: WorldTerritorySelector.SelectTerritory
        if (this.landAfterTrip) {
          this.landing = { t: 0, done: this.landAfterTrip, fired: false };
          this.landAfterTrip = null;
        }
      }
    } else {
      this.zoomingIn = true;
    }
    this.zoom = stepZoom(this.zoom, this.zoomingIn, dt);
    // the helicopter: over the globe, its nose after its way, rolling into turns; or setting down
    let radius = height;
    this.att = stepAttitude(this.att, this.heliDir, move, dt, h.bankingSideSpeed ?? 5);
    if (this.landing) {
      this.landing.t += dt;
      radius = landingRadius(this.landing.t, height, this.grounds[this.selected] ?? height);
      this.att = { ...this.att, bank: 0, forward: 0 }; // Helicopter3D levels the model to land
      if (this.landing.t > LANDING_SECONDS && !this.landing.fired) {
        this.landing.fired = true;
        this.landing.done();
      }
    }
    const up = new THREE.Vector3(...this.heliDir);
    const deg = ((h.bankDegrees ?? 40) * Math.PI) / 180;
    const frame = this.surfaceFrame(up, radius, this.scaleOfHelicopter(), new THREE.Vector3(...this.att.facing));
    frame.multiply(new THREE.Matrix4().makeRotationZ(-this.att.forward * deg * 0.4)); // the nose dips
    frame.multiply(new THREE.Matrix4().makeRotationX(this.att.bank * deg)); // the roll
    this.heli.matrix.copy(frame);
    this.shared.heliPos.value.copy(up).multiplyScalar(radius);
    for (const r of this.rotors) {
      r.angle += dt * r.speed;
      r.object.quaternion.setFromAxisAngle(r.axis, r.angle);
    }
    // WorldCamera: over the helicopter, zooming in while it waits and out as it flies off
    const c = this.globe.camera;
    const fov = zoomFov(this.zoom, c.fovOut, c.fovIn);
    const cd = cameraDir(this.heliDir, fov, c.fovOut, c.fovIn);
    this.camera.position.set(cd[0] * c.height, cd[1] * c.height, cd[2] * c.height);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  private scaleOfHelicopter(): number {
    const f = this.globe.modelFrames.helicopter;
    return f ? Math.hypot(f[0], f[1], f[2]) : 0.75;
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    for (const t of this.textures.values()) t.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
