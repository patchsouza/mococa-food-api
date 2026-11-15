import mongoose from 'mongoose';

const { Schema } = mongoose;

const polygonSchema = new Schema(
  {
    type: { type: String, enum: ['Polygon'], required: true },
    coordinates: { type: [[[Number]]], required: true }
  },
  { _id: false }
);

const serviceAreaSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, uppercase: true, trim: true, minlength: 2, maxlength: 2 },
    boundary: polygonSchema,
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' }
  },
  { timestamps: true }
);

serviceAreaSchema.index({ slug: 1, city: 1, state: 1 }, { unique: true });
serviceAreaSchema.index({ isActive: 1, city: 1, state: 1 });
serviceAreaSchema.index({ boundary: '2dsphere' });

export const ServiceArea = mongoose.model('ServiceArea', serviceAreaSchema);