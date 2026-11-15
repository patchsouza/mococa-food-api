import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Admin } from '../models/Admin.js';
import { AdminAudit } from '../models/AdminAudit.js';
import { Coupon } from '../models/Coupon.js';
import { Order } from '../models/Order.js';
import { PaymentLedger } from '../models/PaymentLedger.js';
import { Restaurant } from '../models/Restaurant.js';
import { ServiceArea } from '../models/ServiceArea.js';
import { User } from '../models/User.js';
import { redis, RedisKeys } from '../config/redis.js';
import { env } from '../config/env.js';
import { BadRequest, Conflict, NotFound, Unauthorized } from '../utils/errors.js';

const COMMON_USER_ROLES = ['customer', 'restaurant_owner', 'courier'];
const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'awaiting_courier', 'in_delivery'];

function parsePagination(query = {}) {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), 100);
  const skip = Math.max(Number.parseInt(query.skip, 10) || 0, 0);
  return { limit, skip };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireObjectId(value, label) {
  if (!mongoose.Types.ObjectId.isValid(value)) throw BadRequest(`${label} inválido`);
  return value;
}

async function audited(request, { action, resourceType, resourceId, reason, metadata }, operation) {
  const entry = await AdminAudit.create({
    admin: request.admin._id,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : undefined,
    reason,
    metadata,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  });

  try {
    const result = await operation();
    entry.result = 'success';
    await entry.save();
    return result;
  } catch (error) {
    entry.result = 'failed';
    entry.errorMessage = error.message;
    await entry.save().catch((auditError) => request.log.error({ err: auditError }, 'Falha ao atualizar trilha administrativa'));
    throw error;
  }
}

function validateCoupon(input) {
  if (!input.code || !/^[A-Z0-9_-]{3,40}$/i.test(input.code)) throw BadRequest('code deve conter de 3 a 40 caracteres alfanuméricos');
  if (!['fixed', 'percentage'].includes(input.discountType)) throw BadRequest('discountType deve ser fixed ou percentage');
  if (!Number.isFinite(Number(input.discountValue)) || Number(input.discountValue) <= 0) throw BadRequest('discountValue deve ser maior que zero');
  if (input.discountType === 'percentage' && Number(input.discountValue) > 100) throw BadRequest('Desconto percentual não pode exceder 100%');
  if (input.maximumDiscount !== undefined && Number(input.maximumDiscount) < 0) throw BadRequest('maximumDiscount não pode ser negativo');
  if (input.minimumSubtotal !== undefined && Number(input.minimumSubtotal) < 0) throw BadRequest('minimumSubtotal não pode ser negativo');
  if (input.maxRedemptions !== undefined && (!Number.isInteger(Number(input.maxRedemptions)) || Number(input.maxRedemptions) < 1)) {
    throw BadRequest('maxRedemptions deve ser um inteiro positivo');
  }
  if (input.startsAt && Number.isNaN(Date.parse(input.startsAt))) throw BadRequest('startsAt inválido');
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) throw BadRequest('expiresAt inválido');
  if (input.startsAt && input.expiresAt && new Date(input.expiresAt) <= new Date(input.startsAt)) {
    throw BadRequest('expiresAt deve ser posterior a startsAt');
  }
}

function validateBoundary(boundary) {
  if (boundary === undefined || boundary === null) return;
  if (boundary.type !== 'Polygon' || !Array.isArray(boundary.coordinates) || !Array.isArray(boundary.coordinates[0])) {
    throw BadRequest('boundary deve ser um GeoJSON Polygon');
  }
  for (const ring of boundary.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) throw BadRequest('Cada anel do polígono precisa de ao menos quatro coordenadas');
    for (const point of ring) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) {
        throw BadRequest('Cada coordenada deve ter longitude e latitude numéricas');
      }
      if (point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) {
        throw BadRequest('Coordenadas fora dos limites geográficos');
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw BadRequest('Os anéis do polígono devem ser fechados');
  }
}

function summaryFromAggregation(row = {}) {
  const grossAmountCents = row.grossAmountCents || 0;
  const deliveryFeeCents = row.deliveryFeeCents || 0;
  const deliveredDeliveryFeeCents = row.deliveredDeliveryFeeCents || 0;
  const goodsAmountCents = row.goodsAmountCents || 0;
  return {
    currency: 'BRL',
    paymentsCount: row.paymentsCount || 0,
    grossAmountCents,
    goodsAmountCents,
    deliveryFeeCents,
    deliveredDeliveryFeeCents,
    grossAmount: grossAmountCents / 100,
    goodsAmount: goodsAmountCents / 100,
    deliveryFeeAmount: deliveryFeeCents / 100,
    deliveredDeliveryFeeAmount: deliveredDeliveryFeeCents / 100,
    scope: 'Pagamentos Pix confirmados na conta central; dinheiro e cartão não estão integrados'
  };
}

export default async function adminRoutes(fastify) {
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) throw BadRequest('email e password são obrigatórios');

    const normalizedEmail = String(email).trim().toLowerCase();
    const attemptsKey = RedisKeys.adminLoginAttempts(normalizedEmail);
    const attempts = Number((await redis.get(attemptsKey)) || 0);
    if (attempts >= 10) throw Unauthorized('Muitas tentativas de login administrativo. Tente novamente em alguns minutos.');

    const admin = await Admin.findOne({ email: normalizedEmail }).select('+passwordHash');
    const validPassword = admin ? await bcrypt.compare(password, admin.passwordHash) : false;
    if (!admin || !validPassword || !admin.isActive) {
      await redis.multi().incr(attemptsKey).expire(attemptsKey, 300).exec();
      throw Unauthorized('E-mail ou senha inválidos');
    }

    await redis.del(attemptsKey);
    admin.lastLoginAt = new Date();
    await admin.save();
    const token = fastify.jwt.sign({ principalType: 'admin', sub: String(admin._id), sessionVersion: admin.sessionVersion }, { expiresIn: env.adminJwtExpiresIn });
    reply.send({
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, permissions: admin.permissions }
    });
  });

  fastify.get('/me', { preHandler: fastify.authorizeAdmin([]) }, async (request, reply) => {
    reply.send({ id: request.admin._id, name: request.admin.name, email: request.admin.email, permissions: request.admin.permissions });
  });

  fastify.post('/auth/logout', { preHandler: fastify.authorizeAdmin([]) }, async (request, reply) => {
    await Admin.updateOne({ _id: request.admin._id }, { $inc: { sessionVersion: 1 } });
    reply.code(204).send();
  });

  fastify.get('/dashboard', { preHandler: fastify.authorizeAdmin(['platform:read']) }, async (request, reply) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [pendingRestaurants, activeOrders, activeUsers, finance, recentOrders] = await Promise.all([
      Restaurant.countDocuments({ isApproved: false }),
      Order.countDocuments({ status: { $in: ACTIVE_ORDER_STATUSES } }),
      User.countDocuments({ isActive: true }),
      PaymentLedger.aggregate([
        { $match: { recordedAt: { $gte: startOfDay } } },
        { $group: { _id: null, grossAmountCents: { $sum: '$grossAmountCents' } } }
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).populate('restaurant', 'name').populate('customer', 'name').select('status total createdAt restaurant customer').lean()
    ]);
    reply.send({
      pendingRestaurants,
      activeOrders,
      activeUsers,
      paymentsToday: (finance[0]?.grossAmountCents || 0) / 100,
      recentOrders: recentOrders.map((order) => ({
        id: order._id,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        restaurant: order.restaurant?.name || 'Loja removida',
        customer: order.customer?.name || 'Cliente removido'
      }))
    });
  });

  fastify.get('/orders', { preHandler: fastify.authorizeAdmin(['platform:read']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.status) filter.status = request.query.status;
    if (request.query?.restaurantId) filter.restaurant = requireObjectId(request.query.restaurantId, 'restaurantId');
    const [items, total] = await Promise.all([
      Order.find(filter).populate('restaurant', 'name address.city').populate('customer', 'name email').populate('courier', 'name email')
        .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);
    reply.send({ items, total, limit, skip });
  });

  fastify.get('/users', { preHandler: fastify.authorizeAdmin(['accounts:write']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.role) {
      if (!COMMON_USER_ROLES.includes(request.query.role)) throw BadRequest('role inválido');
      filter.role = request.query.role;
    }
    if (request.query?.isActive !== undefined) filter.isActive = request.query.isActive === 'true';
    if (request.query?.search) {
      const search = new RegExp(escapeRegex(request.query.search), 'i');
      filter.$or = [{ name: search }, { email: search }, { phone: search }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select('name email phone role isActive createdAt courierProfile.balance courierProfile.reservedBalance').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    reply.send({ items: users, total, limit, skip });
  });

  fastify.patch('/users/:id/status', { preHandler: fastify.authorizeAdmin(['accounts:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const { isActive, reason } = request.body || {};
    if (typeof isActive !== 'boolean') throw BadRequest('isActive boolean é obrigatório');
    if (!isActive && !String(reason || '').trim()) throw BadRequest('reason é obrigatório para desativar uma conta');
    const user = await audited(request, {
      action: isActive ? 'user.activate' : 'user.deactivate',
      resourceType: 'User', resourceId: request.params.id, reason
    }, async () => {
      const updated = await User.findByIdAndUpdate(request.params.id, { $set: { isActive } }, { new: true }).select('name email role isActive');
      if (!updated) throw NotFound('Usuário não encontrado');
      if (updated.role === 'restaurant_owner' && !isActive) {
        await Restaurant.updateMany({ owner: updated._id, isActive: true }, { $set: { isActive: false } });
        await invalidateRestaurantCaches();
      }
      if (updated.role === 'courier' && !isActive) {
        await redis.srem(RedisKeys.courierAvailableSet, String(updated._id));
        await redis.zrem(RedisKeys.couriersGeoSet, String(updated._id));
        await User.updateOne({ _id: updated._id }, { $set: { 'courierProfile.isAvailable': false } });
      }
      return updated;
    });
    reply.send(user);
  });

  fastify.get('/restaurants', { preHandler: fastify.authorizeAdmin(['restaurants:write']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.isActive !== undefined) filter.isActive = request.query.isActive === 'true';
    if (request.query?.isApproved !== undefined) filter.isApproved = request.query.isApproved === 'true';
    if (request.query?.city) filter['address.city'] = new RegExp(`^${escapeRegex(request.query.city)}$`, 'i');
    const [items, total] = await Promise.all([
      Restaurant.find(filter).populate('owner', 'name email isActive').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Restaurant.countDocuments(filter)
    ]);
    reply.send({ items, total, limit, skip });
  });

  fastify.patch('/restaurants/:id/status', { preHandler: fastify.authorizeAdmin(['restaurants:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const { isActive, isApproved, reason } = request.body || {};
    if (typeof isActive !== 'boolean' && typeof isApproved !== 'boolean') throw BadRequest('Informe isActive e/ou isApproved');
    if ((isActive === false || isApproved === false) && !String(reason || '').trim()) throw BadRequest('reason é obrigatório para suspender ou recusar uma loja');
    const changes = {};
    if (typeof isActive === 'boolean') changes.isActive = isActive;
    if (typeof isApproved === 'boolean') changes.isApproved = isApproved;
    const restaurant = await audited(request, {
      action: 'restaurant.status.update', resourceType: 'Restaurant', resourceId: request.params.id, reason, metadata: changes
    }, async () => {
      const updated = await Restaurant.findByIdAndUpdate(request.params.id, { $set: changes }, { new: true });
      if (!updated) throw NotFound('Restaurante não encontrado');
      await invalidateRestaurantCaches(updated.address.city);
      return updated;
    });
    reply.send(restaurant);
  });

  fastify.get('/coupons', { preHandler: fastify.authorizeAdmin(['coupons:write']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.isActive !== undefined) filter.isActive = request.query.isActive === 'true';
    const [items, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Coupon.countDocuments(filter)
    ]);
    reply.send({ items, total, limit, skip });
  });

  fastify.post('/coupons', { preHandler: fastify.authorizeAdmin(['coupons:write']) }, async (request, reply) => {
    const input = { ...request.body, code: String(request.body?.code || '').trim().toUpperCase() };
    validateCoupon(input);
    const coupon = await audited(request, {
      action: 'coupon.create', resourceType: 'Coupon', reason: input.description,
      metadata: { code: input.code, discountType: input.discountType, discountValue: input.discountValue }
    }, () => Coupon.create({ ...input, redemptionCount: 0, revision: 0, createdBy: request.admin._id, updatedBy: request.admin._id }));
    reply.code(201).send(coupon);
  });

  fastify.patch('/coupons/:id', { preHandler: fastify.authorizeAdmin(['coupons:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const coupon = await Coupon.findById(request.params.id);
    if (!coupon) throw NotFound('Cupom não encontrado');
    const allowed = ['code', 'description', 'discountType', 'discountValue', 'maximumDiscount', 'minimumSubtotal', 'maxRedemptions', 'startsAt', 'expiresAt', 'city', 'restaurantIds', 'isActive'];
    for (const field of allowed) if (request.body?.[field] !== undefined) coupon[field] = field === 'code' ? String(request.body[field]).trim().toUpperCase() : request.body[field];
    if (request.body?.isActive !== undefined && typeof request.body.isActive !== 'boolean') throw BadRequest('isActive deve ser boolean');
    if (request.body?.isActive === false && !String(request.body?.reason || '').trim()) throw BadRequest('reason é obrigatório para cancelar um cupom');
    if (request.body?.restaurantIds !== undefined && (!Array.isArray(request.body.restaurantIds) || request.body.restaurantIds.some((id) => !mongoose.Types.ObjectId.isValid(id)))) {
      throw BadRequest('restaurantIds deve ser uma lista de IDs válidos');
    }
    validateCoupon(coupon);
    coupon.updatedBy = request.admin._id;
    coupon.revision += 1;
    await audited(request, {
      action: 'coupon.update', resourceType: 'Coupon', resourceId: coupon._id, reason: request.body?.reason, metadata: { code: coupon.code, isActive: coupon.isActive }
    }, () => coupon.save());
    reply.send(coupon);
  });

  fastify.delete('/coupons/:id', { preHandler: fastify.authorizeAdmin(['coupons:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const reason = String(request.body?.reason || '').trim();
    if (!reason) throw BadRequest('reason é obrigatório para cancelar um cupom');
    const coupon = await audited(request, {
      action: 'coupon.deactivate', resourceType: 'Coupon', resourceId: request.params.id, reason
    }, async () => {
      const updated = await Coupon.findByIdAndUpdate(request.params.id, { $set: { isActive: false, updatedBy: request.admin._id } }, { new: true });
      if (!updated) throw NotFound('Cupom não encontrado');
      return updated;
    });
    reply.send(coupon);
  });

  fastify.get('/service-areas', { preHandler: fastify.authorizeAdmin(['service-areas:write']) }, async (request, reply) => {
    const filter = {};
    if (request.query?.isActive !== undefined) filter.isActive = request.query.isActive === 'true';
    if (request.query?.city) filter.city = new RegExp(`^${escapeRegex(request.query.city)}$`, 'i');
    reply.send(await ServiceArea.find(filter).sort({ state: 1, city: 1, name: 1 }).lean());
  });

  fastify.post('/service-areas', { preHandler: fastify.authorizeAdmin(['service-areas:write']) }, async (request, reply) => {
    const input = request.body || {};
    if (!input.name || !input.city || !input.state) throw BadRequest('name, city e state são obrigatórios');
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw BadRequest('isActive deve ser boolean');
    validateBoundary(input.boundary);
    const slug = String(input.slug || input.name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    const area = await audited(request, {
      action: 'service-area.create', resourceType: 'ServiceArea', reason: input.name,
      metadata: { city: input.city, state: input.state, slug }
    }, async () => {
      const created = await ServiceArea.create({
        name: String(input.name).trim(),
        slug,
        city: String(input.city).trim(),
        state: String(input.state).trim().toUpperCase(),
        boundary: input.boundary,
        isActive: input.isActive ?? true,
        createdBy: request.admin._id,
        updatedBy: request.admin._id
      });
      await invalidateRestaurantCaches(created.city);
      return created;
    });
    reply.code(201).send(area);
  });

  fastify.patch('/service-areas/:id', { preHandler: fastify.authorizeAdmin(['service-areas:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const area = await ServiceArea.findById(request.params.id);
    if (!area) throw NotFound('Área de atendimento não encontrada');
    const hadBoundary = Boolean(area.boundary);
    const allowed = ['name', 'slug', 'city', 'state', 'boundary', 'isActive'];
    for (const field of allowed) if (request.body?.[field] !== undefined) area[field] = request.body[field];
    if (request.body?.isActive !== undefined && typeof request.body.isActive !== 'boolean') throw BadRequest('isActive deve ser boolean');
    if (request.body?.isActive === false && !String(request.body?.reason || '').trim()) throw BadRequest('reason é obrigatório para desativar uma área');
    if (request.body?.boundary === null && hadBoundary) throw BadRequest('Para remover uma área delimitada, desative-a e crie uma nova área sem polígono');
    if (request.body?.boundary !== undefined) validateBoundary(request.body.boundary);
    if (request.body?.slug !== undefined) area.slug = String(request.body.slug).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (request.body?.state !== undefined) area.state = String(request.body.state).trim().toUpperCase();
    if (request.body?.city !== undefined && !String(request.body.city).trim()) throw BadRequest('city não pode ser vazio');
    if (request.body?.city !== undefined) area.city = String(request.body.city).trim();
    if (request.body?.name !== undefined) area.name = String(request.body.name).trim();
    area.updatedBy = request.admin._id;
    await audited(request, {
      action: 'service-area.update', resourceType: 'ServiceArea', resourceId: area._id, reason: request.body?.reason,
      metadata: { city: area.city, state: area.state, isActive: area.isActive }
    }, async () => {
      const updated = await area.save();
      await invalidateRestaurantCaches(updated.city);
      return updated;
    });
    reply.send(area);
  });

  fastify.delete('/service-areas/:id', { preHandler: fastify.authorizeAdmin(['service-areas:write']) }, async (request, reply) => {
    requireObjectId(request.params.id, 'id');
    const reason = String(request.body?.reason || '').trim();
    if (!reason) throw BadRequest('reason é obrigatório para desativar uma área');
    const area = await audited(request, {
      action: 'service-area.deactivate', resourceType: 'ServiceArea', resourceId: request.params.id, reason
    }, async () => {
      const updated = await ServiceArea.findByIdAndUpdate(request.params.id, { $set: { isActive: false, updatedBy: request.admin._id } }, { new: true });
      if (!updated) throw NotFound('Área de atendimento não encontrada');
      await invalidateRestaurantCaches(updated.city);
      return updated;
    });
    reply.send(area);
  });

  fastify.get('/payouts', { preHandler: fastify.authorizeAdmin(['payouts:read']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const status = request.query?.status || 'pending';
    if (!['pending', 'approved', 'rejected', 'paid'].includes(status)) throw BadRequest('status inválido');
    const match = { role: 'courier', 'courierProfile.payoutRequests.status': status };
    const rows = await User.aggregate([
      { $match: match }, { $unwind: '$courierProfile.payoutRequests' },
      { $match: { 'courierProfile.payoutRequests.status': status } },
      { $sort: { 'courierProfile.payoutRequests.requestedAt': -1 } }, { $skip: skip }, { $limit: limit },
      { $project: {
        _id: '$courierProfile.payoutRequests._id', courierId: '$_id', courierName: '$name', courierEmail: '$email',
        amount: '$courierProfile.payoutRequests.amount', status: '$courierProfile.payoutRequests.status',
        requestedAt: '$courierProfile.payoutRequests.requestedAt', reviewedAt: '$courierProfile.payoutRequests.reviewedAt',
        reviewedBy: '$courierProfile.payoutRequests.reviewedBy', approvedAt: '$courierProfile.payoutRequests.approvedAt',
        approvedBy: '$courierProfile.payoutRequests.approvedBy', paidAt: '$courierProfile.payoutRequests.paidAt',
        paidBy: '$courierProfile.payoutRequests.paidBy', rejectionReason: '$courierProfile.payoutRequests.rejectionReason',
        paymentReference: '$courierProfile.payoutRequests.paymentReference'
      } }
    ]);
    reply.send({ items: rows, limit, skip });
  });

  fastify.post('/payouts/:payoutId/decision', { preHandler: fastify.authorizeAdmin(['payouts:write']) }, async (request, reply) => {
    requireObjectId(request.params.payoutId, 'payoutId');
    const { decision, reason } = request.body || {};
    if (!['approved', 'rejected'].includes(decision)) throw BadRequest('decision deve ser approved ou rejected');
    if (decision === 'rejected' && !String(reason || '').trim()) throw BadRequest('reason é obrigatório para recusar um saque');
    const updated = await audited(request, {
      action: `payout.${decision}`, resourceType: 'CourierPayout', resourceId: request.params.payoutId, reason
    }, async () => {
      const payoutId = new mongoose.Types.ObjectId(request.params.payoutId);
      const user = await User.findOne({ role: 'courier', 'courierProfile.payoutRequests': { $elemMatch: { _id: payoutId, status: 'pending' } } })
        .select('name courierProfile.payoutRequests');
      if (!user) throw NotFound('Saque pendente não encontrado');
      const payout = user.courierProfile.payoutRequests.id(payoutId);
      const reviewedAt = new Date();
      const payoutChanges = {
        'courierProfile.payoutRequests.$[request].status': decision,
        'courierProfile.payoutRequests.$[request].reviewedAt': reviewedAt
      };
      if (decision === 'approved') {
        payoutChanges['courierProfile.payoutRequests.$[request].approvedAt'] = reviewedAt;
        payoutChanges['courierProfile.payoutRequests.$[request].approvedBy'] = request.admin._id;
      } else {
        payoutChanges['courierProfile.payoutRequests.$[request].reviewedBy'] = request.admin._id;
        payoutChanges['courierProfile.payoutRequests.$[request].rejectionReason'] = String(reason).trim();
      }
      const update = { $set: {
        ...payoutChanges
      } };
      if (decision === 'rejected') update.$inc = { 'courierProfile.reservedBalance': -payout.amount };
      const result = await User.updateOne(
        { _id: user._id, 'courierProfile.payoutRequests': { $elemMatch: { _id: payoutId, status: 'pending' } }, 'courierProfile.reservedBalance': { $gte: payout.amount } },
        update,
        { arrayFilters: [{ 'request._id': payoutId, 'request.status': 'pending' }] }
      );
      if (!result.modifiedCount) throw Conflict('Saque já processado ou saldo reservado inconsistente');
      return { payoutId, courierId: user._id, status: decision, amount: payout.amount };
    });
    reply.send(updated);
  });

  fastify.post('/payouts/:payoutId/paid', { preHandler: fastify.authorizeAdmin(['payouts:write']) }, async (request, reply) => {
    requireObjectId(request.params.payoutId, 'payoutId');
    const paymentReference = String(request.body?.paymentReference || '').trim();
    if (!paymentReference) throw BadRequest('paymentReference é obrigatório para registrar o pagamento');
    const result = await audited(request, {
      action: 'payout.paid', resourceType: 'CourierPayout', resourceId: request.params.payoutId,
      metadata: { paymentReference }
    }, async () => {
      const payoutId = new mongoose.Types.ObjectId(request.params.payoutId);
      const user = await User.findOne({ role: 'courier', 'courierProfile.payoutRequests': { $elemMatch: { _id: payoutId, status: 'approved' } } })
        .select('courierProfile.payoutRequests');
      if (!user) throw NotFound('Saque aprovado não encontrado');
      const payout = user.courierProfile.payoutRequests.id(payoutId);
      const update = await User.updateOne(
        { _id: user._id, 'courierProfile.payoutRequests': { $elemMatch: { _id: payoutId, status: 'approved' } }, 'courierProfile.balance': { $gte: payout.amount }, 'courierProfile.reservedBalance': { $gte: payout.amount } },
        { $inc: { 'courierProfile.balance': -payout.amount, 'courierProfile.reservedBalance': -payout.amount }, $set: {
          'courierProfile.payoutRequests.$[request].status': 'paid',
          'courierProfile.payoutRequests.$[request].paidAt': new Date(),
          'courierProfile.payoutRequests.$[request].paidBy': request.admin._id,
          'courierProfile.payoutRequests.$[request].paymentReference': paymentReference
        } },
        { arrayFilters: [{ 'request._id': payoutId, 'request.status': 'approved' }] }
      );
      if (!update.modifiedCount) throw Conflict('Saque já processado ou saldo inconsistente');
      return { payoutId, courierId: user._id, status: 'paid', amount: payout.amount, paymentReference };
    });
    reply.send(result);
  });

  fastify.get('/finance/summary', { preHandler: fastify.authorizeAdmin(['finance:read']) }, async (request, reply) => {
    const match = {};
    if (request.query?.from) {
      const from = new Date(request.query.from);
      if (Number.isNaN(from.getTime())) throw BadRequest('from inválido');
      match.recordedAt = { ...match.recordedAt, $gte: from };
    }
    if (request.query?.to) {
      const to = new Date(request.query.to);
      if (Number.isNaN(to.getTime())) throw BadRequest('to inválido');
      match.recordedAt = { ...match.recordedAt, $lt: to };
    }
    const [row] = await PaymentLedger.aggregate([
      { $match: match },
      { $lookup: { from: Order.collection.name, localField: 'order', foreignField: '_id', as: 'orderState' } },
      { $unwind: { path: '$orderState', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: null,
        grossAmountCents: { $sum: '$grossAmountCents' },
        deliveryFeeCents: { $sum: '$deliveryFeeCents' },
        deliveredDeliveryFeeCents: { $sum: { $cond: [{ $eq: ['$orderState.status', 'delivered'] }, '$deliveryFeeCents', 0] } },
        goodsAmountCents: { $sum: '$goodsAmountCents' },
        paymentsCount: { $sum: 1 }
      } }
    ]);
    reply.send(summaryFromAggregation(row));
  });

  fastify.get('/finance/payments', { preHandler: fastify.authorizeAdmin(['finance:read']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.from) {
      const from = new Date(request.query.from);
      if (Number.isNaN(from.getTime())) throw BadRequest('from inválido');
      filter.recordedAt = { ...filter.recordedAt, $gte: from };
    }
    if (request.query?.to) {
      const to = new Date(request.query.to);
      if (Number.isNaN(to.getTime())) throw BadRequest('to inválido');
      filter.recordedAt = { ...filter.recordedAt, $lt: to };
    }
    const [items, total] = await Promise.all([
      PaymentLedger.find(filter).populate('restaurant', 'name').populate('customer', 'name').populate('order', 'status')
        .sort({ recordedAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentLedger.countDocuments(filter)
    ]);
    reply.send({ items, total, limit, skip });
  });

  fastify.get('/audit-logs', { preHandler: fastify.authorizeAdmin(['platform:read']) }, async (request, reply) => {
    const { limit, skip } = parsePagination(request.query);
    const filter = {};
    if (request.query?.resourceType) filter.resourceType = request.query.resourceType;
    if (request.query?.action) filter.action = request.query.action;
    const [items, total] = await Promise.all([
      AdminAudit.find(filter).populate('admin', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAudit.countDocuments(filter)
    ]);
    reply.send({ items, total, limit, skip });
  });
}

async function invalidateRestaurantCaches(city) {
  for (const pattern of ['cache:restaurants:list:*', 'cache:restaurant:*']) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  }
  if (city) await redis.del(RedisKeys.restaurantListCache(`${city}:all`));
}