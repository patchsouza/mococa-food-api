import { ServiceArea } from '../models/ServiceArea.js';

export default async function serviceAreaRoutes(fastify) {
  fastify.get('/service-areas', async (request, reply) => {
    const areas = await ServiceArea.find({ isActive: true })
      .select('name slug city state boundary')
      .sort({ state: 1, city: 1, name: 1 })
      .lean();
    reply.send(areas);
  });
}