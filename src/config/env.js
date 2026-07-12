export const env = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  // ao que tudo indica, o MONGO_URI não está sendo carregado. Testar posteriormente a hipotese do dotenv.
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://mcc_food_adm:QHRu6DezHe9xcxay@cluster0.g4rnf8m.mongodb.net/?appName=Cluster0',
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
