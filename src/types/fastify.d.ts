import type { AuthTokenPayload } from '../modules/auth/auth.jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthTokenPayload;
  }
}

export {};
