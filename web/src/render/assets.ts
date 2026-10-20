import { parseValues } from '../engine/stats';
import type { GameStats } from '../engine/types';
import { unpackTexture, type ShaderTexture } from './fx/pixelShader';
import type { ShurikenData } from './fx/shuriken';
import type { WeaponId } from '../engine/bro';
import type { LevelTheme } from '../engine/level';
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
  'brolusconi', 'putin', 'trump', 'kim', 'bro_in_black', 'samuel', 'che', 'm60_gun', 'molotov', 'meloni', 'flamethrower_gun',
  'flame_green', 'flame_white', 'flame_red', 'rifle_gun', 'blade_gun', 'cricket_gun', 'neuraliser_beam', 'revolver_gun', 'revolver_bullet', 'jet_us', 'epstein', 'goliath', 'tank_ru', 'turret_ru', 'tank_shell', 'tank_rocket', 'mook', 'mook_suicide', 'mook_bazooka', 'mook_scout',
  'mook_shield', 'mook_grenadier', 'dog', 'mook_bruiser', 'bruiser_gun', 'mook_bruiser_elite', 'bruiser_elite_gun', 'mook_dolph', 'dolph_gun', 'alien_xeno', 'alien_xeno_brain', 'alien_hugger', 'alien_snake', 'alien_melter', 'alien_brute', 'alien_mosquito', 'rocket_evil', 'truck', 'apc', 'bike', 'nuke_bomb', 'artillery', 'kopter', 'kopter_gun', 'kopter_rotor', 'kopter_tail', 'kopter_missiles', 'mook_jetpack', 'mook_jetpack_bazooka', 'mook_ninja', 'mook_alarmist', 'mine', 'mine_sign', 'grenade', 'shield', 'prisoner', 'cage', 'helicopter', 'bullet', 'rocket',
  'bomb', 'marker', 'block_dirt', 'block_sand', 'block_brick', 'block_temple', 'block_steel', 'block_barrel', 'flagpole', 'flag',
] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export interface Assets {
  sheets: Record<SheetKey, SheetInfo>;
  images: Record<SheetKey, HTMLImageElement>;
  stats: GameStats;
  effects: EffectsData;
  backgrounds: Record<LevelTheme, BackgroundData>;
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

/** The gun sprite drawn over a bro (TestVanDammeAnim.gunSprite), for the weapons that have one in hand. */
const GUN_SHEETS: Partial<Record<WeaponId, SheetKey>> = {
  rifle: 'rifle_gun', blade: 'blade_gun', cricket: 'cricket_gun', m60: 'm60_gun', flamethrower: 'flamethrower_gun',
};

export function gunSheet(weapon: WeaponId, django = false): SheetKey | null {
  return django ? 'revolver_gun' : GUN_SHEETS[weapon] ?? null; // as Django, Samuel holds Dirty Brorry's revolver
}

/** How far forward a gun sprite sits from the body: Blade.SetGunPosition adds 4 to the x offset. */
export function gunOffsetX(sheet: SheetKey): number {
  return sheet === 'blade_gun' || sheet === 'bruiser_gun' || sheet === 'bruiser_elite_gun' ? 4 : 0; // the Bruisers' Gun SpriteSM sits 4 forward too
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
  backgrounds: Record<LevelTheme, BackgroundData>;
  shuriken: ShurikenData;
}

/** Each level theme's ThemeHolder background, as the extractor writes it. */
const BACKGROUND_FILES: Record<LevelTheme, string> = {
  jungle: '/background.json', desert: '/background_desert.json', burning: '/background_burning.json',
  city: '/background_city.json', forest: '/background_forest.json', hell: '/background_hell.json',
};

export async function loadData(fetcher: typeof fetch = fetch): Promise<GameData> {
  const sheets = (await fetchJson('/sheets.json', fetcher)) as Record<string, SheetInfo>;
  const missing = missingSheets(sheets);
  if (missing.length > 0) throw new MissingGameDataError(`sheets.json lacks: ${missing.join(', ')}`);
  const raw = (await fetchJson('/values.json', fetcher)) as Record<string, Record<string, unknown>>;
  const effects = await fetchJson('/effects.json', fetcher);
  const rawBackgrounds = await Promise.all(
    (Object.entries(BACKGROUND_FILES) as Array<[LevelTheme, string]>).map(async ([t, f]) => [t, await fetchJson(f, fetcher)] as const));
  const shuriken = await fetchJson('/shuriken.json', fetcher);
  try {
    return {
      sheets: sheets as Record<SheetKey, SheetInfo>, stats: parseValues(raw), effects: parseEffects(effects),
      backgrounds: Object.fromEntries(rawBackgrounds.map(([t, b]) => [t, parseBackground(b)])) as Record<LevelTheme, BackgroundData>,
      shuriken: parseShuriken(shuriken),
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
  const { sheets, stats, effects, backgrounds, shuriken } = await loadData();
  const entries = await Promise.all(SHEET_KEYS.map(async (k) => [k, await loadImage(`/${sheets[k].file}`)] as const));
  const files = await Promise.all(effectFiles(effects, ...Object.values(backgrounds)).map(async (f) => [f, await loadImage(`/${f}`)] as const));
  const textures = await Promise.all(Object.entries(shuriken.textures)
    .map(async ([name, t]) => [name, await loadShaderTexture(t.file)] as const));
  return {
    sheets, stats, effects, backgrounds, images: Object.fromEntries(entries) as Record<SheetKey, HTMLImageElement>,
    files: Object.fromEntries(files), shuriken, shaderTextures: Object.fromEntries(textures),
  };
}
