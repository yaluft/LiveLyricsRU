import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import fetch from 'node-fetch';
import type { IncomingMessage } from 'node:http';

const QuerySchema = z.object({ url: z.string().url() });

export const streamRoute: FastifyPluginAsync = async (app) => {
  app.get('/stream', async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Missing or invalid param: url' });
    }

    const targetUrl = parsed.data.url;
    const rangeHeader = (request.headers['range'] as string | undefined);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; lyrics-app/1.0)',
    };
    if (rangeHeader) headers['Range'] = rangeHeader;

    let upstream;
    try {
      upstream = await fetch(targetUrl, { headers });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: `Upstream fetch failed: ${msg}` });
    }

    // Forward relevant headers
    const forwardHeaders: Record<string, string> = {};
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) forwardHeaders[h] = v;
    }
    if (!forwardHeaders['accept-ranges']) forwardHeaders['accept-ranges'] = 'bytes';

    reply.code(upstream.status).headers(forwardHeaders);

    if (!upstream.body) {
      return reply.send(Buffer.alloc(0));
    }

    return reply.send(upstream.body as unknown as IncomingMessage);
  });
};
