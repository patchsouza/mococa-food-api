import Redis from 'ioredis';
import { env } from './env.js';

// Cliente principal: comandos gerais (cache, geo, locks, sets)
export const redis = new Redis(env.redisUrl, {
  lazyConnect: false,
  maxRetriesPerRequest: 3
});

// Cliente dedicado para publicar eventos (pub/sub)
export const redisPub = new Redis(env.redisUrl);

// Cliente dedicado para subscrever eventos (uma conexão em modo subscribe
// não pode executar outros comandos, por isso é separado)
export const redisSub = new Redis(env.redisUrl);

redis.on('error', (err) => console.error('[redis] erro:', err.message));
redisPub.on('error', (err) => console.error('[redis-pub] erro:', err.message));
redisSub.on('error', (err) => console.error('[redis-sub] erro:', err.message));

// --- Chaves e prefixos usados no app (documentação central) ---
export const RedisKeys = {
  restaurantCache: (id) => `cache:restaurant:${id}`,
  restaurantMenuCache: (id) => `cache:restaurant:${id}:menu`,
  restaurantListCache: (city) => `cache:restaurants:list:${city || 'all'}`,

  couriersGeoSet: 'couriers:geo', // GEOADD/GEOSEARCH: localizações ao vivo
  courierAvailableSet: 'couriers:available', // SET de couriers disponíveis
  courierOffers: (courierId) => `courier:${courierId}:offers`, // LIST de ofertas de corrida

  orderAcceptLock: (orderId) => `lock:order:${orderId}:accept`, // evita 2 entregadores aceitarem a mesma corrida
  orderStatusChannel: (orderId) => `order:${orderId}:status`, // pub/sub para o cliente acompanhar em tempo real

  loginAttempts: (email) => `security:login-attempts:${email}`
};
