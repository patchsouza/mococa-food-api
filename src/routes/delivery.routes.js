import {
  updateCourierLocation,
  setCourierAvailability,
  listOffersForCourier,
  acceptDelivery,
  rejectDelivery,
  completeDelivery,
  listCourierActiveDeliveries,
  listCourierDeliveryHistory
} from '../services/delivery.service.js';
import { User } from '../models/User.js';
import { BadRequest } from '../utils/errors.js';

export default async function deliveryRoutes(fastify) {
  const courierOnly = { preHandler: fastify.authorize(['courier', 'admin']) };

  // Atualiza localização ao vivo do entregador (chamado periodicamente pelo app, ex: a cada 10s)
  fastify.post('/deliveries/location', courierOnly, async (request, reply) => {
    const { lat, lng } = request.body || {};
    if (lat === undefined || lng === undefined) throw BadRequest('lat e lng são obrigatórios');

    await updateCourierLocation({ courierId: request.user.sub, lat, lng });
    reply.send({ ok: true });
  });

  // Liga/desliga disponibilidade para receber corridas
  fastify.post('/deliveries/availability', courierOnly, async (request, reply) => {
    const { isAvailable } = request.body || {};
    await setCourierAvailability({ courierId: request.user.sub, isAvailable: Boolean(isAvailable) });
    reply.send({ isAvailable: Boolean(isAvailable) });
  });

  // ---- 6. Lado do entregador: aceitar ou recusar novas corridas ----
  fastify.get('/deliveries/offers', courierOnly, async (request, reply) => {
    const offers = await listOffersForCourier(request.user.sub);
    reply.send(offers);
  });

  fastify.post('/deliveries/:orderId/accept', courierOnly, async (request, reply) => {
    const order = await acceptDelivery({ orderId: request.params.orderId, courierId: request.user.sub });
    reply.send(order);
  });

  fastify.post('/deliveries/:orderId/reject', courierOnly, async (request, reply) => {
    const result = await rejectDelivery({ orderId: request.params.orderId, courierId: request.user.sub });
    reply.send(result);
  });

  fastify.post('/deliveries/:orderId/complete', courierOnly, async (request, reply) => {
    const order = await completeDelivery({ orderId: request.params.orderId, courierId: request.user.sub });
    reply.send(order);
  });

  // ---- 7. Ver sua lista de corridas (ativas e histórico) ----
  fastify.get('/deliveries/mine/active', courierOnly, async (request, reply) => {
    const active = await listCourierActiveDeliveries(request.user.sub);
    reply.send(active);
  });

  fastify.get('/deliveries/mine/history', courierOnly, async (request, reply) => {
    const history = await listCourierDeliveryHistory(request.user.sub);
    reply.send(history);
  });

  // ---- 8. Dashboard do entregador ----
  fastify.get('/deliveries/dashboard', courierOnly, async (request, reply) => {
    const user = await User.findById(request.user.sub).select('name courierProfile');
    const [active, history] = await Promise.all([
      listCourierActiveDeliveries(request.user.sub),
      listCourierDeliveryHistory(request.user.sub)
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const deliveredToday = history.filter((o) => o.deliveredAt >= todayStart);
    const earningsToday = deliveredToday.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

    reply.send({
      courier: {
        name: user.name,
        isAvailable: user.courierProfile.isAvailable,
        rating: user.courierProfile.rating,
        balance: user.courierProfile.balance,
        totalDeliveries: user.courierProfile.totalDeliveries
      },
      activeDeliveries: active,
      deliveriesToday: deliveredToday.length,
      earningsToday,
      recentHistory: history.slice(0, 10)
    });
  });
}
