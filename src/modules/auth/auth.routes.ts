import * as bcrypt from 'bcrypt';
import type { FastifyPluginAsync } from 'fastify';

import { prisma } from '../../lib/prisma';
import { signAuthToken } from './auth.jwt';
import { createInspectionSessionState } from './auth.session';

interface LoginBody {
  employeeId: string;
  password: string;
  deviceId: string;
}

class InvalidCredentialsError extends Error {}
class DeviceMismatchError extends Error {}

const INVALID_CREDENTIALS_MESSAGE = { message: 'Invalid employeeId or password' };
const DEVICE_MISMATCH_MESSAGE = { message: 'Device mismatch' };

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    const { employeeId, password, deviceId } = request.body;

    if (
      typeof employeeId !== 'string' ||
      typeof password !== 'string' ||
      typeof deviceId !== 'string' ||
      employeeId.trim() === '' ||
      password === '' ||
      deviceId.trim() === ''
    ) {
      return reply.code(400).send({ message: 'employeeId, password, and deviceId are required' });
    }

    const user = await prisma.user.findUnique({
      where: { employeeId },
    });

    if (!user) {
      return reply.code(401).send(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return reply.code(401).send(INVALID_CREDENTIALS_MESSAGE);
    }

    try {
      const authenticatedUser = await prisma.$transaction(async (tx) => {
        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
        });

        if (!currentUser) {
          throw new InvalidCredentialsError();
        }

        if (currentUser.deviceId === null) {
          return tx.user.update({
            where: { id: currentUser.id },
            data: { deviceId },
          });
        }

        if (currentUser.deviceId !== deviceId) {
          throw new DeviceMismatchError();
        }

        return currentUser;
      });

      const sessionState = createInspectionSessionState(authenticatedUser.id);
      void sessionState;

      const token = signAuthToken({
        userId: authenticatedUser.id,
        role: authenticatedUser.role,
      });

      return reply.send({
        token,
        user: {
          id: authenticatedUser.id,
          role: authenticatedUser.role,
        },
      });
    } catch (error) {
      if (error instanceof DeviceMismatchError) {
        return reply.code(403).send(DEVICE_MISMATCH_MESSAGE);
      }

      if (error instanceof InvalidCredentialsError) {
        return reply.code(401).send(INVALID_CREDENTIALS_MESSAGE);
      }

      throw error;
    }
  });
};

export default authRoutes;
