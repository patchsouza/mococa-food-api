import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/User.js';
import { Restaurant } from '../models/Restaurant.js';
import { Product } from '../models/Product.js';

async function seed() {
  await connectDatabase(console);

  await Promise.all([User.deleteMany({}), Restaurant.deleteMany({}), Product.deleteMany({})]);

  const passwordHash = await Bun.password.hash('123456');

  const owner = await User.create({
    name: 'Dono Lanchonete Mococa',
    email: 'dono@mococafood.com',
    passwordHash,
    role: 'restaurant_owner'
  });

  const customer = await User.create({
    name: 'Cliente Teste',
    email: 'cliente@mococafood.com',
    passwordHash,
    role: 'customer'
  });

  const courier = await User.create({
    name: 'Entregador Teste',
    email: 'entregador@mococafood.com',
    passwordHash,
    role: 'courier'
  });

  const restaurant = await Restaurant.create({
    owner: owner._id,
    name: 'Lanchonete Central Mococa',
    description: 'Os melhores lanches da cidade',
    category: 'Lanches',
    phone: '(19) 99999-0000',
    address: {
      street: 'Rua XV de Novembro',
      number: '100',
      neighborhood: 'Centro',
      city: 'Mococa',
      state: 'SP',
      lat: -21.4681,
      lng: -47.0089
    },
    deliveryFee: 5,
    minOrderValue: 15
  });

  await Product.insertMany([
    { restaurant: restaurant._id, name: 'X-Burguer', price: 18, category: 'Lanches' },
    { restaurant: restaurant._id, name: 'X-Salada', price: 20, category: 'Lanches' },
    { restaurant: restaurant._id, name: 'Coca-Cola Lata', price: 6, category: 'Bebidas' }
  ]);

  console.log('Seed concluído:');
  console.log('  Dono restaurante -> dono@mococafood.com / 123456');
  console.log('  Cliente          -> cliente@mococafood.com / 123456');
  console.log('  Entregador       -> entregador@mococafood.com / 123456');
  console.log(`  Restaurante ID   -> ${restaurant._id}`);

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
