import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Calcula a assinatura HMAC-SHA256 do corpo de um webhook.
 * O gateway/banco deve enviar o header `x-webhook-signature` com o hex desta assinatura.
 */
export function computeWebhookSignature(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Valida a assinatura do webhook em tempo constante (timing-safe).
 * @param {string|Buffer} rawBody - corpo bruto da requisição (string exata recebida)
 * @param {string} signature - assinatura enviada no header
 * @param {string} secret - segredo compartilhado (env.pixWebhookSecret)
 */
export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || typeof signature !== 'string') return false;

  const expected = computeWebhookSignature(rawBody, secret);

  // Suporta formato "sha256=<hex>" (comum em gateways como Stripe/Asaas/Efí)
  const received = signature.startsWith('sha256=') ? signature.slice(7) : signature;

  if (received.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}
