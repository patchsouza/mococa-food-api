import mongoose from 'mongoose';

const { Schema } = mongoose;

const openingHoursSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6 }, // 0=domingo ... 6=sábado
    opensAt: String, // "18:00"
    closesAt: String // "23:30"
  },
  { _id: false }
);

const restaurantSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, trim: true }, // ex: "Lanches", "Pizza", "Brasileira"
    phone: String,
    logoUrl: String,

    address: {
      street: String,
      number: String,
      neighborhood: String,
      city: { type: String, default: 'Mococa' },
      state: { type: String, default: 'SP' },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },

    deliveryFee: { type: Number, default: 0 },
    minOrderValue: { type: Number, default: 0 },
    avgPrepTimeMinutes: { type: Number, default: 30 },

    // Configurações de pagamento Pix do restaurante
    pixKey: String, // Chave Pix (CPF/CNPJ/Email/Aleatória)
    pixKeyType: { type: String, enum: ['cpf', 'cnpj', 'email', 'phone', 'random'], default: 'email' },
    pixBank: { type: String, default: '001' }, // Código do banco (ex: 001 = Banco do Brasil)
    pixMerchantName: String, // Nome comercial para transações Pix (se diferente do name)

    openingHours: [openingHoursSchema],
    isOpen: { type: Boolean, default: true }, // aberto/fechado manual pelo dono
    isApproved: { type: Boolean, default: true }, // aprovação de cadastro (admin)

    rating: { type: Number, default: 5 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

restaurantSchema.index({ owner: 1 });
restaurantSchema.index({ 'address.city': 1 });
restaurantSchema.index({ name: 'text', category: 'text' });

export const Restaurant = mongoose.model('Restaurant', restaurantSchema);
