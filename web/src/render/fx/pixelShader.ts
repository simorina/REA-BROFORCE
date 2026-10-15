import type { MaterialDef, Particle } from './shuriken';

/**
 * A software port of Broforce's Unlit/PixelExplosion fragment shader (the only variant in the build;
 * see docs/findings.md). It draws at one pixel per world unit (_WorldToPixel is 1 on every material), so
 * each world pixel samples the particle's texture at its own corner, as the shader's snapping does:
 *
 *   noise  = tex(frac(floor(wp) * c2.z * 0.01 + (0, c2.y * _Time.y))).b * 2 - 1
 *   s      = tex(uv at floor(wp))
 *   shape  = sat(sat(s.r * c1.x + s.a) - s.g * c1.y)
 *   discard when shape * (c2.x * 5 * noise + 1) - 1 + c1.w * 0.99 < 0
 *   heat   = sat((c2.x * noise + 1) * (s.r * c1.x + c1.z - s.g * c1.y))
 *   colour = ramp(heat, 0.5), rgb * (1 + a * (_Brightness - 1)), opaque
 *
 * c1 and c2 are the particle's Custom1/Custom2 vertex streams (custom data curves).
 */
export interface ShaderTexture {
  w: number;
  h: number;
  rgba: Uint8ClampedArray; // top row first, as in the PNG
}

/** Unpacks an extractor texture (RGB on the left half, alpha as grey on the right) into RGBA. */
export function unpackTexture(packed: Uint8ClampedArray, packedWidth: number, h: number): ShaderTexture {
  const w = packedWidth / 2;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * packedWidth + x) * 4;
      const dst = (y * w + x) * 4;
      rgba[dst] = packed[src];
      rgba[dst + 1] = packed[src + 1];
      rgba[dst + 2] = packed[src + 2];
      rgba[dst + 3] = packed[src + w * 4];
    }
  }
  return { w, h, rgba };
}

/** A world-pixel canvas: column i covers x in [left + i, left + i + 1), row j covers y in [top - j - 1, top - j). */
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  left: number;
  top: number;
}

const sat = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const frac = (v: number): number => v - Math.floor(v);

/** Point sampling with clamped addressing; v = 0 is the bottom row, as in Unity. Returns the texel's offset. */
function texel(t: ShaderTexture, u: number, v: number): number {
  const x = Math.min(t.w - 1, Math.max(0, Math.floor(u * t.w)));
  const y = Math.min(t.h - 1, Math.max(0, Math.floor(v * t.h)));
  return ((t.h - 1 - y) * t.w + x) * 4;
}

/** Shades one billboard particle into the buffer. */
export function drawParticle(buf: PixelBuffer, p: Particle, mat: MaterialDef, main: ShaderTexture, ramp: ShaderTexture,
  time: number): void {
  const sx = p.sx;
  const sy = p.sy;
  if (!(sx > 0 && sy > 0)) return;
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  const reach = 0.5 * Math.hypot(sx, sy);
  const x0 = Math.max(buf.left, Math.floor(p.x - reach));
  const x1 = Math.min(buf.left + buf.width - 1, Math.ceil(p.x + reach));
  const y0 = Math.max(buf.top - buf.height, Math.floor(p.y - reach));
  const y1 = Math.min(buf.top - 1, Math.ceil(p.y + reach));
  if (x0 > x1 || y0 > y1) return;
  const [gainR, subG, heatAdd, dissolve] = p.c1;
  const [noiseAmp, noiseScroll, noiseScale] = p.c2;
  const cut = dissolve * 0.99 - 1;
  const bright = mat.brightness - 1;
  const md = main.rgba;
  const rd = ramp.rgba;
  const rampRow = Math.min(ramp.h - 1, Math.floor(0.5 * ramp.h));
  const rampBase = (ramp.h - 1 - rampRow) * ramp.w * 4;
  const scroll = noiseScroll * time;
  const out = buf.data;
  for (let Y = y0; Y <= y1; Y++) {
    const row = buf.top - 1 - Y;
    const dyC = Y + 0.5 - p.y;
    const dy = Y - p.y;
    const nv = frac(Y * noiseScale * 0.01 + scroll);
    for (let X = x0; X <= x1; X++) {
      const dxC = X + 0.5 - p.x;
      const lx = (dxC * cos - dyC * sin) / sx;
      const ly = (dxC * sin + dyC * cos) / sy;
      if (lx < -0.5 || lx > 0.5 || ly < -0.5 || ly > 0.5) continue; // outside the quad
      const dx = X - p.x;
      const i = texel(main, sat(0.5 + (dx * cos - dy * sin) / sx), sat(0.5 + (dx * sin + dy * cos) / sy));
      const r = md[i] / 255;
      const g = md[i + 1] / 255;
      const a = md[i + 3] / 255;
      let noise = 0;
      if (noiseAmp !== 0) noise = (md[texel(main, frac(X * noiseScale * 0.01), nv) + 2] / 255) * 2 - 1;
      const shape = sat(sat(r * gainR + a) - g * subG);
      if (shape * (noiseAmp * 5 * noise + 1) + cut < 0) continue; // discard
      const heat = sat((noiseAmp * noise + 1) * (r * gainR + heatAdd - g * subG));
      const k = rampBase + Math.min(ramp.w - 1, Math.floor(heat * ramp.w)) * 4;
      const m = 1 + (rd[k + 3] / 255) * bright;
      const o = (row * buf.width + (X - buf.left)) * 4;
      out[o] = rd[k] * m;
      out[o + 1] = rd[k + 1] * m;
      out[o + 2] = rd[k + 2] * m;
      out[o + 3] = 255;
    }
  }
}
