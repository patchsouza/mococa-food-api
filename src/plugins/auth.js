import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../utils/errors.js';
import { User } from '../models/User.js';
import { Admin } from '../models/Admin.js';

async function authPlugin(fastify) {
  fastify.decorateRequest('admin', null);
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

    if (request.user.principalType !== 'user' || request.user.role === 'admin') {
      throw Unauthorized('Token de usuário inválido');
    }

    const user = await User.findById(request.user.sub).select('_id role isActive');
    if (!user || !user.isActive || user.role !== request.user.role) {
      throw Unauthorized('Conta inválida ou desativada');
    }
  });

  fastify.decorate('authenticateAdmin', async function (request) {
    try {
      await request.jwtVerify();
    } catch (err) {
      throw Unauthorized('Token administrativo ausente ou inválido');
    }

    if (request.user.principalType !== 'admin') {
      throw Unauthorized('Token administrativo inválido');
    }

    const admin = await Admin.findById(request.user.sub).select('-passwordHash');
    if (!admin || !admin.isActive || request.user.sessionVersion !== admin.sessionVersion) {
      throw Unauthorized('Sessão administrativa inválida, expirada ou revogada');
    }
    request.admin = admin;
  });

  fastify.decorate('authorize', function (roles = []) {
    return async function (request) {
      await fastify.authenticate(request);
      if (roles.length && !roles.includes(request.user.role)) {
        throw Forbidden(`Ação restrita a: ${roles.join(', ')}`);
      }
    };
  });

  fastify.decorate('authorizeAdmin', function (permissions = []) {
    return async function (request) {
      await fastify.authenticateAdmin(request);
      if (request.admin.permissions.includes('*')) return;
      if (permissions.some((permission) => !request.admin.permissions.includes(permission))) {
        throw Forbidden('Permissão administrativa insuficiente');
      }
    };
  });
}

export default fp(authPlugin);
