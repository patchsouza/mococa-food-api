import mongoose from 'mongoose';

const { Schema } = mongoose;

// Status possíveis da transação Pix
export const PIX_TRANSACTION_STATUSES = [
  'pending',      // Aguardando pagamento
  'paid',         // Pago e confirmado
  'expired',      // Expirou sem pagamento
  'cancelled',    // Cancelado pelo usuário/sistema
  'refunded'      // Reembolsado
];

const pixTransactionSchema = new Schema(
  {
    // Referência ao pedido
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    
    // Identificadores únicos
    transactionId: { type: String, required: true, unique: true }, // ID gerado pelo sistema
    pixCode: { type: String, required: true }, // BR Code (payload Pix completo)
    endToEndId: { type: String, required: true, unique: true }, // E2E ID para rastreio
    
    // Valor
    amount: { type: Number, required: true },
    
    // Informações do beneficiário (restaurante)
    beneficiary: {
      name: { type: String, required: true },
      key: { type: String, required: true }, // Chave Pix (CPF/CNPJ/Email/Aleatória)
      keyType: { type: String, enum: ['cpf', 'cnpj', 'email', 'phone', 'random'], required: true },
      bank: { type: String, required: true },
      city: { type: String, required: true },
      merchantCategoryCode: { type: String, default: '5812' } // MCC de restaurantes
    },
    
    // Informações do pagador (cliente) - podem vir do banco após confirmação
    payer: {
      name: String,
      document: String,
      accountNumber: String
    },
    
    // Status e timestamps
    status: { type: String, enum: PIX_TRANSACTION_STATUSES, default: 'pending' },
    expiresAt: { type: Date, required: true },
    paidAt: Date,
    
    // Dados brutos do webhook/callback do banco/gateway
    webhookData: Schema.Types.Mixed,
    
    // Tentativas de reconciliação
    reconciliationAttempts: { type: Number, default: 0 },
    lastReconciliationAt: Date,
    
    // Motivo de cancelamento/expiração
    cancelReason: String,
    
    // Metadados adicionais
    metadata: {
      description: String,
      referenceLabel: String // Label de referência para o banco
    }
  },
  { timestamps: true }
);

// Índices para consultas eficientes
pixTransactionSchema.index({ order: 1, createdAt: -1 });
pixTransactionSchema.index({ transactionId: 1 });
pixTransactionSchema.index({ endToEndId: 1 });
pixTransactionSchema.index({ status: 1, expiresAt: 1 });
pixTransactionSchema.index({ expiresAt: 1 }); // Para jobs de expiração

// Método para verificar se está expirado
pixTransactionSchema.methods.isExpired = function() {
  return this.status === 'pending' && new Date() > this.expiresAt;
};

// Método para marcar como pago
pixTransactionSchema.methods.markAsPaid = function(payerData = {}) {
  if (this.status !== 'pending') {
    throw new Error(`Transação já está com status "${this.status}"`);
  }
  
  this.status = 'paid';
  this.paidAt = new Date();
  if (Object.keys(payerData).length > 0) {
    this.payer = { ...this.payer, ...payerData };
  }
};

// Método para expirar transação
pixTransactionSchema.methods.expire = function(reason) {
  if (this.status !== 'pending') {
    throw new Error(`Não é possível expirar transação com status "${this.status}"`);
  }
  
  this.status = 'expired';
  this.cancelReason = reason || 'Tempo limite excedido';
};

// Método para cancelar transação
pixTransactionSchema.methods.cancel = function(reason) {
  if (!['pending', 'expired'].includes(this.status)) {
    throw new Error(`Não é possível cancelar transação com status "${this.status}"`);
  }
  
  this.status = 'cancelled';
  this.cancelReason = reason || 'Cancelado pelo usuário';
};

export const PixTransaction = mongoose.model('PixTransaction', pixTransactionSchema);
