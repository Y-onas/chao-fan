import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT ?? 3000);
const api = createApi({ dataDir: process.env.DATA_DIR ?? path.join(root, 'data'), adminToken: process.env.ADMIN_TOKEN || undefined });

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  if (await api(req, res)) return;
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
  let file = path.join(dist, path.normalize(urlPath));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  try {
    if (!(await stat(file)).isFile()) throw new Error('dir');
  } catch {
    file = path.join(dist, 'index.html'); // SPA fallback
  }
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': types[ext] ?? 'application/octet-stream',
    'cache-control': urlPath.startsWith('/assets/') && ext !== '.json' ? 'public, max-age=86400' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`ChaoFan Corner on http://localhost:${port}${process.env.ADMIN_TOKEN ? '' : ' (admin disabled: ADMIN_TOKEN not set)'}`);
});
