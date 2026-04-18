import 'dotenv/config';
import Fastify from 'fastify';
import authRoutes from './modules/auth/auth.routes';
import { authMiddleware } from './modules/auth/auth.middleware';
import inspectionRoutes from './modules/inspections/inspection.routes';

const fastify = Fastify({ logger: true });

// Register auth routes (public)
fastify.register(authRoutes);
fastify.register(inspectionRoutes);

// Example protected route for testing middleware
fastify.get('/protected', { preHandler: authMiddleware }, async (request, reply) => {
  return { message: 'Access granted', user: request.user };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running on http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
