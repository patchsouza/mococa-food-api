import {
  createOrder,
  getOrderOrThrow,
  listCustomerOrders,
  listRestaurantOrders,
  cancelOrder,
  advanceOrderStatus
} from '../services/order.service.js';
import { subscribeToOrder } from '../services/notification.service.js';
import { Restaurant } from '../models/Restaurant.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';

export default async function orderRoutes(fastify) {
  // ---- 3. Fazer pedidos como cliente ----
  fastify.post('/orders', { preHandler: fastify.authorize(['customer']) }, async (request, reply) => {
    const { restaurantId, items, deliveryAddress, paymentMethod } = request.body || {};
    if (!restaurantId) throw BadRequest('restaurantId é obrigatório');

    const order = await createOrder({
      customerId: request.user.sub,
      restaurantId,
      items,
      deliveryAddress,
      paymentMethod
    });

    reply.code(201).send(order);
  });

  // ---- 4. Gerenciar pedidos como cliente ----
  fastify.get('/orders/mine', { preHandler: fastify.authorize(['customer']) }, async (request, reply) => {
    const orders = await listCustomerOrders(request.user.sub, { status: request.query?.status });
    reply.send(orders);
  });

  fastify.get('/orders/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const order = await getOrderOrThrow(request.params.id);

    const { sub, role } = request.user;
    const isCustomer = String(order.customer._id || order.customer) === String(sub);
    const isCourier = order.courier && String(order.courier._id || order.courier) === String(sub);
    const isOwner = String(order.restaurant.owner) === String(sub);

    if (!isCustomer && !isCourier && !isOwner && role !== 'admin') {
      throw Forbidden('Você não tem acesso a este pedido');
    }

    reply.send(order);
  });

  fastify.post('/orders/:id/cancel', { preHandler: fastify.authenticate }, async (request, reply) => {
    const order = await cancelOrder({
      orderId: request.params.id,
      requesterId: request.user.sub,
      requesterRole: request.user.role,
      reason: request.body?.reason
    });
    reply.send(order);
  });

  // ---- 5. Esperar entrega a ser feita (acompanhamento em tempo real via SSE) ----
  fastify.get('/orders/:id/stream', { preHandler: fastify.authenticate }, async (request, reply) => {
    const order = await getOrderOrThrow(request.params.id);
    const { sub, role } = request.user;
    const isCustomer = String(order.customer._id || order.customer) === String(sub);
    if (!isCustomer && role !== 'admin') throw Forbidden('Apenas o cliente do pedido pode acompanhar');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    // Envia o estado atual imediatamente ao conectar
    reply.raw.write(`data: ${JSON.stringify({ status: order.status, message: 'Conectado' })}\n\n`);

    const unsubscribe = subscribeToOrder(order._id, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.status === 'delivered' || event.status === 'cancelled') {
        reply.raw.end();
      }
    });

    request.raw.on('close', unsubscribe);
  });

  // ---- Gerenciamento de pedidos pelo restaurante (parte de "gerenciar restaurante") ----
  fastify.get(
    '/restaurants/:id/orders',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await Restaurant.findById(request.params.id);
      if (!restaurant) throw NotFound('Restaurante não encontrado');
      if (String(restaurant.owner) !== String(request.user.sub)) {
        throw Forbidden('Este restaurante não pertence a você');
      }

      const orders = await listRestaurantOrders(restaurant._id, { status: request.query?.status });
      reply.send(orders);
    }
  );

  fastify.patch(
    '/orders/:id/status',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const { nextStatus, note } = request.body || {};
      if (!nextStatus) throw BadRequest('nextStatus é obrigatório');

      const order = await advanceOrderStatus({
        orderId: request.params.id,
        restaurantOwnerId: request.user.sub,
        nextStatus,
        note
      });

      reply.send(order);
    }
  );
}
