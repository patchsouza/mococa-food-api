import mongoose from 'mongoose';

const { Schema } = mongoose;

// Máquina de estados do pedido:
// pending -> confirmed -> preparing -> ready_for_pickup -> awaiting_courier
//   -> in_delivery -> delivered
// (pode virar "cancelled" em vários pontos antes de "in_delivery")
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'awaiting_courier',
  'in_delivery',
  'delivered',
  'cancelled'
];

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    notes: String
  },
  { _id: false }
);

const statusHistoryEntry = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: String
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    courier: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    items: { type: [orderItemSchema], required: true },

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },

    deliveryAddress: {
      street: String,
      number: String,
      neighborhood: String,
      city: String,
      state: String,
      lat: Number,
      lng: Number,
      complement: String
    },

    paymentMethod: { type: String, enum: ['pix', 'dinheiro', 'cartao'], default: 'pix' },

    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: { type: [statusHistoryEntry], default: [] },

    cancelReason: String,
    estimatedDeliveryAt: Date,
    deliveredAt: Date
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, status: 1 });
orderSchema.index({ courier: 1, status: 1 });

orderSchema.methods.pushStatus = function (status, note) {
  this.status = status;
  this.statusHistory.push({ status, note, at: new Date() });
};

export const Order = mongoose.model('Order', orderSchema);
