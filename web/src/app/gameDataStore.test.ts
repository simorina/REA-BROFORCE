import { describe, expect, it } from 'vitest';
import { GAME_DATA_CACHE, checkFolder, mimeOf, relativePath, storeGameData, type PickedFile } from './gameDataStore';
import { byteRange } from './swRange';

const picked = (path: string, body = 'x'): PickedFile => Object.assign(new Blob([body]), { name: path.split('/').pop()!, webkitRelativePath: path });

/** A CacheStorage of Maps, as much of it as the store uses. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    stores,
    async delete(name: string) {
      return stores.delete(name);
    },
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name)!;
      return { async put(url: string, res: Response) { m.set(url, res); } };
    },
  };
}

describe("a player's own game-data, loaded into the browser", () => {
  it('keeps each file at its path inside the chosen folder, whatever the folder is called', () => {
    expect(relativePath(picked('game-data/sheets.json'))).toBe('sheets.json');
    expect(relativePath(picked('dati broforce/sprites/fx/white.png'))).toBe('sprites/fx/white.png');
    expect(relativePath(picked('game-data/.DS_Store'))).toBeNull();
    expect(relativePath(picked('game-data/sprites/Thumbs.db'))).toBeNull();
  });

  it("wants the extractor's folder: sheets.json at its top", () => {
    expect(checkFolder(['sheets.json', 'values.json', 'sprites/mook.png'])).toBeNull();
    expect(checkFolder(['sprites/mook.png'])).toMatch(/sheets\.json/);
    expect(checkFolder([])).toMatch(/sheets\.json/);
  });

  it('serves each file with its type', () => {
    expect(mimeOf('sheets.json')).toBe('application/json');
    expect(mimeOf('sprites/mook.png')).toBe('image/png');
    expect(mimeOf('audio/voices/hah.wav')).toBe('audio/wav');
    expect(mimeOf('audio/music/Desert.ogg')).toBe('audio/ogg');
    expect(mimeOf('audio/trump_custom.mp3')).toBe('audio/mpeg');
    expect(mimeOf('worldmap/globe.bin')).toBe('application/octet-stream');
  });

  it('puts every file in the game-data cache at its site path, in place of whatever was there', async () => {
    const caches = fakeCaches();
    caches.stores.set(GAME_DATA_CACHE, new Map([['/old.json', new Response('old')]]));
    const progress: number[] = [];
    const n = await storeGameData([picked('game-data/sheets.json', '{}'), picked('game-data/sprites/mook.png', 'png'), picked('game-data/.DS_Store')],
      caches, (done) => progress.push(done));
    expect(n).toBe(2);
    expect(progress).toEqual([1, 2]);
    const cache = caches.stores.get(GAME_DATA_CACHE)!;
    expect([...cache.keys()]).toEqual(['/sheets.json', '/sprites/mook.png']);
    expect(cache.get('/sheets.json')!.headers.get('Content-Type')).toBe('application/json');
    expect(await cache.get('/sprites/mook.png')!.text()).toBe('png');
  });
});

describe("the service worker's byte ranges (an <audio> asks for its music in pieces)", () => {
  it('reads bytes=a-b, bytes=a- and bytes=-n, kept inside the file', () => {
    expect(byteRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 });
    expect(byteRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 });
    expect(byteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 });
  });

  it('turns down what it cannot serve', () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange('bytes=1000-', 1000)).toBeNull();
    expect(byteRange('bytes=5-2', 1000)).toBeNull();
    expect(byteRange('bytes=0-1,5-9', 1000)).toBeNull(); // several ranges at once: the whole file instead
    expect(byteRange('items=0-5', 1000)).toBeNull();
  });
});
