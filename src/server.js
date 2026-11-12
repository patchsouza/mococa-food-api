import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';

import { env } from './config/env.js'; // já carrega 'dotenv/config' internamente
import { connectDatabase } from './config/database.js';
import { redis } from './config/redis.js';
import { schedulePixExpiration } from './jobs/pixExpiration.job.js';

import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import orderRoutes from './routes/order.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import pixRoutes from './routes/pix.routes.js';

import { HttpError } from './utils/errors.js';

const fastify = Fastify({
  logger: {
    level: env.nodeEnv === 'production' ? 'info' : 'debug',
    transport: env.nodeEnv === 'production' ? undefined : { target: 'pino-pretty' }
  }
});

// --- Tratamento centralizado de erros ---
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof HttpError) {
    return reply.code(error.statusCode).send({ error: error.message, details: error.details });
  }
  if (error.validation) {
    return reply.code(400).send({ error: 'Dados inválidos', details: error.validation });
  }
  request.log.error(error);
  reply.code(500).send({ error: 'Erro interno do servidor' });
});

async function bootstrap() {
  await connectDatabase(fastify.log);
  await redis.ping();
  fastify.log.info('Redis conectado');

  await fastify.register(cors, { origin: true });
  await fastify.register(sensible);
  await fastify.register(authPlugin);

  fastify.get('/health', async () => ({ status: 'ok', service: 'mococa-food-api' }));

  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(restaurantRoutes, { prefix: '/api' });
  await fastify.register(orderRoutes, { prefix: '/api' });
  await fastify.register(deliveryRoutes, { prefix: '/api' });
  await fastify.register(dashboardRoutes, { prefix: '/api' });
  await fastify.register(pixRoutes, { prefix: '/api' });

  await fastify.listen({ port: env.port, host: env.host });
  fastify.log.info(`Mococa Food API rodando em http://${env.host}:${env.port}`);

  // Job periódico: expira transações Pix vencidas e cancela pedidos associados
  if (env.pixEnabled) {
    schedulePixExpiration(fastify.log);
  }
}

bootstrap().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
