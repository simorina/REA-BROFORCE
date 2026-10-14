import { parseValues } from '../engine/stats';
import type { GameStats } from '../engine/types';

export interface SheetInfo {
  file: string;
  frameW: number;
  frameH: number;
  offsetY: number;
  cols: number;
  rows: number;
}

export const SHEET_KEYS = [
  'brolusconi', 'mook', 'mook_suicide', 'mook_bazooka', 'prisoner', 'cage', 'helicopter', 'bullet', 'rocket',
  'bomb', 'marker', 'block_dirt', 'block_brick', 'block_steel', 'block_barrel', 'flagpole', 'flag', 'explosion',
  'explosion_small',
] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

export interface Assets {
  sheets: Record<SheetKey, SheetInfo>;
  images: Record<SheetKey, HTMLImageElement>;
  stats: GameStats;
}

export class MissingGameDataError extends Error {}

export function isSheetKey(s: string): s is SheetKey {
  return (SHEET_KEYS as readonly string[]).includes(s);
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

export async function loadData(fetcher: typeof fetch = fetch): Promise<{ sheets: Record<SheetKey, SheetInfo>; stats: GameStats }> {
  const sheets = (await fetchJson('/sheets.json', fetcher)) as Record<string, SheetInfo>;
  const missing = missingSheets(sheets);
  if (missing.length > 0) throw new MissingGameDataError(`sheets.json lacks: ${missing.join(', ')}`);
  const raw = (await fetchJson('/values.json', fetcher)) as Record<string, Record<string, unknown>>;
  try {
    return { sheets: sheets as Record<SheetKey, SheetInfo>, stats: parseValues(raw) };
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

export async function loadAssets(): Promise<Assets> {
  const { sheets, stats } = await loadData();
  const entries = await Promise.all(SHEET_KEYS.map(async (k) => [k, await loadImage(`/${sheets[k].file}`)] as const));
  return { sheets, stats, images: Object.fromEntries(entries) as Record<SheetKey, HTMLImageElement> };
}
