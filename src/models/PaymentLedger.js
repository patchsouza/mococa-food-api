import mongoose from 'mongoose';

const { Schema } = mongoose;

const paymentLedgerSchema = new Schema(
  {
    transaction: { type: Schema.Types.ObjectId, ref: 'PixTransaction', required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paymentMethod: { type: String, enum: ['pix'], required: true },
    goodsAmountCents: { type: Number, required: true, min: 0 },
    deliveryFeeCents: { type: Number, required: true, min: 0 },
    grossAmountCents: { type: Number, required: true, min: 1 },
    recordedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

paymentLedgerSchema.index({ recordedAt: -1 });
paymentLedgerSchema.index({ order: 1, recordedAt: -1 });

export const PaymentLedger = mongoose.model('PaymentLedger', paymentLedgerSchema);