import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Restaurant } from '../models/Restaurant.js';
import { Coupon } from '../models/Coupon.js';
import { ServiceArea } from '../models/ServiceArea.js';
import mongoose from 'mongoose';
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

export async function createOrder({ customerId, restaurantId, items, deliveryAddress, paymentMethod, couponCode }) {
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) throw BadRequest('restaurantId inválido');
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw NotFound('Restaurante não encontrado');
  if (!restaurant.isActive || !restaurant.isApproved) throw BadRequest('Restaurante indisponível');
  if (!restaurant.isOpen) throw BadRequest('Restaurante está fechado no momento');

  if (!Array.isArray(items) || !items.length || items.length > 100) throw BadRequest('O pedido deve ter entre 1 e 100 itens');
  if (items.some((item) => !item || !mongoose.Types.ObjectId.isValid(item.productId))) throw BadRequest('Cada item precisa de um productId válido');
  if (paymentMethod !== undefined && !['pix', 'dinheiro', 'cartao'].includes(paymentMethod)) throw BadRequest('paymentMethod inválido');

  const productIds = [...new Set(items.map((item) => String(item.productId)))];
  const products = await Product.find({ _id: { $in: productIds }, restaurant: restaurantId });

  if (products.length !== productIds.length) {
    throw BadRequest('Um ou mais itens não pertencem a este restaurante ou não existem');
  }

  const productMap = new Map(products.map((p) => [String(p._id), p]));
  let subtotalCents = 0;

  const orderItems = items.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) throw BadRequest('Um ou mais itens não pertencem a este restaurante ou não existem');
    if (!product.isAvailable) throw BadRequest(`Item indisponível: ${product.name}`);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw BadRequest('A quantidade de cada item deve ser um inteiro entre 1 e 99');
    const unitPriceCents = Math.round(product.price * 100);
    subtotalCents += unitPriceCents * quantity;
    return {
      product: product._id,
      name: product.name,
      unitPrice: unitPriceCents / 100,
      quantity,
      notes: item.notes
    };
  });

  const subtotal = subtotalCents / 100;
  if (subtotal < restaurant.minOrderValue) {
    throw BadRequest(`Valor mínimo do pedido é R$ ${restaurant.minOrderValue.toFixed(2)}`);
  }

  const resolvedAddress = {
    ...deliveryAddress,
    city: deliveryAddress?.city || restaurant.address.city,
    state: deliveryAddress?.state || restaurant.address.state
  };
  await assertDeliveryArea(resolvedAddress);

  const deliveryFeeCents = Math.round((restaurant.deliveryFee || 0) * 100);
  const deliveryFee = deliveryFeeCents / 100;
  let coupon;
  let discountAmount = 0;
  if (couponCode) {
    coupon = await claimCoupon({ couponCode, restaurant, city: resolvedAddress.city, subtotal });
    discountAmount = coupon.discountAmount;
  }

  const totalCents = Math.max(0, subtotalCents + deliveryFeeCents - Math.round(discountAmount * 100));
  const total = totalCents / 100;

  const order = new Order({
    customer: customerId,
    restaurant: restaurant._id,
    items: orderItems,
    subtotal,
    deliveryFee,
    discountAmount,
    coupon: coupon ? { id: coupon.id, code: coupon.code, discountAmount } : undefined,
    total,
    deliveryAddress: resolvedAddress,
    paymentMethod: paymentMethod || 'pix'
  });

  order.pushStatus(total === 0 ? 'confirmed' : 'pending', total === 0 ? 'Pedido liberado por cupom integral' : 'Pedido criado pelo cliente');
  try {
    await order.save();
  } catch (error) {
    if (coupon) await Coupon.updateOne({ _id: coupon.id, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } });
    throw error;
  }

  await publishOrderUpdate(order._id, { status: order.status, message: 'Pedido recebido' });
  return order;
}

async function assertDeliveryArea(address) {
  const city = String(address?.city || '').trim();
  const state = String(address?.state || '').trim().toUpperCase();
  if (!city || !state) throw BadRequest('Cidade e estado do endereço de entrega são obrigatórios');

  const areas = await ServiceArea.find({
    city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    state,
    isActive: true
  }).select('_id boundary').lean();
  if (!areas.length) throw BadRequest('O endereço está fora das cidades atendidas');

  const boundedAreas = areas.filter((area) => area.boundary);
  if (!boundedAreas.length) return;
  if (!Number.isFinite(address.lat) || !Number.isFinite(address.lng)) {
    throw BadRequest('Latitude e longitude são obrigatórias para validar a área de entrega');
  }

  const inside = await ServiceArea.exists({
    _id: { $in: boundedAreas.map((area) => area._id) },
    boundary: { $geoIntersects: { $geometry: { type: 'Point', coordinates: [address.lng, address.lat] } } }
  });
  if (!inside) throw BadRequest('O endereço está fora das áreas de entrega ativas');
}

async function claimCoupon({ couponCode, restaurant, city, subtotal }) {
  const code = String(couponCode).trim().toUpperCase();
  const coupon = await Coupon.findOne({ code }).lean();
  const now = new Date();
  if (!coupon || !coupon.isActive || coupon.startsAt > now || (coupon.expiresAt && coupon.expiresAt <= now)) {
    throw BadRequest('Cupom inválido ou expirado');
  }
  if (subtotal < coupon.minimumSubtotal) throw BadRequest('O pedido não atingiu o valor mínimo do cupom');
  if (coupon.city && coupon.city.toLowerCase() !== city.toLowerCase()) throw BadRequest('Cupom não disponível nesta cidade');
  const restaurantIds = coupon.restaurantIds || [];
  if (restaurantIds.length && !restaurantIds.some((id) => String(id) === String(restaurant._id))) {
    throw BadRequest('Cupom não disponível para este restaurante');
  }
  if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) throw BadRequest('Cupom esgotado');

  let discountAmount = coupon.discountType === 'percentage'
    ? subtotal * coupon.discountValue / 100
    : coupon.discountValue;
  if (coupon.maximumDiscount !== undefined) discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
  discountAmount = Math.round(Math.min(subtotal, discountAmount) * 100) / 100;

  const claimed = await Coupon.findOneAndUpdate(
    {
      _id: coupon._id,
      isActive: true,
      revision: coupon.revision || 0,
      startsAt: { $lte: now },
      $and: [
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [
          { maxRedemptions: { $exists: false } },
          { maxRedemptions: null },
          { $expr: { $lt: ['$redemptionCount', '$maxRedemptions'] } }
        ] }
      ]
    },
    { $inc: { redemptionCount: 1 } },
    { new: true }
  ).select('_id');
  if (!claimed) throw BadRequest('O cupom acabou de ser utilizado ou foi desativado; tente novamente');

  return { id: coupon._id, code: coupon.code, discountAmount };
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
  const order = await Order.findById(orderId).populate('restaurant', 'owner');
  if (!order) throw NotFound('Pedido não encontrado');

  const isCustomer = String(order.customer) === String(requesterId);
  const isRestaurantOwner = requesterRole === 'restaurant_owner' && String(order.restaurant.owner) === String(requesterId);
  if (!isCustomer && !isRestaurantOwner) {
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
