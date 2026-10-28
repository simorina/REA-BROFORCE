/**
 * A deployed site carries none of Broforce's assets. A player who has the game extracts game-data/ on his own computer
 * and picks that folder here: its files go into this browser's Cache Storage, and the service worker (sw.ts) serves
 * them at the paths the game asks for, as the dev server serves game-data/. Nothing is uploaded anywhere.
 */
export const GAME_DATA_CACHE = 'game-data';

/** A file from an <input webkitdirectory>: its path starts with the chosen folder's name. */
export type PickedFile = Blob & { name: string; webkitRelativePath: string };

const SKIPPED = new Set(['Thumbs.db', 'desktop.ini']);

/** The file's path inside the chosen folder (game-data/sprites/x.png -> sprites/x.png); null for the OS's own files. */
export function relativePath(file: PickedFile): string | null {
  const parts = (file.webkitRelativePath || file.name).split('/').filter((p) => p !== '');
  if (parts.length > 1) parts.shift();
  const name = parts[parts.length - 1] ?? '';
  if (name === '' || name.startsWith('.') || SKIPPED.has(name)) return null;
  return parts.join('/');
}

/** What is wrong with the chosen folder, or null when it is the extractor's (sheets.json at its top). */
export function checkFolder(paths: readonly string[]): string | null {
  return paths.includes('sheets.json')
    ? null
    : "Nella cartella scelta non c'è sheets.json: scegli la cartella game-data che crea l'estrattore.";
}

const MIME: Record<string, string> = {
  json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  mp3: 'audio/mpeg', txt: 'text/plain',
};

export function mimeOf(path: string): string {
  return MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';
}

/** As much of CacheStorage as the store uses (a fake in tests). */
export interface CachesLike {
  delete(name: string): Promise<boolean>;
  open(name: string): Promise<{ put(url: string, response: Response): Promise<void> }>;
}

/** Replaces the game-data cache with the picked files, each at /<its path>; returns how many it stored. */
export async function storeGameData(files: readonly PickedFile[], store: CachesLike = caches,
  onProgress?: (done: number, total: number) => void): Promise<number> {
  const entries = files.flatMap((f) => {
    const path = relativePath(f);
    return path === null ? [] : [[path, f] as const];
  });
  await store.delete(GAME_DATA_CACHE);
  const cache = await store.open(GAME_DATA_CACHE);
  let done = 0;
  for (const [path, file] of entries) {
    await cache.put(`/${path}`, new Response(file, { headers: { 'Content-Type': mimeOf(path), 'Content-Length': String(file.size) } }));
    onProgress?.(++done, entries.length);
  }
  return done;
}

/**
 * Registers sw.js and waits until it controls the page (at most `timeout` ms), so the game's first requests already
 * go through it. Without service workers the site plays only with a game-data served next to it.
 */
export async function registerGameDataWorker(timeout = 3000): Promise<void> {
  const container = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!container) return;
  try {
    await container.register('/sw.js');
    await container.ready;
    if (container.controller) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeout);
      container.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  } catch {
    // no service worker (a private window, an old browser): nothing to serve from
  }
}
