import { randomUUID } from 'crypto';
import { PixTransaction } from '../models/PixTransaction.js';
import { Order } from '../models/Order.js';
import { BadRequest, NotFound, Conflict } from '../utils/errors.js';
import { publishOrderUpdate } from './notification.service.js';

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
 * Formata valor em centavos para string no formato Pix (sempre 2 casas decimais)
 */
function formatPixAmount(amount) {
  return amount.toFixed(2);
}

/**
 * CRC16 calculation for Pix payload
 * Polinômio: 0x1021 (CRC-CCITT)
 */
function calculateCRC16(payload) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Cria o payload BR Code do Pix (formato EMV QRCPS)
 * Baseado no Manual de Implementação do Pix do Banco Central
 */
export function createPixPayload({
  beneficiaryName,
  beneficiaryKey,
  beneficiaryKeyType,
  beneficiaryBank,
  beneficiaryCity,
  amount,
  transactionId,
  description
}) {
  // Mapeamento dos tipos de chave Pix para códigos EMV
  const keyTypeMap = {
    cpf: '00',
    cnpj: '01',
    phone: '02',
    email: '03',
    random: '04'
  };

  const keyTypeCode = keyTypeMap[beneficiaryKeyType.toLowerCase()];
  if (!keyTypeCode) {
    throw new BadRequest('Tipo de chave Pix inválido');
  }

  // Validações básicas
  if (!beneficiaryName || beneficiaryName.length > 25) {
    throw new BadRequest('Nome do beneficiário deve ter até 25 caracteres');
  }

  if (!beneficiaryCity || beneficiaryCity.length > 15) {
    throw new BadRequest('Cidade do beneficiário deve ter até 15 caracteres');
  }

  if (amount <= 0) {
    throw new BadRequest('Valor da transação deve ser maior que zero');
  }

  // Construção do payload EMV
  const fields = {
    '00': '01', // Payload Format Indicator
    '26': (() => {
      // Merchant Account Information
      const gui = '00' + 'BR.GOV.BCB.PIX'.padEnd(2, '\x00').slice(0, 2);
      const key = '01' + beneficiaryKey.padEnd(2, '\x00').slice(0, 2);
      const desc = description ? '02' + description.slice(0, 20).padEnd(2, '\x00').slice(0, 2) : '';
      const length = (gui.length + key.length + desc.length).toString().padStart(2, '0');
      return length + gui + key + desc;
    })(),
    '52': '0000', // Merchant Category Code (MCC)
    '53': '986', // Transaction Currency (BRL)
    '54': amount.toFixed(2).padEnd(2, '\x00').slice(0, 2), // Transaction Amount
    '58': 'BR', // Country Code
    '59': beneficiaryName.padEnd(2, '\x00').slice(0, 2), // Merchant Name
    '60': beneficiaryCity.padEnd(2, '\x00').slice(0, 2), // Merchant City
    '62': (() => {
      // Additional Data Field Template
      const txid = '05' + (transactionId || '***').slice(0, 25).padEnd(2, '\x00').slice(0, 2);
      const length = txid.length.toString().padStart(2, '0');
      return length + txid;
    })(),
    '63': '04' // CRC16 ID (será substituído pelo CRC calculado)
  };

  // Monta o payload concatenando todos os campos
  let payload = '';
  Object.entries(fields).forEach(([id, value]) => {
    const idPadded = id.toString().padStart(2, '0');
    const length = value.length.toString().padStart(2, '0');
    payload += idPadded + length + value;
  });

  // Adiciona o CRC16
  const crc = calculateCRC16(payload);
  payload += '6304' + crc;

  return payload;
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
    throw new BadRequest('Este pedido não utiliza Pix como forma de pagamento');
  }

  // Verifica se já existe transação pendente para este pedido
  const existingTransaction = await PixTransaction.findOne({
    order: orderId,
    status: 'pending'
  });

  if (existingTransaction) {
    return existingTransaction;
  }

  const restaurant = order.restaurant;
  const transactionId = generateTransactionId();
  const endToEndId = generateEndToEndId();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Configurações do beneficiário (restaurante)
  // Em produção, isso viria das configurações da conta do restaurante
  const beneficiaryConfig = {
    name: restaurant.name,
    key: restaurant.pixKey || 'chave-padrao@mococafood.com.br',
    keyType: restaurant.pixKeyType || 'email',
    bank: restaurant.pixBank || '001', // Banco do Brasil por padrão
    city: restaurant.city || 'SAO PAULO'
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

  await transaction.save();

  return transaction;
}

/**
 * Obtém uma transação Pix por ID
 */
export async function getPixTransaction(transactionId) {
  const transaction = await PixTransaction.findById(transactionId).populate('order');
  
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
    .populate('order');
  
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
  const { endToEndId, transactionId, status, paidAt, payer } = webhookData;

  // Busca a transação por endToEndId ou transactionId
  const query = endToEndId ? { endToEndId } : { transactionId };
  const transaction = await PixTransaction.findOne(query).populate('order');

  if (!transaction) {
    throw new NotFound('Transação Pix não encontrada');
  }

  if (transaction.status !== 'pending') {
    throw new Conflict(`Transação já está com status "${transaction.status}"`);
  }

  // Atualiza a transação
  if (status === 'paid' || status === 'completed') {
    transaction.markAsPaid(payer || {});
    transaction.webhookData = webhookData;
    await transaction.save();

    // Atualiza o pedido para "confirmed" automaticamente
    const order = transaction.order;
    if (order && order.status === 'pending') {
      order.pushStatus('confirmed', 'Pagamento Pix confirmado');
      await order.save();
      
      // Notifica sobre a atualização do pedido
      await publishOrderUpdate(order._id, {
        status: 'confirmed',
        message: 'Pagamento confirmado! Restaurante já foi notificado.',
        paymentConfirmed: true
      });
    }

    return transaction;
  }

  throw new BadRequest('Status de pagamento não reconhecido');
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
