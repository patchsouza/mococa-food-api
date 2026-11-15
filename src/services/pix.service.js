import { randomUUID } from 'crypto';
import { PixTransaction } from '../models/PixTransaction.js';
import { Order } from '../models/Order.js';
import { BadRequest, NotFound, Conflict } from '../utils/errors.js';
import { publishOrderUpdate } from './notification.service.js';
import { PaymentLedger } from '../models/PaymentLedger.js';
import { env } from '../config/env.js';
import { createPixPayload } from '../utils/pixPayload.js';

export { createPixPayload } from '../utils/pixPayload.js';

/**
 * Gera um End-to-End ID único para transações Pix
 * Formato: E{timestamp}{random} (máximo 32 caracteres)
 */
function generateEndToEndId() {
  const timestamp = Date.now().toString().slice(-10);
  const random = randomUUID().replace(/-/g, '').slice(0, 20);
  return `E${timestamp}${random}`;
}

/**
 * Gera um ID de transação único
 */
function generateTransactionId() {
  return `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/**
 * Cria uma nova transação Pix para um pedido
 */
export async function createPixTransaction({ orderId, expiresInMinutes = 30 }) {
  const order = await Order.findById(orderId).populate('restaurant customer');
  
  if (!order) {
    throw new NotFound('Pedido não encontrado');
  }

  if (order.paymentMethod !== 'pix') {
    throw BadRequest('Este pedido não utiliza Pix como forma de pagamento');
  }
  if (!env.pixEnabled) throw BadRequest('Pagamento Pix está desabilitado');
  if (!env.pixReceiverKey || !env.pixReceiverName) throw BadRequest('A conta central de recebimento Pix ainda não foi configurada');
  if (order.status !== 'pending') throw new Conflict('Só é possível iniciar o pagamento de um pedido pendente');

  // Verifica se já existe transação pendente para este pedido
  const existingTransaction = await PixTransaction.findOne({
    order: orderId,
    status: 'pending'
  });

  if (existingTransaction) {
    return existingTransaction;
  }

  const transactionId = generateTransactionId();
  const endToEndId = generateEndToEndId();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Pagamentos são direcionados à conta central da plataforma, não à chave da loja.
  const beneficiaryConfig = {
    name: env.pixReceiverName,
    key: env.pixReceiverKey,
    keyType: env.pixReceiverKeyType,
    bank: 'platform',
    city: env.pixReceiverCity
  };

  // Gera o payload Pix
  const pixCode = createPixPayload({
    beneficiaryName: beneficiaryConfig.name,
    beneficiaryKey: beneficiaryConfig.key,
    beneficiaryKeyType: beneficiaryConfig.keyType,
    beneficiaryBank: beneficiaryConfig.bank,
    beneficiaryCity: beneficiaryConfig.city,
    amount: order.total,
    transactionId,
    description: `Pedido ${orderId.slice(-6)}`
  });

  // Cria a transação no banco
  const transaction = new PixTransaction({
    order: orderId,
    transactionId,
    pixCode,
    endToEndId,
    amount: order.total,
    beneficiary: beneficiaryConfig,
    expiresAt,
    metadata: {
      description: `Pagamento Pix para pedido ${orderId.slice(-6)}`,
      referenceLabel: `PEDIDO-${orderId.slice(-6)}`
    }
  });

  try {
    await transaction.save();
  } catch (error) {
    if (error.code !== 11000) throw error;
    const pendingTransaction = await PixTransaction.findOne({ order: orderId, status: 'pending' });
    if (pendingTransaction) return pendingTransaction;
    throw error;
  }

  return transaction;
}

/**
 * Obtém uma transação Pix por ID
 */
export async function getPixTransaction(transactionId) {
  const transaction = await PixTransaction.findById(transactionId)
    .populate({ path: 'order', populate: { path: 'restaurant', select: 'owner' } });
  
  if (!transaction) {
    throw new NotFound('Transação Pix não encontrada');
  }

  return transaction;
}

/**
 * Obtém transação Pix por ordem
 */
export async function getPixTransactionByOrder(orderId) {
  const transaction = await PixTransaction.findOne({ order: orderId })
    .sort({ createdAt: -1 })
    .populate({ path: 'order', populate: { path: 'restaurant', select: 'owner' } });
  
  if (!transaction) {
    throw new NotFound('Nenhuma transação Pix encontrada para este pedido');
  }

  return transaction;
}

/**
 * Processa webhook de confirmação de pagamento Pix
 * Este método seria chamado pelo banco/gateway quando o pagamento é confirmado
 */
export async function processPixWebhook(webhookData) {
  const { endToEndId, transactionId, status, paidAt, payer, amount } = webhookData;
  if (!endToEndId && !transactionId) throw BadRequest('endToEndId ou transactionId é obrigatório');

  // Busca a transação por endToEndId ou transactionId
  const query = transactionId ? { transactionId } : { endToEndId };
  const transaction = await PixTransaction.findOne(query).populate('order');

  if (!transaction) {
    throw new NotFound('Transação Pix não encontrada');
  }

  if (status === 'paid' || status === 'completed') {
    if (!Number.isFinite(Number(amount)) || Math.round(Number(amount) * 100) !== Math.round(transaction.amount * 100)) {
      throw new Conflict('Valor confirmado não corresponde ao valor da transação');
    }
    if (transaction.status === 'paid') {
      await recordPaymentLedger(transaction);
      await confirmPaidOrder(transaction);
      return transaction;
    }
    if (!['pending', 'expired', 'cancelled'].includes(transaction.status)) {
      throw new Conflict(`Transação já está com status "${transaction.status}"`);
    }

    if (transaction.status === 'pending') transaction.markAsPaid(payer || {});
    else {
      transaction.status = 'paid';
      transaction.paidAt = new Date();
      transaction.payer = { ...transaction.payer, ...(payer || {}) };
    }
    if (paidAt && !Number.isNaN(new Date(paidAt).getTime())) transaction.paidAt = new Date(paidAt);
    transaction.webhookData = webhookData;
    if (endToEndId) transaction.endToEndId = endToEndId;
    await transaction.save();

    await recordPaymentLedger(transaction);

    await confirmPaidOrder(transaction);

    return transaction;
  }

  if (transaction.status !== 'pending') throw new Conflict(`Transação já está com status "${transaction.status}"`);
  throw BadRequest('Status de pagamento não reconhecido');
}

async function confirmPaidOrder(transaction) {
  const order = transaction.order?._id ? transaction.order : await Order.findById(transaction.order);
  if (!order || order.status !== 'pending') return;
  order.pushStatus('confirmed', 'Pagamento Pix confirmado');
  await order.save();
  await publishOrderUpdate(order._id, {
    status: 'confirmed',
    message: 'Pagamento confirmado! Restaurante já foi notificado.',
    paymentConfirmed: true
  });
}

async function recordPaymentLedger(transaction) {
  const order = transaction.order?._id ? transaction.order : await Order.findById(transaction.order);
  if (!order) throw new NotFound('Pedido da transação não encontrado');
  const grossAmountCents = Math.round(order.total * 100);
  if (grossAmountCents !== Math.round(transaction.amount * 100)) {
    throw new Conflict('Valor pago diverge do total registrado no pedido');
  }
  const deliveryFeeCents = Math.round(order.deliveryFee * 100);
  await PaymentLedger.updateOne(
    { transaction: transaction._id },
    { $setOnInsert: {
      transaction: transaction._id,
      order: order._id,
      restaurant: order.restaurant?._id || order.restaurant,
      customer: order.customer?._id || order.customer,
      paymentMethod: 'pix',
      goodsAmountCents: grossAmountCents - deliveryFeeCents,
      deliveryFeeCents,
      grossAmountCents,
      recordedAt: transaction.paidAt || new Date()
    } },
    { upsert: true }
  );
}

/**
 * Cancela uma transação Pix pendente
 */
export async function cancelPixTransaction(transactionId, reason) {
  const transaction = await getPixTransaction(transactionId);

  if (!['pending'].includes(transaction.status)) {
    throw new Conflict(`Não é possível cancelar transação com status "${transaction.status}"`);
  }

  transaction.cancel(reason);
  await transaction.save();

  // Se estiver associado a um pedido pendente, cancela o pedido também
  const order = await Order.findById(transaction.order);
  if (order && order.status === 'pending') {
    order.pushStatus('cancelled', reason || 'Pagamento Pix cancelado');
    await order.save();
    
    await publishOrderUpdate(order._id, {
      status: 'cancelled',
      message: 'Pedido cancelado devido ao cancelamento do pagamento Pix'
    });
  }

  return transaction;
}

/**
 * Expira transações Pix pendentes antigas
 * Deve ser executado periodicamente por um job/cron
 */
export async function expireOldPixTransactions() {
  const now = new Date();
  
  const result = await PixTransaction.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now }
    },
    {
      $set: {
        status: 'expired',
        cancelReason: 'Tempo limite excedido',
        lastReconciliationAt: now
      }
    }
  );

  // Para cada transação expirada, atualiza o pedido associado se ainda estiver pendente
  const expiredTransactions = await PixTransaction.find({
    status: 'expired',
    cancelReason: 'Tempo limite excedido',
    lastReconciliationAt: now
  });

  for (const transaction of expiredTransactions) {
    const order = await Order.findById(transaction.order);
    if (order && order.status === 'pending') {
      order.pushStatus('cancelled', 'Pagamento Pix expirado');
      await order.save();
      
      await publishOrderUpdate(order._id, {
        status: 'cancelled',
        message: 'Pedido cancelado devido à expiração do pagamento Pix'
      });
    }
  }

  return {
    expiredCount: result.modifiedCount,
    message: `${result.modifiedCount} transações Pix expiradas`
  };
}

/**
 * Lista transações Pix com filtros
 */
export async function listPixTransactions(filters = {}) {
  const { orderId, status, limit = 20, skip = 0 } = filters;
  
  const query = {};
  if (orderId) query.order = orderId;
  if (status) query.status = status;

  return PixTransaction.find(query)
    .populate('order', 'status total customer')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
}
