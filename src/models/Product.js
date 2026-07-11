import mongoose from 'mongoose';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'Geral', trim: true }, // ex: "Bebidas", "Lanches"
    imageUrl: String,
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

productSchema.index({ restaurant: 1, category: 1 });

export const Product = mongoose.model('Product', productSchema);
