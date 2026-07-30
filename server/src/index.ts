import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { searchRoute } from './routes/search.js';
import { resolveRoute } from './routes/resolve.js';
import { streamRoute } from './routes/stream.js';
import { lyricsRoute } from './routes/lyrics.js';
import { translateRoute } from './routes/translate.js';
import { pronounceRoute } from './routes/pronounce.js';
import { relatedRoute } from './routes/related.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT ?? 3001);

const app = Fastify({ logger: { level: isProd ? 'warn' : 'info' } });

// CORS — allow Vite dev server in dev
await app.register(fastifyCors, {
  origin: isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
});

// Routes
app.get('/health', async () => ({ ok: true }));
await app.register(searchRoute,   { prefix: '/api' });
await app.register(resolveRoute,  { prefix: '/api' });
await app.register(streamRoute,   { prefix: '/api' });
await app.register(lyricsRoute,   { prefix: '/api' });
await app.register(translateRoute,{ prefix: '/api' });
await app.register(pronounceRoute,{ prefix: '/api' });
await app.register(relatedRoute,  { prefix: '/api' });

// Serve built frontend in production
if (isProd) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  await app.register(fastifyStatic, { root: clientDist, prefix: '/' });
  // SPA fallback
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
