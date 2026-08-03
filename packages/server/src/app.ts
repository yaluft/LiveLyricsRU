import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: 256 * 1024,
  });

  await app.register(cors, {
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
  });

  await app.register(registerRoutes, { prefix: '/api' });

  if (config.serveClient) {
    const root = resolve(process.cwd(), config.clientDir);
    await app.register(fastifyStatic, { root });

    // SPA fallback — but an unmatched /api/* must stay a JSON 404 rather than
    // being handed index.html, or a client fetch failure surfaces as an HTML
    // parse error instead of the API error it actually is.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'not_found', message: 'Маршрут не найден' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
