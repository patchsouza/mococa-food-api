import { redis, RedisKeys } from '../config/redis.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../utils/errors.js';
import { publishOrderUpdate } from './notification.service.js';
import { env } from '../config/env.js';

// Entregador atualiza sua localização ao vivo (GEOADD) — chamado periodicamente pelo app
export async function updateCourierLocation({ courierId, lat, lng }) {
  await redis.geoadd(RedisKeys.couriersGeoSet, lng, lat, String(courierId));
  await User.findByIdAndUpdate(courierId, {
    'courierProfile.currentLocation': { lat, lng, updatedAt: new Date() }
  });
}

// Entregador liga/desliga disponibilidade para receber corridas
export async function setCourierAvailability({ courierId, isAvailable }) {
  if (isAvailable) {
    await redis.sadd(RedisKeys.courierAvailableSet, String(courierId));
  } else {
    await redis.srem(RedisKeys.courierAvailableSet, String(courierId));
  }
  await User.findByIdAndUpdate(courierId, { 'courierProfile.isAvailable': isAvailable });
}

// Busca entregadores disponíveis num raio (km) ao redor de um ponto, ordenados por distância
async function findNearbyAvailableCouriers(lat, lng, radiusKm) {
  const results = await redis.geosearch(
    RedisKeys.couriersGeoSet,
    'FROMLONLAT',
    lng,
    lat,
    'BYRADIUS',
    radiusKm,
    'km',
    'ASC'
  );
  if (!results.length) return [];

  const availableSet = new Set(await redis.smembers(RedisKeys.courierAvailableSet));
  return results.filter((courierId) => availableSet.has(courierId));
}

// Quando o pedido fica pronto, oferece a corrida para os entregadores próximos disponíveis.
// A oferta é uma fila (LIST) por entregador; cada entregador consulta suas próprias ofertas.
export async function enqueueDeliveryOffer(order) {
  const restaurant = order.restaurant;
  const nearbyCouriers = await findNearbyAvailableCouriers(
    restaurant.address.lat,
    restaurant.address.lng,
    env.deliverySearchRadiusKm
  );

  if (!nearbyCouriers.length) {
    // Nenhum entregador disponível agora — o pedido permanece em "awaiting_courier"
    // e pode ser reprocessado por um job/worker (ex.: novo entregador fica disponível).
    return { offered: 0 };
  }

  const pipeline = redis.pipeline();
  for (const courierId of nearbyCouriers) {
    pipeline.lpush(RedisKeys.courierOffers(courierId), String(order._id));
    pipeline.expire(RedisKeys.courierOffers(courierId), env.courierOfferTtlSeconds);
  }
  await pipeline.exec();

  return { offered: nearbyCouriers.length };
}

// Lista as ofertas de corrida pendentes para um entregador específico
export async function listOffersForCourier(courierId) {
  const orderIds = await redis.lrange(RedisKeys.courierOffers(courierId), 0, -1);
  if (!orderIds.length) return [];

  const orders = await Order.find({
    _id: { $in: orderIds },
    status: 'awaiting_courier'
  }).populate('restaurant', 'name address').populate('customer', 'name');

  return orders;
}

// Entregador aceita a corrida — usa um lock distribuído (SET NX) para garantir
// que apenas um entregador consiga fechar o pedido em caso de corrida simultânea.
export async function acceptDelivery({ orderId, courierId }) {
  const lockKey = RedisKeys.orderAcceptLock(orderId);
  const acquired = await redis.set(lockKey, String(courierId), 'NX', 'EX', 10);

  if (!acquired) {
    throw Conflict('Esta corrida já foi aceita por outro entregador');
  }

  try {
    const order = await Order.findById(orderId).populate('restaurant');
    if (!order) throw NotFound('Pedido não encontrado');
    if (order.status !== 'awaiting_courier') {
      throw Conflict(`Pedido não está mais disponível (status atual: ${order.status})`);
    }

    const courier = await User.findById(courierId);
    if (!courier || courier.role !== 'courier') throw Forbidden('Usuário não é um entregador');

    order.courier = courier._id;
    order.pushStatus('in_delivery', `Entregador ${courier.name} aceitou a corrida`);
    order.estimatedDeliveryAt = new Date(Date.now() + 30 * 60 * 1000);
    await order.save();

    // Remove o entregador da disponibilidade e limpa a fila de ofertas dele
    await redis.srem(RedisKeys.courierAvailableSet, String(courierId));
    await redis.del(RedisKeys.courierOffers(courierId));

    await publishOrderUpdate(order._id, {
      status: 'in_delivery',
      message: 'Entregador a caminho do restaurante'
    });

    return order;
  } finally {
    await redis.del(lockKey);
  }
}

// Entregador recusa a corrida: apenas remove essa oferta específica da sua fila
export async function rejectDelivery({ orderId, courierId }) {
  await redis.lrem(RedisKeys.courierOffers(courierId), 0, String(orderId));
  return { rejected: true };
}

// Entregador marca a entrega como concluída
export async function completeDelivery({ orderId, courierId }) {
  const order = await Order.findById(orderId);
  if (!order) throw NotFound('Pedido não encontrado');
  if (String(order.courier) !== String(courierId)) {
    throw Forbidden('Esta corrida não pertence a você');
  }
  if (order.status !== 'in_delivery') {
    throw Conflict(`Pedido em status "${order.status}" não pode ser finalizado`);
  }

  order.pushStatus('delivered', 'Entrega concluída');
  order.deliveredAt = new Date();
  await order.save();

  await User.findByIdAndUpdate(courierId, {
    $inc: { 'courierProfile.totalDeliveries': 1, 'courierProfile.balance': order.deliveryFee }
  });

  // Volta a ficar disponível automaticamente após concluir a corrida
  await redis.sadd(RedisKeys.courierAvailableSet, String(courierId));

  await publishOrderUpdate(order._id, { status: 'delivered', message: 'Pedido entregue' });
  return order;
}

export async function listCourierActiveDeliveries(courierId) {
  return Order.find({ courier: courierId, status: 'in_delivery' })
    .populate('restaurant', 'name address phone')
    .populate('customer', 'name phone');
}

export async function listCourierDeliveryHistory(courierId) {
  return Order.find({ courier: courierId, status: 'delivered' })
    .sort({ deliveredAt: -1 })
    .limit(100)
    .populate('restaurant', 'name');
}
