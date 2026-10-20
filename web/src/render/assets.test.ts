import { describe, expect, it } from 'vitest';
import { RAW_VALUES, TEST_STATS } from '../engine/testStats';
import { MissingGameDataError, SHEET_KEYS, broSheet, gunOffsetX, gunSheet, isSheetKey, loadData, missingSheets } from './assets';
import { effectFiles } from './fxdata';
import { TEST_BACKGROUND, TEST_EFFECTS } from './testFx';

type Reply = { status: number; body: string };
const fakeFetch = (replies: Record<string, Reply>) =>
  (async (url: string) => {
    const r = replies[url] ?? { status: 404, body: '' };
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;

const SHURIKEN = { systems: { tiny: [], small: [], medium: [], large: [], fireTrail: [] }, textures: {} };
const themed = (folder: string) => ({ ...TEST_BACKGROUND, sky: { ...TEST_BACKGROUND.sky, file: `sprites/bg/${folder}/Sky.png` } });
const BACKGROUNDS = {
  '/background.json': { status: 200, body: JSON.stringify(TEST_BACKGROUND) },
  '/background_desert.json': { status: 200, body: JSON.stringify(themed('desert')) },
  '/background_burning.json': { status: 200, body: JSON.stringify(themed('burning')) },
};
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

  it("Trump's sheet is required", () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.trump;
    expect(missingSheets(old)).toEqual(['trump']);
  });

  it("Kim's, Bro In Black's and Samuel's sheets are required", () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.kim;
    delete old.bro_in_black;
    delete old.samuel;
    expect(missingSheets(old)).toEqual(['kim', 'bro_in_black', 'samuel']);
  });

  it("the Goliath's sheet is required", () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.goliath;
    expect(missingSheets(old)).toEqual(['goliath']);
  });

  it("the island's sheets are required", () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.block_sand;
    delete old.block_temple;
    delete old.epstein;
    expect(missingSheets(old)).toEqual(['epstein', 'block_sand', 'block_temple']);
  });

  it('draws the Bruiser and his minigun, 4 forward of him like his Gun sprite', () => {
    const noBruiser: Record<string, unknown> = { ...sheets };
    delete noBruiser.mook_bruiser;
    delete noBruiser.bruiser_gun;
    expect(missingSheets(noBruiser)).toEqual(['mook_bruiser', 'bruiser_gun']);
    expect(gunOffsetX('bruiser_gun')).toBe(4);
  });

  it("draws Meloni with B.A. Broracus's flamethrower in her hands, and its flames in the tricolour", () => {
    expect(gunSheet('flamethrower')).toBe('flamethrower_gun');
    const noMeloni: Record<string, unknown> = { ...sheets };
    for (const k of ['meloni', 'flamethrower_gun', 'flame_green', 'flame_white', 'flame_red']) delete noMeloni[k];
    expect(missingSheets(noMeloni)).toEqual(['meloni', 'flamethrower_gun', 'flame_green', 'flame_white', 'flame_red']);
  });

  it("draws the gun a bro holds: Trump's rifle and Samuel's katana (Blade's gun sprite); the others hold none", () => {
    expect(gunSheet('rifle')).toBe('rifle_gun');
    expect(gunSheet('blade')).toBe('blade_gun');
    expect(gunSheet('cricket')).toBe('cricket_gun'); // Bro In Black's Noisy Cricket
    expect(gunSheet('blade', true)).toBe('revolver_gun'); // as Django, whatever he carried
    expect(gunSheet('m60')).toBe('m60_gun'); // Che with Rambro's M60
    const noChe: Record<string, unknown> = { ...sheets };
    delete noChe.che;
    delete noChe.m60_gun;
    delete noChe.molotov;
    expect(missingSheets(noChe)).toEqual(['che', 'm60_gun', 'molotov']);
    const noRevolver: Record<string, unknown> = { ...sheets };
    delete noRevolver.revolver_gun;
    delete noRevolver.revolver_bullet;
    expect(missingSheets(noRevolver)).toEqual(['revolver_gun', 'revolver_bullet']);
    for (const w of ['football', 'judo'] as const) expect(gunSheet(w)).toBeNull();
    const old: Record<string, unknown> = { ...sheets };
    delete old.blade_gun;
    expect(missingSheets(old)).toEqual(['blade_gun']);
  });

  it("Bro In Black's Noisy Cricket and the Neuraliser's beam texture are required", () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.cricket_gun;
    delete old.neuraliser_beam;
    expect(missingSheets(old)).toEqual(['cricket_gun', 'neuraliser_beam']);
  });

  it("holds Blade's katana 4 px forward (Blade.SetGunPosition: xOffset + 4); the rifle sits on the body", () => {
    expect(gunOffsetX('blade_gun')).toBe(4);
    expect(gunOffsetX('rifle_gun')).toBe(0);
  });

  it('the rifle and jet sheets are required', () => {
    const old: Record<string, unknown> = { ...sheets };
    delete old.rifle_gun;
    delete old.jet_us;
    expect(missingSheets(old)).toEqual(['rifle_gun', 'jet_us']);
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
      ...BACKGROUNDS,
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }));
    expect(data.stats).toEqual(TEST_STATS);
    expect(data.shuriken.systems.medium).toEqual([]);
    expect(data.effects.emitters.bloodBig.collision?.gravity).toBe(400);
    expect(effectFiles(data.effects, data.backgrounds.jungle)).toContain('sprites/fx/BloodRed.png');
  });

  it('loads a background for each level theme: the island jungle, the desert and the burning jungle', async () => {
    const data = await loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
      '/effects.json': { status: 200, body: JSON.stringify(TEST_EFFECTS) },
      ...BACKGROUNDS,
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }));
    expect(data.backgrounds.jungle.sky.file).toBe(TEST_BACKGROUND.sky.file);
    expect(data.backgrounds.desert.sky.file).toBe('sprites/bg/desert/Sky.png');
    expect(data.backgrounds.burning.sky.file).toBe('sprites/bg/burning/Sky.png');
    expect(effectFiles(data.effects, ...Object.values(data.backgrounds))).toEqual(
      expect.arrayContaining(['sprites/bg/desert/Sky.png', 'sprites/bg/burning/Sky.png']));
    const { ['/background_burning.json']: _, ...withoutBurning } = BACKGROUNDS;
    await expect(loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
      '/effects.json': { status: 200, body: JSON.stringify(TEST_EFFECTS) },
      ...withoutBurning,
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }))).rejects.toBeInstanceOf(MissingGameDataError);
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
      ...BACKGROUNDS,
      '/shuriken.json': { status: 200, body: JSON.stringify(SHURIKEN) },
    }))).rejects.toThrow('effects.json puffs lacks');
  });
});
