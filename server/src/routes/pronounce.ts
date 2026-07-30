import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const BodySchema = z.object({
  words: z.array(z.string()).min(1).max(500),
});

const TRANSLIT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'ye',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:"'",э:'e',ю:'yu',я:'ya',
};

function romanise(word: string): string {
  return word.toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('');
}

export const pronounceRoute: FastifyPluginAsync = async (app) => {
  app.post('/pronounce', async (request, reply) => {
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body: expected { words: string[] }' });
    }
    const pronunciations = parsed.data.words.map((w) =>
      romanise(w.replace(/[^а-яёА-ЯЁ]/g, ''))
    );
    return { pronunciations };
  });
};
