import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyAuthToken } from './auth.jwt';

const UNAUTHORIZED_MESSAGE = { message: 'Unauthorized' };

export const authMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const authorization = request.headers.authorization;

  if (!authorization) {
    void reply.code(401).send(UNAUTHORIZED_MESSAGE);
    return;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    void reply.code(401).send(UNAUTHORIZED_MESSAGE);
    return;
  }

  try {
    request.user = verifyAuthToken(token);
  } catch {
    void reply.code(401).send(UNAUTHORIZED_MESSAGE);
  }
};
