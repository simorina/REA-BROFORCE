import * as THREE from 'three';
import type { GlobeMaterial } from './data';

/**
 * Broforce's world map shaders, read from their compiled DXBC and rewritten in GLSL. The game renders in gamma
 * space, so textures and output stay as they are (no sRGB conversion).
 */
export interface Shared {
  time: { value: number };
  fogColor: { value: THREE.Color };
  fogNear: { value: number };
  fogFar: { value: number };
  lightDir: { value: THREE.Vector3 };
  heliPos: { value: THREE.Vector3 };
  lmScale: { value: number };
}

const FOG_VS = `varying float vFog;`;
const FOG_FS = `
uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying float vFog;
vec3 applyFog(vec3 c) { return mix(fogColor, c, clamp((fogFar - vFog) / (fogFar - fogNear), 0.0, 1.0)); }`;

/** Custom/Fake3D (and Fake3DTree, Fake3Dspec, the No Lightmap ones): a shadow-to-colour tint by N.L, doubled texture, a rim. */
const FAKE3D_VS = `
uniform vec4 mapST; uniform vec3 lightDir; uniform vec3 tint; uniform vec3 shadowTint;
uniform float time; uniform vec3 heliPos; uniform float isTree; uniform vec4 shakeVec; uniform vec4 treeDist; uniform float repel;
attribute vec2 aLmUv; attribute vec4 aColor;
varying vec2 vUv; varying vec2 vLmUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vTint; ${FOG_VS}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  if (isTree > 0.5) {
    // Fake3DTree: the vertex colour weights a sway, ten times stronger near the helicopter, which also pushes it away
    float k = clamp((distance(world.xyz, heliPos) - treeDist.x) / (treeDist.y - treeDist.x), 0.0, 1.0);
    k *= k;
    float strength = mix(treeDist.z, treeDist.w, k);
    vec2 sway = sin((vec2(time * shakeVec.z) + aColor.xy) * shakeVec.x * strength) * shakeVec.y * strength * 0.5;
    world.xyz -= (heliPos - world.xyz) * k * aColor.x * repel;
    world.xy += sway * aColor.xy;
  }
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vTint = mix(shadowTint, tint, clamp(dot(n, lightDir), 0.0, 1.0));
  vNormal = n;
  vView = normalize(cameraPosition - world.xyz);
  vUv = uv * mapST.xy + mapST.zw;
  vLmUv = aLmUv;
  vec4 mv = viewMatrix * world;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FAKE3D_FS = `
uniform sampler2D map; uniform sampler2D lightmap; uniform float useLightmap; uniform float lmScale;
uniform vec3 fresCol; uniform float fresPow; uniform vec3 specCol; uniform float specPow; uniform vec3 lightDir;
varying vec2 vUv; varying vec2 vLmUv; varying vec3 vNormal; varying vec3 vView; varying vec3 vTint; ${FOG_FS}
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), fresPow);
  vec3 c = clamp(fres * fresCol * vTint + texture2D(map, vUv).rgb * vTint * 2.0, 0.0, 1.0);
  if (specPow > 0.0) c += specCol * pow(clamp(dot(reflect(-lightDir, n), v), 0.0, 1.0), specPow);
  if (useLightmap > 0.5) {
    vec4 lm = texture2D(lightmap, vLmUv);
    c *= lm.rgb * (lm.a * lmScale); // RGBM
  }
  gl_FragColor = vec4(applyFog(c), 1.0);
}`;

/** Custom/PixelWater: two scrolling normal maps, a shadow-to-light tint, a rim, and sparkles where the reflection is brightest. */
const WATER_VS = `
uniform vec4 bump1ST; uniform vec4 bump2ST; uniform float time;
attribute vec2 aLmUv;
varying vec2 vUv; varying vec2 vB1; varying vec2 vB2; varying vec2 vLmUv; varying vec3 vNormal; varying vec3 vView; ${FOG_VS}
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vB1 = uv * bump1ST.xy + fract(bump1ST.zw * time);
  vB2 = uv * bump2ST.xy + fract(bump2ST.zw * time);
  vLmUv = aLmUv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  vec4 mv = viewMatrix * world;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const WATER_FS = `
uniform sampler2D map; uniform sampler2D bump1; uniform sampler2D bump2; uniform sampler2D lightmap; uniform float lmScale;
uniform vec3 shadowCol; uniform vec3 lightCol; uniform vec3 highlightCol; uniform vec3 fresCol; uniform float fresPow;
uniform float bumpStr; uniform float cutoff; uniform float divisions; uniform vec3 lightDir;
varying vec2 vUv; varying vec2 vB1; varying vec2 vB2; varying vec2 vLmUv; varying vec3 vNormal; varying vec3 vView; ${FOG_FS}
void main() {
  vec4 b1 = texture2D(bump1, floor(vB1 * divisions) / divisions);
  vec4 b2 = texture2D(bump2, floor(vB2 * divisions) / divisions);
  vec2 n1 = vec2(b1.r * b1.a, b1.g) * 2.0 - 1.0;
  vec2 n2 = vec2(b2.r * b2.a, b2.g) * 2.0 - 1.0;
  vec3 nb = normalize(vec3(n1 + n2, sqrt(1.0 - min(dot(n1, n1), 1.0))));
  nb = bumpStr * (nb - vec3(0.5, 0.5, 1.0)) + vec3(0.5, 0.5, 1.0);
  vec3 n = normalize(vNormal);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 b = cross(n, t);
  vec3 np = normalize(t * nb.x + b * nb.y + n * nb.z);
  vec3 v = normalize(vView);
  vec3 r = reflect(-v, np);
  // the reflection probe, read as the sun's glint off the waves
  vec3 cube = vec3(pow(clamp(dot(r, lightDir), 0.0, 1.0), 6.0)) * 1.15;
  float sparkle = step(cutoff, cube.r + cube.g + cube.b);
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), fresPow);
  vec3 shade = mix(shadowCol, lightCol, clamp(dot(n, lightDir), 0.0, 1.0)) * 2.0;
  vec3 c = texture2D(map, vUv).rgb * shade + cube * fres * fresCol + fres * fresCol;
  c = clamp(c + sparkle * highlightCol, 0.0, 1.0);
  vec4 lm = texture2D(lightmap, vLmUv);
  c *= lm.rgb * (lm.a * lmScale);
  gl_FragColor = vec4(applyFog(c), 1.0);
}`;

/** Custom/MapBorder: the checker scrolls along the territory's edge, added on. */
const BORDER_VS = `
uniform vec4 mapST; uniform float time; varying vec2 vUv;
void main() { vUv = uv * mapST.xy + mapST.zw * time; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BORDER_FS = `
uniform sampler2D map; uniform vec4 tint; varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vUv) * tint; }`;

/** Custom/ScrollingTexture: the desert and the snow drift, warped by a second texture, faded by the vertex colours. */
const SCROLL_VS = `
uniform vec4 mapST; uniform vec4 bumpST; uniform float time; attribute vec4 aColor;
varying vec2 vUv; varying vec2 vBump; varying vec4 vColor; ${FOG_VS}
void main() {
  vUv = uv * mapST.xy + fract(mapST.zw * time);
  vBump = uv * bumpST.xy + fract(bumpST.zw * time);
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SCROLL_FS = `
uniform sampler2D map; uniform sampler2D bump; uniform vec4 tint; uniform float distort;
varying vec2 vUv; varying vec2 vBump; varying vec4 vColor; ${FOG_FS}
void main() {
  vec2 d = (texture2D(bump, vBump).xy * 2.0 - 1.0) * distort;
  vec4 c = texture2D(map, vUv + d) * tint * vColor;
  gl_FragColor = vec4(applyFog(c.rgb), c.a);
}`;

/** Custom/Spritesheet-2layer: the surf along the coasts, a strip of frames played twice over, added on. */
const SURF_VS = `
uniform vec4 frames; uniform float offset; uniform float time; varying vec2 vUv1; varying vec2 vUv2;
void main() {
  float speed = frames.x; float count = frames.y; float w = frames.z; float h = frames.w;
  vec2 f1 = floor(count * fract(vec2(speed * time, speed * time / h)));
  float t2 = speed * time + offset;
  vec2 f2 = floor(count * fract(vec2(t2, t2 / h)));
  vUv1 = vec2((uv.x + f1.x) / w, (uv.y + f1.y) / h);
  vUv2 = vec2((uv.x + f2.x) / w, (uv.y + f2.y) / h);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SURF_FS = `
uniform sampler2D map; uniform vec4 tint; varying vec2 vUv1; varying vec2 vUv2;
void main() { gl_FragColor = clamp(texture2D(map, vUv1) + texture2D(map, vUv2), 0.0, 1.0) * tint; }`;

/** Custom/wavingFlag: two sine waves along the flag, stronger toward its free end; unlit. */
const FLAG_VS = `
uniform vec4 flag1; uniform vec4 flag2; uniform float time; varying vec2 vUv;
void main() {
  vec3 p = position;
  p.x += sin(uv.x * flag1.x + time * flag1.y) * flag1.z * uv.x;
  p.z += sin(uv.x * flag2.x + time * flag2.y) * flag2.z * uv.x;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FLAG_FS = `
uniform sampler2D map; varying vec2 vUv;
void main() { gl_FragColor = texture2D(map, vUv); }`;

const color = (m: GlobeMaterial, name: string, fallback = [1, 1, 1, 1]) => m.colors[name] ?? fallback;
const v3 = (c: number[]) => new THREE.Vector3(c[0], c[1], c[2]);
const v4 = (c: number[]) => new THREE.Vector4(c[0], c[1], c[2], c[3]);

export type TextureFor = (file: string | null | undefined, linear?: boolean) => THREE.Texture;

/** Blending, depth writing and culling as the shader's first pass sets them (Unity's enums). */
function applyState(mat: THREE.ShaderMaterial, m: GlobeMaterial): void {
  const [src, dst] = m.state.blend;
  if (src === 1 && dst === 0) {
    mat.blending = THREE.NoBlending;
  } else {
    mat.transparent = true;
    mat.blending = THREE.CustomBlending;
    const factor = (f: number): THREE.BlendingDstFactor =>
      ({ 0: THREE.ZeroFactor, 1: THREE.OneFactor, 5: THREE.SrcAlphaFactor, 10: THREE.OneMinusSrcAlphaFactor } as Record<number, THREE.BlendingDstFactor>)[f]
      ?? THREE.OneFactor;
    mat.blendSrc = factor(src) as THREE.BlendingSrcFactor;
    mat.blendDst = factor(dst);
  }
  mat.depthWrite = m.state.zWrite;
  mat.side = m.state.cull === 0 ? THREE.DoubleSide : m.state.cull === 1 ? THREE.BackSide : THREE.FrontSide;
}

export function makeMaterial(m: GlobeMaterial, lightmapped: boolean, shared: Shared, tex: TextureFor, lightmap: THREE.Texture): THREE.ShaderMaterial {
  const shader = m.shader ?? '';
  const common = {
    time: shared.time, fogColor: shared.fogColor, fogNear: shared.fogNear, fogFar: shared.fogFar,
    lightDir: shared.lightDir, heliPos: shared.heliPos, lmScale: shared.lmScale,
  };
  let mat: THREE.ShaderMaterial;
  if (shader === 'Custom/PixelWater') {
    const b1 = m.textures._Bump1;
    const b2 = m.textures._Bump2;
    mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VS, fragmentShader: WATER_FS,
      uniforms: {
        ...common, map: { value: tex(m.texture) }, bump1: { value: tex(b1?.file, true) }, bump2: { value: tex(b2?.file, true) },
        bump1ST: { value: v4(b1?.st ?? [1, 1, 0, 0]) }, bump2ST: { value: v4(b2?.st ?? [1, 1, 0, 0]) }, lightmap: { value: lightmap },
        shadowCol: { value: v3(color(m, '_ShadowCol')) }, lightCol: { value: v3(color(m, '_LightCol')) },
        highlightCol: { value: v3(color(m, '_HighlightCol')) }, fresCol: { value: v3(color(m, '_FresCol')) },
        fresPow: { value: m.floats._FresPow ?? 1 }, bumpStr: { value: m.floats._BumpStr ?? 0.3 },
        cutoff: { value: m.floats._Cutoff ?? 2.95 }, divisions: { value: m.floats._Divisions ?? 256 },
      },
    });
  } else if (shader === 'Custom/MapBorder') {
    mat = new THREE.ShaderMaterial({
      vertexShader: BORDER_VS, fragmentShader: BORDER_FS,
      uniforms: { time: shared.time, map: { value: tex(m.texture) }, mapST: { value: v4(m.st) }, tint: { value: v4(color(m, '_Color')) } },
    });
  } else if (shader === 'Custom/ScrollingTexture') {
    const bump = m.textures._BumpTex;
    mat = new THREE.ShaderMaterial({
      vertexShader: SCROLL_VS, fragmentShader: SCROLL_FS,
      uniforms: {
        ...common, map: { value: tex(m.texture) }, bump: { value: tex(bump?.file, true) }, mapST: { value: v4(m.st) },
        bumpST: { value: v4(bump?.st ?? [1, 1, 0, 0]) }, tint: { value: v4(color(m, '_Color')) }, distort: { value: m.floats._DistortStr ?? 0.1 },
      },
    });
  } else if (shader === 'Custom/Spritesheet-2layer') {
    mat = new THREE.ShaderMaterial({
      vertexShader: SURF_VS, fragmentShader: SURF_FS,
      uniforms: {
        time: shared.time, map: { value: tex(m.texture) }, tint: { value: v4(color(m, '_Color')) },
        frames: { value: new THREE.Vector4(m.floats._Speed ?? 6, m.floats._Frames ?? 16, m.floats._Width ?? 1, m.floats._Height ?? 16) },
        offset: { value: m.floats._Offset ?? 0 },
      },
    });
  } else if (shader === 'Custom/wavingFlag') {
    mat = new THREE.ShaderMaterial({
      vertexShader: FLAG_VS, fragmentShader: FLAG_FS,
      uniforms: { time: shared.time, map: { value: tex(m.texture) }, flag1: { value: v4(color(m, '_FlagParams')) }, flag2: { value: v4(color(m, '_FlagParams2')) } },
    });
  } else {
    // Custom/Fake3D and its variants
    const tree = shader === 'Custom/Fake3DTree';
    const spec = shader.startsWith('Custom/Fake3Dspec');
    mat = new THREE.ShaderMaterial({
      vertexShader: FAKE3D_VS, fragmentShader: FAKE3D_FS,
      uniforms: {
        ...common, map: { value: tex(m.texture) }, mapST: { value: v4(m.st) }, lightmap: { value: lightmap },
        useLightmap: { value: lightmapped ? 1 : 0 }, tint: { value: v3(color(m, '_Color')) }, shadowTint: { value: v3(color(m, '_Shadow', [0.4, 0.4, 0.4, 1])) },
        fresCol: { value: v3(color(m, '_FresCol', [0, 0, 0, 1])) }, fresPow: { value: m.floats._FresPow ?? 1 },
        specCol: { value: v3(color(m, '_SpecCol', [0, 0, 0, 1])) }, specPow: { value: spec ? m.floats._SpecPow ?? 8 : 0 },
        isTree: { value: tree ? 1 : 0 }, shakeVec: { value: v4(color(m, '_ShakeVec', [0, 0, 0, 0])) },
        treeDist: { value: new THREE.Vector4(m.floats._MinDistance ?? 2, m.floats._MaxDistance ?? 1.2, m.floats._MinStrength ?? 1, m.floats._MaxStrength ?? 1) },
        repel: { value: tree ? m.floats._RepelStrength ?? 0 : 0 },
      },
    });
  }
  applyState(mat, m);
  return mat;
}
