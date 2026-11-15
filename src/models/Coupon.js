import mongoose from 'mongoose';

const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
    discountValue: { type: Number, required: true, min: 0.01 },
    maximumDiscount: { type: Number, min: 0 },
    minimumSubtotal: { type: Number, default: 0, min: 0 },
    maxRedemptions: { type: Number, min: 1 },
    redemptionCount: { type: Number, default: 0, min: 0 },
    revision: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, default: Date.now },
    expiresAt: Date,
    city: { type: String, trim: true },
    restaurantIds: [{ type: Schema.Types.ObjectId, ref: 'Restaurant' }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true }
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

export const Coupon = mongoose.model('Coupon', couponSchema);