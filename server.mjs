// Minimal production server for the built app (used on Railway or any Node host).
// Serves ./dist with correct MIME types, long-lived caching for hashed assets, gzip,
// a health check, and an index.html fallback. No dependencies beyond Node itself.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.webmanifest']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** In-memory cache of file bodies (plain and gzipped); dist is immutable once the server starts. */
const cache = new Map();

async function load(file) {
  let entry = cache.get(file);
  if (!entry) {
    const body = await readFile(file);
    const ext = extname(file).toLowerCase();
    entry = { body, gz: COMPRESSIBLE.has(ext) && body.length > 1024 ? gzipSync(body) : null, type: TYPES[ext] || 'application/octet-stream', ext };
    cache.set(file, entry);
  }
  return entry;
}

/** Map a URL path to a file inside dist, refusing anything that escapes it. */
function toFile(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const file = normalize(join(ROOT, decoded));
  return file === ROOT || file.startsWith(ROOT + sep) ? file : null;
}

async function isFile(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('ok');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }

    let file = toFile(url.pathname);
    if (!file) { res.writeHead(400); res.end('Bad request'); return; }
    if (url.pathname.endsWith('/')) file = join(file, 'index.html');

    let status = 200;
    if (!(await isFile(file))) {
      // Paths with a file extension are real missing files; anything else gets the app shell.
      if (extname(url.pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('Not found');
        return;
      }
      file = join(ROOT, 'index.html');
    }

    const entry = await load(file);
    const hashed = url.pathname.startsWith('/assets/');
    const useGzip = entry.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const body = useGzip ? entry.gz : entry.body;
    res.writeHead(status, {
      'Content-Type': entry.type,
      'Content-Length': body.length,
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      Vary: 'Accept-Encoding',
      ...(useGzip ? { 'Content-Encoding': 'gzip' } : {}),
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
});

if (!(await isFile(join(ROOT, 'index.html')))) {
  console.error(`No build found at ${ROOT}. Run "npm run build" first.`);
  process.exit(1);
}

server.listen(PORT, HOST, () => console.log(`Markov Chain Simulator listening on http://${HOST}:${PORT}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
