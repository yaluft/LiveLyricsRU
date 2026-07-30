import { z } from 'zod';
import fetch from 'node-fetch';
const BodySchema = z.object({
    lines: z.array(z.string()).min(1).max(200),
});
/** Translate a single text via MyMemory (free, no key, 5000 chars/day per IP). */
async function myMemory(text) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ru|en`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok)
        throw new Error(`MyMemory ${resp.status}`);
    const data = (await resp.json());
    if (data.responseStatus !== 200)
        throw new Error(`MyMemory error ${data.responseStatus}`);
    return data.responseData.translatedText ?? text;
}
/** Split lines into batches ≤ 450 chars to stay within MyMemory per-request limit. */
function batchLines(lines) {
    const batches = [];
    let current = [];
    let len = 0;
    for (const line of lines) {
        if (len + line.length + 3 > 450 && current.length) {
            batches.push(current);
            current = [];
            len = 0;
        }
        current.push(line);
        len += line.length + 3;
    }
    if (current.length)
        batches.push(current);
    return batches;
}
export const translateRoute = async (app) => {
    app.post('/translate', async (request, reply) => {
        const parsed = BodySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Invalid body: expected { lines: string[] }' });
        }
        const { lines } = parsed.data;
        const SEP = ' | ';
        const batches = batchLines(lines);
        const translations = [];
        try {
            for (const batch of batches) {
                const joined = batch.join(SEP);
                const translated = await myMemory(joined);
                const parts = translated.split(SEP);
                batch.forEach((_, i) => translations.push(parts[i]?.trim() ?? ''));
            }
            return { translations };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            app.log.warn({ err }, 'translation failed');
            return reply.code(502).send({ error: `Translation failed: ${msg}` });
        }
    });
};
//# sourceMappingURL=translate.js.map