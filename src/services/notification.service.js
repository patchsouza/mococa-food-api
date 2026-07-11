import { redisPub, redisSub, RedisKeys } from '../config/redis.js';

// Publica uma atualização de status de pedido no canal Redis correspondente.
// Quem estiver "esperando a entrega" (SSE) recebe isso instantaneamente.
export async function publishOrderUpdate(orderId, payload) {
  const channel = RedisKeys.orderStatusChannel(orderId);
  await redisPub.publish(channel, JSON.stringify({ ...payload, orderId: String(orderId), at: new Date() }));
}

// Assina o canal de um pedido específico e chama onMessage a cada evento.
// Retorna uma função de "unsubscribe" para ser chamada quando a conexão SSE fechar.
export function subscribeToOrder(orderId, onMessage) {
  const channel = RedisKeys.orderStatusChannel(orderId);

  const handler = (chan, message) => {
    if (chan === channel) onMessage(JSON.parse(message));
  };

  redisSub.subscribe(channel);
  redisSub.on('message', handler);

  return () => {
    redisSub.unsubscribe(channel);
    redisSub.off('message', handler);
  };
}
