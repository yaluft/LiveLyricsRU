import { z } from 'zod';
import { extract } from '../extractors/index.js';
const QuerySchema = z.object({ url: z.string().url() });
export const resolveRoute = async (app) => {
    app.get('/resolve', async (request, reply) => {
        const parsed = QuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Missing or invalid param: url' });
        }
        try {
            const info = await extract(parsed.data.url);
            return info;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            app.log.error({ err }, 'resolve failed');
            return reply.code(502).send({ error: msg });
        }
    });
};
//# sourceMappingURL=resolve.js.map