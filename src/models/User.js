import mongoose from 'mongoose';

const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    street: String,
    number: String,
    neighborhood: String,
    city: { type: String, default: 'Mococa' },
    state: { type: String, default: 'SP' },
    lat: Number,
    lng: Number,
    complement: String
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ['customer', 'restaurant_owner', 'courier', 'admin'],
      default: 'customer'
    },
    address: addressSchema,

    // Campos específicos de entregador
    courierProfile: {
      vehicleType: { type: String, enum: ['moto', 'bike', 'carro'], default: 'moto' },
      plate: String,
      isAvailable: { type: Boolean, default: false },
      currentLocation: {
        lat: Number,
        lng: Number,
        updatedAt: Date
      },
      rating: { type: Number, default: 5 },
      totalDeliveries: { type: Number, default: 0 },
      balance: { type: Number, default: 0 } // saldo a receber/histórico simplificado
    },

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

//userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
