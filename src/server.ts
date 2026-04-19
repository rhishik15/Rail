import 'dotenv/config';
import Fastify from 'fastify';
import { Prisma } from '@prisma/client';
import authRoutes from './modules/auth/auth.routes';
import { authMiddleware } from './modules/auth/auth.middleware';
import inspectionRoutes from './modules/inspections/inspection.routes';

const fastify = Fastify({ logger: true });

fastify.setErrorHandler((error, _request, reply) => {
  const isDatabaseUnavailable =
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'ECONNREFUSED');

  if (isDatabaseUnavailable) {
    fastify.log.error(error);
    void reply.code(503).send({ message: 'Database unavailable' });
    return;
  }

  fastify.log.error(error);
  void reply.code(500).send({ message: 'Internal server error' });
});

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
