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
  const courierOnly = { preHandler: fastify.authorize(['courier']) };

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
    const order = await acceptDelivery({
      orderId: request.params.orderId,
      courierId: request.user.sub,
      logger: request.log
    });
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

  fastify.post('/deliveries/payouts', courierOnly, async (request, reply) => {
    const rawAmount = Number(request.body?.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw BadRequest('amount deve ser maior que zero');
    const amount = Math.round(rawAmount * 100) / 100;

    const courier = await User.findOneAndUpdate(
      {
        _id: request.user.sub,
        role: 'courier',
        isActive: true,
        $expr: {
          $gte: [
            { $subtract: [{ $ifNull: ['$courierProfile.balance', 0] }, { $ifNull: ['$courierProfile.reservedBalance', 0] }] },
            amount
          ]
        }
      },
      { $inc: { 'courierProfile.reservedBalance': amount }, $push: { 'courierProfile.payoutRequests': { amount, status: 'pending' } } },
      { new: true, projection: { 'courierProfile.balance': 1, 'courierProfile.reservedBalance': 1, 'courierProfile.payoutRequests': { $slice: -1 } } }
    );

    if (!courier) throw BadRequest('Saldo disponível insuficiente para solicitar este saque');
    const payout = courier.courierProfile.payoutRequests[0];
    reply.code(201).send({
      id: payout._id,
      amount: payout.amount,
      status: payout.status,
      requestedAt: payout.requestedAt,
      availableBalance: Math.round((courier.courierProfile.balance - courier.courierProfile.reservedBalance) * 100) / 100
    });
  });

  fastify.get('/deliveries/payouts/mine', courierOnly, async (request, reply) => {
    const courier = await User.findById(request.user.sub).select('courierProfile.balance courierProfile.reservedBalance courierProfile.payoutRequests').lean();
    const payouts = [...(courier?.courierProfile?.payoutRequests || [])].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    reply.send({
      balance: courier?.courierProfile?.balance || 0,
      reservedBalance: courier?.courierProfile?.reservedBalance || 0,
      availableBalance: Math.max(0, (courier?.courierProfile?.balance || 0) - (courier?.courierProfile?.reservedBalance || 0)),
      payouts
    });
  });
}
