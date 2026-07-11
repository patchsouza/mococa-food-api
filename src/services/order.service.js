import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Restaurant } from '../models/Restaurant.js';
import { BadRequest, NotFound, Forbidden, Conflict } from '../utils/errors.js';
import { publishOrderUpdate } from './notification.service.js';
import { enqueueDeliveryOffer } from './delivery.service.js';

// Transições permitidas para o status do pedido
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['awaiting_courier', 'cancelled'],
  awaiting_courier: ['in_delivery', 'cancelled'],
  in_delivery: ['delivered'],
  delivered: [],
  cancelled: []
};

export async function createOrder({ customerId, restaurantId, items, deliveryAddress, paymentMethod }) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw NotFound('Restaurante não encontrado');
  if (!restaurant.isOpen) throw BadRequest('Restaurante está fechado no momento');

  if (!items?.length) throw BadRequest('O pedido precisa ter ao menos 1 item');

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, restaurant: restaurantId });

  if (products.length !== productIds.length) {
    throw BadRequest('Um ou mais itens não pertencem a este restaurante ou não existem');
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  let subtotal = 0;

  const orderItems = items.map((i) => {
    const product = productMap.get(i.productId);
    if (!product.isAvailable) throw BadRequest(`Item indisponível: ${product.name}`);
    const quantity = Number(i.quantity || 1);
    subtotal += product.price * quantity;
    return {
      product: product._id,
      name: product.name,
      unitPrice: product.price,
      quantity,
      notes: i.notes
    };
  });

  if (subtotal < restaurant.minOrderValue) {
    throw BadRequest(`Valor mínimo do pedido é R$ ${restaurant.minOrderValue.toFixed(2)}`);
  }

  const total = subtotal + (restaurant.deliveryFee || 0);

  const order = new Order({
    customer: customerId,
    restaurant: restaurant._id,
    items: orderItems,
    subtotal,
    deliveryFee: restaurant.deliveryFee || 0,
    total,
    deliveryAddress,
    paymentMethod: paymentMethod || 'pix'
  });

  order.pushStatus('pending', 'Pedido criado pelo cliente');
  await order.save();

  await publishOrderUpdate(order._id, { status: order.status, message: 'Pedido recebido' });
  return order;
}

export async function getOrderOrThrow(orderId) {
  const order = await Order.findById(orderId).populate('restaurant').populate('courier', 'name phone courierProfile');
  if (!order) throw NotFound('Pedido não encontrado');
  return order;
}

export async function listCustomerOrders(customerId, { status } = {}) {
  const filter = { customer: customerId };
  if (status) filter.status = status;
  return Order.find(filter).sort({ createdAt: -1 }).populate('restaurant', 'name logoUrl');
}

export async function listRestaurantOrders(restaurantId, { status } = {}) {
  const filter = { restaurant: restaurantId };
  if (status) filter.status = status;
  return Order.find(filter).sort({ createdAt: -1 }).populate('customer', 'name phone');
}

export async function cancelOrder({ orderId, requesterId, requesterRole, reason }) {
  const order = await Order.findById(orderId);
  if (!order) throw NotFound('Pedido não encontrado');

  const isOwnerOfOrder = String(order.customer) === String(requesterId);
  if (!isOwnerOfOrder && requesterRole !== 'admin' && requesterRole !== 'restaurant_owner') {
    throw Forbidden('Você não pode cancelar este pedido');
  }

  if (!ALLOWED_TRANSITIONS[order.status]?.includes('cancelled')) {
    throw Conflict(`Pedido em status "${order.status}" não pode mais ser cancelado`);
  }

  order.cancelReason = reason || 'Sem motivo informado';
  order.pushStatus('cancelled', order.cancelReason);
  await order.save();

  await publishOrderUpdate(order._id, { status: 'cancelled', message: 'Pedido cancelado' });
  return order;
}

// Usado pelo restaurante para avançar o pedido: confirmed -> preparing -> ready_for_pickup
export async function advanceOrderStatus({ orderId, restaurantOwnerId, nextStatus, note }) {
  const order = await Order.findById(orderId).populate('restaurant');
  if (!order) throw NotFound('Pedido não encontrado');

  if (String(order.restaurant.owner) !== String(restaurantOwnerId)) {
    throw Forbidden('Este pedido não pertence ao seu restaurante');
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw Conflict(`Não é possível ir de "${order.status}" para "${nextStatus}"`);
  }

  order.pushStatus(nextStatus, note);
  await order.save();
  await publishOrderUpdate(order._id, { status: nextStatus, message: note });

  // Quando o restaurante marca como pronto para retirada, dispara a busca por entregador
  if (nextStatus === 'ready_for_pickup') {
    order.pushStatus('awaiting_courier', 'Buscando entregador disponível');
    await order.save();
    await publishOrderUpdate(order._id, { status: 'awaiting_courier', message: 'Buscando entregador...' });
    await enqueueDeliveryOffer(order);
  }

  return order;
}
