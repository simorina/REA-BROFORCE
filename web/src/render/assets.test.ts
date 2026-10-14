import { describe, expect, it } from 'vitest';
import { RAW_VALUES, TEST_STATS } from '../engine/testStats';
import { MissingGameDataError, SHEET_KEYS, isSheetKey, loadData, missingSheets } from './assets';

type Reply = { status: number; body: string };
const fakeFetch = (replies: Record<string, Reply>) =>
  (async (url: string) => {
    const r = replies[url] ?? { status: 404, body: '' };
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;

const sheets = Object.fromEntries(SHEET_KEYS.map((k) => [k, { file: `sprites/${k}.png`, frameW: 16, frameH: 16, offsetY: 0, cols: 1, rows: 1 }]));

describe('loadData', () => {
  it('lists sheets that are missing and recognises sheet keys', () => {
    expect(missingSheets({ brolusconi: {} })).toContain('mook');
    expect(missingSheets(sheets)).toEqual([]);
    expect(isSheetKey('brolusconi')).toBe(true);
    expect(isSheetKey('rambro')).toBe(false);
  });

  it('loads sheets and parses values', async () => {
    const data = await loadData(fakeFetch({
      '/sheets.json': { status: 200, body: JSON.stringify(sheets) },
      '/values.json': { status: 200, body: JSON.stringify(RAW_VALUES) },
    }));
    expect(data.stats).toEqual(TEST_STATS);
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
  });
});
