import { z } from 'zod';
import { slugSchema } from './validation';

export function assertOrigin(request: Request, appUrl?: string) {
  const expected = new URL(appUrl || request.url).origin;
  if (request.headers.get('origin') !== expected) throw new Error('Origem da solicitação inválida.');
}

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const stamp = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === value;
}, 'Data inválida.');
export const availabilitySchema = z.object({
  slug: slugSchema, serviceId: z.string().uuid(), barberId: z.string().uuid(),
  date: dateSchema, exclude: z.string().uuid().optional(),
});
export const emailSchema = z.string().trim().email().max(254);
export const passwordSchema = z.string().min(10, 'Use pelo menos 10 caracteres.').max(128);

// Public responses use an allowlist: SQL/Auth/network diagnostics must not reach visitors.
const bookingErrors = [
  'Agendamentos temporariamente indisponíveis. Entre em contato com a barbearia.',
  'Agendamentos indisponíveis.', 'Dados do cliente inválidos.',
  'Telefone inválido. Informe DDD e número brasileiro.',
  'Horário indisponível. Escolha outro horário.',
  'Limite de tentativas atingido. Tente mais tarde.',
  'Limite mensal de agendamentos atingido.',
];
export function publicError(error: unknown) {
  if (error instanceof z.ZodError) return 'Confira os dados informados.';
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (message === 'Origem da solicitação inválida.' || bookingErrors.includes(message)) return message;
  return 'Não foi possível concluir. Tente novamente.';
}
export async function readPublicJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Formato inválido.');
  // Bound the actual stream too: Content-Length can be absent or forged.
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Dados ausentes.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16_384) { await reader.cancel(); throw new Error('Dados excessivos.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all));
}
