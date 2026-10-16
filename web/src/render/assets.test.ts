import { describe, expect, it } from 'vitest';
import { RAW_VALUES, TEST_STATS } from '../engine/testStats';
import { MissingGameDataError, SHEET_KEYS, broSheet, isSheetKey, loadData, missingSheets } from './assets';
import { effectFiles } from './fxdata';
import { TEST_BACKGROUND, TEST_EFFECTS } from './testFx';

type Reply = { status: number; body: string };
const fakeFetch = (replies: Record<string, Reply>) =>
  (async (url: string) => {
    const r = replies[url] ?? { status: 404, body: '' };
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;

const SHURIKEN = { systems: { tiny: [], small: [], medium: [], large: [], fireTrail: [] }, textures: {} };
const sheets = Object.fromEntries(SHEET_KEYS.map((k) => [k, { file: `sprites/${k}.png`, frameW: 16, frameH: 16, offsetY: 0, cols: 1, rows: 1 }]));

describe('loadData', () => {
  it('lists sheets that are missing and recognises sheet keys', () => {
    expect(missingSheets({ brolusconi: {} })).toContain('mook');
    expect(missingSheets(sheets)).toEqual([]);
    expect(isSheetKey('brolusconi')).toBe(true);
    expect(isSheetKey('rambro')).toBe(false);
  });

  it('a game-data without putin is incomplete, and bro sheets are checked', () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.putin;
    expect(missingSheets(old)).toEqual(['putin']);
    expect(broSheet({ id: 'putin', sheet: 'putin' })).toBe('putin');
    expect(() => broSheet({ id: 'x', sheet: 'rambro' })).toThrow("sheet 'rambro' is not extracted");
  });

  it('the tank sheets are required', () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.tank_ru;
    delete old.tank_rocket;
    expect(missingSheets(old)).toEqual(['tank_ru', 'tank_rocket']);
  });

  it('loads sheets and parses values', async () => {
    const data = await loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
      '/effects.json': { status: 200, body: JSON.stringify(TEST_EFFECTS) },
      '/background.json': { status: 200, body: JSON.stringify(TEST_BACKGROUND) },
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }));
    expect(data.stats).toEqual(TEST_STATS);
    expect(data.shuriken.systems.medium).toEqual([]);
    expect(data.effects.emitters.bloodBig.collision?.gravity).toBe(400);
    expect(effectFiles(data.effects, data.background)).toContain('sprites/fx/BloodRed.png');
  });

  it('rejects HTML served for JSON (the dev server fallback when game-data is missing)', async () => {
    const html = { status: 200, body: '<!doctype html><html></html>' };
    await expect(loadData(fakeFetch({ '/sheets.json': html, '/values.json': html }))).rejects.toBeInstanceOf(MissingGameDataError);
  });

  it('rejects a 404 and incomplete data', async () => {
    await expect(loadData(fakeFetch({}))).rejects.toBeInstanceOf(MissingGameDataError);
    await expect(loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify({ bro_base: {} }) },
    }))).rejects.toBeInstanceOf(MissingGameDataError);
    await expect(loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
      '/effects.json': { status: 200, body: JSON.stringify({ ...TEST_EFFECTS, puffs: {} }) },
      '/background.json': { status: 200, body: JSON.stringify(TEST_BACKGROUND) },
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }))).rejects.toThrow('effects.json puffs lacks');
  });
});
