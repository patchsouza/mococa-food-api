import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ADMIN_PERMISSIONS = [
  'platform:read',
  'accounts:write',
  'restaurants:write',
  'payouts:read',
  'payouts:write',
  'coupons:write',
  'service-areas:write',
  'finance:read'
];

const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    permissions: { type: [String], enum: [...ADMIN_PERMISSIONS, '*'], default: ADMIN_PERMISSIONS },
    isActive: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: Date
  },
  { timestamps: true }
);

export const Admin = mongoose.model('Admin', adminSchema);