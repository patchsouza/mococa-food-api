import { redis } from '../config/redis.js';

// Busca no cache; se não existir, executa fetchFn, salva no cache com TTL e retorna.
export async function cacheAside(key, ttlSeconds, fetchFn) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const fresh = await fetchFn();
  if (fresh !== undefined && fresh !== null) {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
  }
  return fresh;
}

export async function invalidateCache(...keys) {
  if (keys.length) await redis.del(...keys);
}
