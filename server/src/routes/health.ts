import type { FastifyInstance } from 'fastify';
import { CATALOG } from '../data/catalog.js';
import { ytDlpAvailable } from '../services/ytdlp.js';

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get('/api/health', async () => ({
    status: 'ok',
    ytDlp: await ytDlpAvailable(),
    catalogSize: CATALOG.length,
  }));
}
