import { Restaurant } from '../models/Restaurant.js';
import { Order } from '../models/Order.js';
import { Forbidden, NotFound } from '../utils/errors.js';

export default async function dashboardRoutes(fastify) {
  // Dashboard do dono do restaurante: pedidos ativos + métricas do dia
  fastify.get(
    '/restaurants/:id/dashboard',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await Restaurant.findById(request.params.id);
      if (!restaurant) throw NotFound('Restaurante não encontrado');
      if (String(restaurant.owner) !== String(request.user.sub)) {
        throw Forbidden('Este restaurante não pertence a você');
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [activeOrders, ordersToday] = await Promise.all([
        Order.find({
          restaurant: restaurant._id,
          status: { $in: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'awaiting_courier', 'in_delivery'] }
        }).sort({ createdAt: 1 }).populate('customer', 'name phone'),
        Order.find({ restaurant: restaurant._id, createdAt: { $gte: todayStart } })
      ]);

      const deliveredToday = ordersToday.filter((o) => o.status === 'delivered');
      const revenueToday = deliveredToday.reduce((sum, o) => sum + o.total, 0);
      const cancelledToday = ordersToday.filter((o) => o.status === 'cancelled').length;

      reply.send({
        restaurant: { id: restaurant._id, name: restaurant.name, isOpen: restaurant.isOpen },
        activeOrders,
        ordersToday: ordersToday.length,
        deliveredToday: deliveredToday.length,
        cancelledToday,
        revenueToday
      });
    }
  );
}
