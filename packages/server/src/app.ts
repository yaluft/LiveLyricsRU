import { resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    bodyLimit: 256 * 1024,
  });

  await initDb();

  await app.register(cors, {
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
  });

  await app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 2 },
  });

  await app.register(registerRoutes, { prefix: '/api' });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const status = error.statusCode ?? 500;
    // A 5xx message can carry internals, so it never reaches the client. 4xx
    // messages are ours and are written to be shown.
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : 'bad_request',
      message: status >= 500 ? 'Внутренняя ошибка сервера' : error.message,
    });
  });

  if (config.serveClient) {
    await app.register(fastifyStatic, { root: resolve(process.cwd(), config.clientDir) });

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
