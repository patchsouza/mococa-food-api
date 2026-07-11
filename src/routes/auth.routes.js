import { User } from '../models/User.js';
import { BadRequest, Unauthorized } from '../utils/errors.js';
import { redis, RedisKeys } from '../config/redis.js';
import bcrypt from 'bcryptjs'; // Importando a biblioteca bcrypt

export default async function authRoutes(fastify) {
  // Cadastro de usuário (cliente, dono de restaurante ou entregador)
  fastify.post('/auth/register', async (request, reply) => {
    const { name, email, password, role, phone, address } = request.body || {};

    if (!name || !email || !password) {
      throw BadRequest('name, email e password são obrigatórios');
    }
    if (password.length < 6) {
      throw BadRequest('A senha deve ter ao menos 6 caracteres');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw BadRequest('Já existe um usuário com este e-mail');

    // Gerando o hash da senha com bcrypt (10 é o custo/salt rounds padrão recomendado)
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      phone,
      address,
      role: ['customer', 'restaurant_owner', 'courier'].includes(role) ? role : 'customer'
    });

    const token = fastify.jwt.sign({ sub: String(user._id), role: user.role, name: user.name });

    reply.code(201).send({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  });

  // Login
  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) throw BadRequest('email e password são obrigatórios');

    // Proteção simples contra força bruta
    const attemptsKey = RedisKeys.loginAttempts(email.toLowerCase());
    const attempts = Number((await redis.get(attemptsKey)) || 0);
    if (attempts >= 10) {
      throw Unauthorized('Muitas tentativas de login. Tente novamente em alguns minutos.');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Verificando a senha com bcrypt.compare
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!valid) {
      await redis.multi().incr(attemptsKey).expire(attemptsKey, 300).exec();
      throw Unauthorized('E-mail ou senha inválidos');
    }

    await redis.del(attemptsKey);

    const token = fastify.jwt.sign({ sub: String(user._id), role: user.role, name: user.name });
    reply.send({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  });

  // Perfil do usuário autenticado
  fastify.get('/auth/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.sub).select('-passwordHash');
    reply.send(user);
  });
}