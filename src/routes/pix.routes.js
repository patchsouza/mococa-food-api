import {
  createPixTransaction,
  getPixTransaction,
  getPixTransactionByOrder,
  cancelPixTransaction,
  listPixTransactions
} from '../services/pix.service.js';
import { processPixWebhook } from '../services/pix.service.js';
import { BadRequest, NotFound, Forbidden, Unauthorized } from '../utils/errors.js';
import { Order } from '../models/Order.js';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { verifyWebhookSignature } from '../utils/signature.js';

export default async function pixRoutes(fastify) {
  // ---- Criar transação Pix para um pedido ----
  fastify.post('/orders/:orderId/pix', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { orderId } = request.params;
    const { expiresInMinutes } = request.body || {};
    if (!mongoose.Types.ObjectId.isValid(orderId)) throw BadRequest('orderId inválido');
    const lifetime = expiresInMinutes === undefined ? 30 : Number(expiresInMinutes);
    if (!Number.isInteger(lifetime) || lifetime < 1 || lifetime > 60) throw BadRequest('expiresInMinutes deve ser entre 1 e 60');

    // Verifica se o usuário tem acesso ao pedido
    const order = await Order.findById(orderId);
    if (!order) {
      throw NotFound('Pedido não encontrado');
    }

    const { sub } = request.user;
    const isCustomer = String(order.customer) === String(sub);
    if (!isCustomer) {
      throw Forbidden('Você não tem acesso a este pedido');
    }

    const transaction = await createPixTransaction({
      orderId,
      expiresInMinutes: lifetime
    });

    reply.code(201).send({
      transactionId: transaction.transactionId,
      pixCode: transaction.pixCode,
      amount: transaction.amount,
      expiresAt: transaction.expiresAt,
      status: transaction.status,
      beneficiary: transaction.beneficiary,
      qrCodeBase64: await generateQRCodeBase64(transaction.pixCode)
    });
  });

  // ---- Obter detalhes de uma transação Pix ----
  fastify.get('/pix/:transactionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { transactionId } = request.params;

    const transaction = await getPixTransaction(transactionId);

    const { sub } = request.user;
    const order = transaction.order;
    
    const isCustomer = order && String(order.customer) === String(sub);
    if (!isCustomer) {
      throw Forbidden('Você não tem acesso a esta transação');
    }

    reply.send({
      transactionId: transaction.transactionId,
      pixCode: transaction.pixCode,
      amount: transaction.amount,
      status: transaction.status,
      expiresAt: transaction.expiresAt,
      paidAt: transaction.paidAt,
      beneficiary: transaction.beneficiary,
      payer: transaction.payer,
      createdAt: transaction.createdAt,
      qrCodeBase64: await generateQRCodeBase64(transaction.pixCode)
    });
  });

  // ---- Obter transação Pix por pedido ----
  fastify.get('/orders/:orderId/pix', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { orderId } = request.params;

    const transaction = await getPixTransactionByOrder(orderId);

    const { sub } = request.user;
    const order = transaction.order;
    
    const isCustomer = order && String(order.customer) === String(sub);
    if (!isCustomer) {
      throw Forbidden('Você não tem acesso a esta transação');
    }

    reply.send({
      transactionId: transaction.transactionId,
      pixCode: transaction.pixCode,
      amount: transaction.amount,
      status: transaction.status,
      expiresAt: transaction.expiresAt,
      paidAt: transaction.paidAt,
      beneficiary: transaction.beneficiary,
      payer: transaction.payer,
      createdAt: transaction.createdAt,
      qrCodeBase64: await generateQRCodeBase64(transaction.pixCode)
    });
  });

  // ---- Cancelar transação Pix pendente ----
  fastify.delete('/pix/:transactionId', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { transactionId } = request.params;
    const { reason } = request.body || {};

    const transaction = await getPixTransaction(transactionId);

    const { sub } = request.user;
    const order = transaction.order;
    
    const isCustomer = order && String(order.customer) === String(sub);
    
    if (!isCustomer) {
      throw Forbidden('Apenas o cliente pode cancelar esta transação');
    }

    const cancelledTransaction = await cancelPixTransaction(transactionId, reason);

    reply.send({
      transactionId: cancelledTransaction.transactionId,
      status: cancelledTransaction.status,
      cancelReason: cancelledTransaction.cancelReason
    });
  });

  // ---- Listar transações Pix (admin ou restaurante) ----
  fastify.get('/pix/transactions', { preHandler: fastify.authorizeAdmin(['finance:read']) }, async (request, reply) => {
    const { orderId, status, limit, skip } = request.query || {};

    const filters = {};
    if (orderId) filters.orderId = orderId;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);
    if (skip) filters.skip = parseInt(skip, 10);

    const transactions = await listPixTransactions(filters);

    reply.send(transactions.map(t => ({
      transactionId: t.transactionId,
      orderId: t.order?._id,
      amount: t.amount,
      status: t.status,
      createdAt: t.createdAt,
      paidAt: t.paidAt,
      expiresAt: t.expiresAt
    })));
  });

  // ---- Webhook para recebimento de confirmações Pix ----
  fastify.post('/pix/webhook', async (request, reply) => {
    const webhookData = request.body;

    if (!webhookData) {
      throw BadRequest('Dados do webhook são obrigatórios');
    }
    if (!verifyWebhookSignature(request.rawBody || '', request.headers['x-webhook-signature'], env.pixWebhookSecret)) {
      throw Unauthorized('Assinatura do webhook inválida');
    }

    try {
      const transaction = await processPixWebhook(webhookData);
      
      reply.send({
        success: true,
        transactionId: transaction.transactionId,
        status: transaction.status,
        paidAt: transaction.paidAt
      });
    } catch (error) {
      // Log do erro mas retorna 200 para evitar retries desnecessários
      fastify.log.error({ error }, 'Erro ao processar webhook Pix');
      
      if (error.statusCode === 404) {
        // Transação não encontrada - pode ser retry antigo
        reply.code(200).send({ success: false, message: 'Transação não encontrada' });
      } else {
        reply.code(error.statusCode || 500).send({ success: false, message: error.statusCode ? error.message : 'Erro interno ao processar o webhook' });
      }
    }
  });
}

/**
 * Gera QR Code em base64 a partir do payload Pix
 */
async function generateQRCodeBase64(pixCode) {
  try {
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(pixCode, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (error) {
    // Fallback: retorna null se biblioteca não estiver disponível
    console.error('Erro ao gerar QR Code:', error.message);
    return null;
  }
}
