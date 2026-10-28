/**
 * The service worker that serves a player's own game-data from this browser's cache (gameDataStore.ts): a request for
 * a file he loaded gets it (a byte range of it when an <audio> asks for one); anything else goes to the network.
 * Built on its own as /sw.js (vite.config.ts), so it controls the whole site.
 */
import { byteRange } from './app/swRange';

const CACHE = 'game-data'; // gameDataStore.GAME_DATA_CACHE

interface ExtendableEventLike extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface FetchEventLike extends ExtendableEventLike {
  request: Request;
  respondWith(r: Promise<Response>): void;
}
const sw = self as unknown as {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, listener: (e: never) => void): void;
};

sw.addEventListener('install', (e: ExtendableEventLike) => e.waitUntil(sw.skipWaiting()));
sw.addEventListener('activate', (e: ExtendableEventLike) => e.waitUntil(sw.clients.claim()));
sw.addEventListener('fetch', (e: FetchEventLike) => {
  if (e.request.method === 'GET') e.respondWith(serve(e.request));
});

async function serve(request: Request): Promise<Response> {
  const hit = await (await caches.open(CACHE)).match(request, { ignoreSearch: true });
  if (!hit) return fetch(request);
  const header = request.headers.get('Range');
  if (!header) return hit;
  const body = await hit.blob();
  const range = byteRange(header, body.size);
  if (!range) return new Response(body, { headers: hit.headers });
  return new Response(body.slice(range.start, range.end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${range.start}-${range.end}/${body.size}`,
      'Content-Length': String(range.end - range.start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
