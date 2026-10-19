/** game-data/worldmap: Broforce's 3D world map as the extractor's worldmap module writes it. */
export interface GlobeTexture {
  file: string;
  st: number[]; // scale x, y, offset (or scroll speed) x, y
}

export interface GlobeMaterial {
  name: string;
  shader: string | null;
  texture: string | null;
  st: number[];
  textures: Record<string, GlobeTexture>;
  state: { blend: number[]; zWrite: boolean; cull: number; queue: number };
  colors: Record<string, number[]>;
  floats: Record<string, number>;
}

/** Byte offsets into globe.bin: Float32 positions, normals, uvs, lightmap uvs; Uint32 indices; Uint8 RGBA colours. */
export interface GlobeGroup {
  material: number;
  lightmapped: boolean;
  vertexCount: number;
  indexCount: number;
  position: number;
  normal: number;
  uv: number;
  uv2: number | null;
  index: number;
  color: number | null;
  name?: string;
  matrix?: number[]; // a model part's frame, column-major
  territory?: string; // a territory's border: Broforce shows it only while that territory is selected
}

/** WorldTerritory3D: where its icon hangs (centreObject) and where the helicopter sets down (LandingPoint). */
export interface GlobeTerritory {
  centre: number[];
  landing: number[];
  flag?: number[]; // the US flag's frame on its WorldMapFlagPole, column-major
}

/** A quad the main camera carries, `distance` ahead of it: its shader draws texture × colour with this blend. */
export interface GlobeGlow {
  name: string;
  texture: string;
  shader: string | null;
  color: number[];
  blend: number[];
  queue: number;
  distance: number;
  size: number;
}

export interface GlobeData {
  radius: number;
  camera: { height: number; fovOut: number; fovIn: number; near: number; far: number; background: number[] };
  fog: { color: number[]; start: number; end: number };
  light: { towards: number[]; intensity: number };
  lightmap: { file: string };
  helicopter3d: Record<string, number>;
  materials: GlobeMaterial[];
  groups: GlobeGroup[];
  territories: Record<string, GlobeTerritory>;
  glows: GlobeGlow[];
  models: { helicopter: GlobeGroup[]; flag: GlobeGroup[] };
  modelFrames: Record<string, number[]>;
  icons: { terror: string; arrow: string };
}

const KEYS = ['radius', 'camera', 'fog', 'light', 'lightmap', 'helicopter3d', 'materials', 'groups', 'territories', 'glows',
  'models', 'modelFrames', 'icons'] as const;

export function parseGlobe(raw: unknown): GlobeData {
  if (typeof raw !== 'object' || raw === null) throw new Error('worldmap/globe.json is not an object');
  const missing = KEYS.filter((k) => !(k in raw));
  if (missing.length > 0) throw new Error(`worldmap/globe.json lacks: ${missing.join(', ')}`);
  return raw as GlobeData;
}

export interface GroupArrays {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  uv2: Float32Array | null;
  color: Uint8Array | null;
  index: Uint32Array;
}

export function groupArrays(bin: ArrayBuffer, g: GlobeGroup): GroupArrays {
  const n = g.vertexCount;
  return {
    position: new Float32Array(bin, g.position, n * 3),
    normal: new Float32Array(bin, g.normal, n * 3),
    uv: new Float32Array(bin, g.uv, n * 2),
    uv2: g.uv2 === null ? null : new Float32Array(bin, g.uv2, n * 2),
    color: g.color === null ? null : new Uint8Array(bin, g.color, n * 4),
    index: new Uint32Array(bin, g.index, g.indexCount),
  };
}

let cached: Promise<{ data: GlobeData; bin: ArrayBuffer }> | null = null;

/** globe.json and globe.bin, fetched once (about 13 MB) and kept for the next visit to the map. */
export function loadGlobe(fetcher: typeof fetch = fetch): Promise<{ data: GlobeData; bin: ArrayBuffer }> {
  if (!cached) {
    cached = (async () => {
      const [json, bin] = await Promise.all([fetcher('/worldmap/globe.json'), fetcher('/worldmap/globe.bin')]);
      if (!json.ok || !bin.ok) throw new Error('game-data/worldmap is missing: re-run the extractor');
      return { data: parseGlobe(await json.json()), bin: await bin.arrayBuffer() };
    })();
    cached.catch(() => {
      cached = null; // a failed load can be tried again
    });
  }
  return cached;
}
