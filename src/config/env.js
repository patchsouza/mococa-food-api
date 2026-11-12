// Carrega variáveis do arquivo .env para process.env (se existir).
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

// Em produção as variáveis sensíveis são OBRIGATÓRIAS — sem fallbacks hardcoded.
if (isProduction) {
  const required = ['MONGO_URI', 'JWT_SECRET', 'PIX_WEBHOOK_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes em produção: ${missing.join(', ')}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  // NUNCA coloque credenciais reais aqui. Use o arquivo .env (fora do Git).
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mococa_food',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtSecret: process.env.JWT_SECRET || 'troque-este-segredo-em-producao',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  deliverySearchRadiusKm: Number(process.env.DELIVERY_SEARCH_RADIUS_KM || 6),
  courierOfferTtlSeconds: Number(process.env.COURIER_OFFER_TTL_SECONDS || 25),
  
  // Configurações Pix
  pixEnabled: process.env.PIX_ENABLED === 'true' || true,
  pixExpirationMinutes: Number(process.env.PIX_EXPIRATION_MINUTES || 30),
  pixWebhookSecret: process.env.PIX_WEBHOOK_SECRET || 'segredo-webhook-pix'
};
