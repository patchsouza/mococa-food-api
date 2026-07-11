import { Restaurant } from '../models/Restaurant.js';
import { Product } from '../models/Product.js';
import { BadRequest, Forbidden, NotFound } from '../utils/errors.js';
import { cacheAside, invalidateCache } from '../utils/cache.js';
import { RedisKeys } from '../config/redis.js';

async function getOwnedRestaurantOrThrow(restaurantId, ownerId) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw NotFound('Restaurante não encontrado');
  if (String(restaurant.owner) !== String(ownerId)) {
    throw Forbidden('Este restaurante não pertence a você');
  }
  return restaurant;
}

export default async function restaurantRoutes(fastify) {
  // ---- 1. Cadastro de restaurante ----
  fastify.post(
    '/restaurants',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const { name, description, category, phone, address, deliveryFee, minOrderValue, openingHours } =
        request.body || {};

      if (!name || !address?.lat || !address?.lng) {
        throw BadRequest('name, address.lat e address.lng são obrigatórios');
      }

      const restaurant = await Restaurant.create({
        owner: request.user.sub,
        name,
        description,
        category,
        phone,
        address,
        deliveryFee,
        minOrderValue,
        openingHours
      });

      reply.code(201).send(restaurant);
    }
  );

  // Listagem pública de restaurantes (com cache)
  fastify.get('/restaurants', async (request, reply) => {
    const { city, category } = request.query || {};
    const cacheKey = RedisKeys.restaurantListCache(`${city || 'all'}:${category || 'all'}`);

    const restaurants = await cacheAside(cacheKey, 60, async () => {
      const filter = { isApproved: true };
      if (city) filter['address.city'] = new RegExp(`^${city}$`, 'i');
      if (category) filter.category = new RegExp(category, 'i');
      return Restaurant.find(filter).sort({ rating: -1 }).lean();
    });

    reply.send(restaurants);
  });

  // Detalhe público de um restaurante + cardápio
  fastify.get('/restaurants/:id', async (request, reply) => {
    const { id } = request.params;

    const restaurant = await cacheAside(RedisKeys.restaurantCache(id), 60, () =>
      Restaurant.findById(id).lean()
    );
    if (!restaurant) throw NotFound('Restaurante não encontrado');

    const menu = await cacheAside(RedisKeys.restaurantMenuCache(id), 60, () =>
      Product.find({ restaurant: id, isAvailable: true }).sort({ category: 1 }).lean()
    );

    reply.send({ ...restaurant, menu });
  });

  // ---- 2. Gerenciar restaurante ----
  fastify.patch(
    '/restaurants/:id',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await getOwnedRestaurantOrThrow(request.params.id, request.user.sub);

      const allowedFields = [
        'name', 'description', 'category', 'phone', 'address',
        'deliveryFee', 'minOrderValue', 'openingHours', 'isOpen', 'logoUrl', 'avgPrepTimeMinutes'
      ];
      for (const field of allowedFields) {
        if (request.body?.[field] !== undefined) restaurant[field] = request.body[field];
      }

      await restaurant.save();
      await invalidateCache(RedisKeys.restaurantCache(restaurant._id));
      reply.send(restaurant);
    }
  );

  // Abrir/fechar loja rapidamente
  fastify.patch(
    '/restaurants/:id/toggle-open',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await getOwnedRestaurantOrThrow(request.params.id, request.user.sub);
      restaurant.isOpen = !restaurant.isOpen;
      await restaurant.save();
      await invalidateCache(RedisKeys.restaurantCache(restaurant._id));
      reply.send({ isOpen: restaurant.isOpen });
    }
  );

  // Restaurantes do dono logado
  fastify.get(
    '/restaurants/mine/all',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurants = await Restaurant.find({ owner: request.user.sub });
      reply.send(restaurants);
    }
  );

  // ---- Gerenciamento do cardápio (produtos) ----
  fastify.post(
    '/restaurants/:id/products',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await getOwnedRestaurantOrThrow(request.params.id, request.user.sub);
      const { name, description, price, category, imageUrl } = request.body || {};

      if (!name || price === undefined) throw BadRequest('name e price são obrigatórios');

      const product = await Product.create({
        restaurant: restaurant._id,
        name,
        description,
        price,
        category,
        imageUrl
      });

      await invalidateCache(RedisKeys.restaurantMenuCache(restaurant._id));
      reply.code(201).send(product);
    }
  );

  fastify.patch(
    '/restaurants/:id/products/:productId',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await getOwnedRestaurantOrThrow(request.params.id, request.user.sub);
      const product = await Product.findOne({ _id: request.params.productId, restaurant: restaurant._id });
      if (!product) throw NotFound('Produto não encontrado neste restaurante');

      const allowedFields = ['name', 'description', 'price', 'category', 'imageUrl', 'isAvailable'];
      for (const field of allowedFields) {
        if (request.body?.[field] !== undefined) product[field] = request.body[field];
      }

      await product.save();
      await invalidateCache(RedisKeys.restaurantMenuCache(restaurant._id));
      reply.send(product);
    }
  );

  fastify.delete(
    '/restaurants/:id/products/:productId',
    { preHandler: fastify.authorize(['restaurant_owner', 'admin']) },
    async (request, reply) => {
      const restaurant = await getOwnedRestaurantOrThrow(request.params.id, request.user.sub);
      await Product.findOneAndDelete({ _id: request.params.productId, restaurant: restaurant._id });
      await invalidateCache(RedisKeys.restaurantMenuCache(restaurant._id));
      reply.code(204).send();
    }
  );
}
