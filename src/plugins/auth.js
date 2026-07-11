import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../utils/errors.js';

async function authPlugin(fastify) {
  fastify.register(jwt, {
    secret: env.jwtSecret,
    sign: { expiresIn: env.jwtExpiresIn }
  });

  // fastify.authenticate: valida o token e popula request.user
  fastify.decorate('authenticate', async function (request) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw Unauthorized('Token ausente ou inválido');
    }
  });

  // fastify.authorize(['restaurant_owner', 'admin']): restringe por papel
  fastify.decorate('authorize', function (roles = []) {
    return async function (request) {
      await fastify.authenticate(request);
      if (roles.length && !roles.includes(request.user.role)) {
        throw Forbidden(`Ação restrita a: ${roles.join(', ')}`);
      }
    };
  });
}

export default fp(authPlugin);
