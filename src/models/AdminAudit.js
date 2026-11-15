import mongoose from 'mongoose';

const { Schema } = mongoose;

const adminAuditSchema = new Schema(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    reason: String,
    metadata: Schema.Types.Mixed,
    result: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    errorMessage: String,
    ip: String,
    userAgent: String
  },
  { timestamps: true }
);

adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.index({ admin: 1, createdAt: -1 });
adminAuditSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

export const AdminAudit = mongoose.model('AdminAudit', adminAuditSchema);