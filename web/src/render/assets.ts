import { parseValues } from '../engine/stats';
import type { GameStats } from '../engine/types';
import { unpackTexture, type ShaderTexture } from './fx/pixelShader';
import type { ShurikenData } from './fx/shuriken';
import { effectFiles, parseBackground, parseEffects, parseShuriken, type BackgroundData, type EffectsData } from './fxdata';

export interface SheetInfo {
  file: string;
  frameW: number;
  frameH: number;
  offsetY: number;
  cols: number;
  rows: number;
}

export const SHEET_KEYS = [
  'brolusconi', 'putin', 'trump', 'rifle_gun', 'jet_us', 'tank_ru', 'turret_ru', 'tank_shell', 'tank_rocket', 'mook', 'mook_suicide', 'mook_bazooka', 'mook_scout', 'prisoner', 'cage', 'helicopter', 'bullet', 'rocket',
  'bomb', 'marker', 'block_dirt', 'block_brick', 'block_steel', 'block_barrel', 'flagpole', 'flag',
] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export interface Assets {
  sheets: Record<SheetKey, SheetInfo>;
  images: Record<SheetKey, HTMLImageElement>;
  stats: GameStats;
  effects: EffectsData;
  background: BackgroundData;
  files: Record<string, HTMLImageElement>; // effect and background textures by game-data path
  shuriken: ShurikenData;
  shaderTextures: Record<string, ShaderTexture>; // the PixelExplosion textures by name, as raw RGBA
}

export class MissingGameDataError extends Error {}

export function isSheetKey(s: string): s is SheetKey {
  return (SHEET_KEYS as readonly string[]).includes(s);
}

/** A bro's sheet key, checked against the extracted sheets. */
export function broSheet(bro: { id: string; sheet: string }): SheetKey {
  if (!isSheetKey(bro.sheet)) throw new Error(`bro ${bro.id}: sheet '${bro.sheet}' is not extracted`);
  return bro.sheet;
}

export function missingSheets(sheets: Record<string, unknown>): SheetKey[] {
  return SHEET_KEYS.filter((k) => !(k in sheets));
}

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url);
  } catch {
    throw new MissingGameDataError(`cannot fetch ${url}`);
  }
  if (!res.ok) throw new MissingGameDataError(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new MissingGameDataError(`${url} is not JSON: game-data/ has not been extracted`);
  }
}

export interface GameData {
  sheets: Record<SheetKey, SheetInfo>;
  stats: GameStats;
  effects: EffectsData;
  background: BackgroundData;
  shuriken: ShurikenData;
}

export async function loadData(fetcher: typeof fetch = fetch): Promise<GameData> {
  const sheets = (await fetchJson('/sheets.json', fetcher)) as Record<string, SheetInfo>;
  const missing = missingSheets(sheets);
  if (missing.length > 0) throw new MissingGameDataError(`sheets.json lacks: ${missing.join(', ')}`);
  const raw = (await fetchJson('/values.json', fetcher)) as Record<string, Record<string, unknown>>;
  const effects = await fetchJson('/effects.json', fetcher);
  const background = await fetchJson('/background.json', fetcher);
  const shuriken = await fetchJson('/shuriken.json', fetcher);
  try {
    return {
      sheets: sheets as Record<SheetKey, SheetInfo>, stats: parseValues(raw), effects: parseEffects(effects),
      background: parseBackground(background), shuriken: parseShuriken(shuriken),
    };
  } catch (e) {
    throw new MissingGameDataError(e instanceof Error ? e.message : String(e));
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new MissingGameDataError(`cannot load ${src}`));
    img.src = src;
  });
}

/** Reads a packed shader texture's exact bytes through a canvas (it is opaque, so nothing is premultiplied). */
async function loadShaderTexture(file: string): Promise<ShaderTexture> {
  const img = await loadImage(`/${file}`);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new MissingGameDataError('no 2D canvas to read shader textures with');
  g.drawImage(img, 0, 0);
  return unpackTexture(g.getImageData(0, 0, img.width, img.height).data, img.width, img.height);
}

export async function loadAssets(): Promise<Assets> {
  const { sheets, stats, effects, background, shuriken } = await loadData();
  const entries = await Promise.all(SHEET_KEYS.map(async (k) => [k, await loadImage(`/${sheets[k].file}`)] as const));
  const files = await Promise.all(effectFiles(effects, background).map(async (f) => [f, await loadImage(`/${f}`)] as const));
  const textures = await Promise.all(Object.entries(shuriken.textures)
    .map(async ([name, t]) => [name, await loadShaderTexture(t.file)] as const));
  return {
    sheets, stats, effects, background, images: Object.fromEntries(entries) as Record<SheetKey, HTMLImageElement>,
    files: Object.fromEntries(files), shuriken, shaderTextures: Object.fromEntries(textures),
  };
}
