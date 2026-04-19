import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import multipart from '@fastify/multipart';
import {
  InspectionStatus,
  UserRole,
  type Prisma,
} from '@prisma/client';
import type { FastifyPluginAsync } from 'fastify';

import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../auth/auth.middleware';

interface CreateInspectionBody {
  locoId: string;
  templateId: string;
}

interface InspectionParams {
  id: string;
}

interface UpdateInspectionEntryInput {
  entryId: string;
  value: string;
  remarks?: string;
}

interface UpdateInspectionEntriesBody {
  entries: UpdateInspectionEntryInput[];
}

interface RejectInspectionBody {
  comments: string;
}

class LocomotiveNotFoundError extends Error { }
class TemplateNotFoundError extends Error { }
class ForbiddenInspectionAccessError extends Error { }
class InspectionNotEditableError extends Error { }
class InspectionNotSubmittableError extends Error { }
class InspectionEntryNotFoundError extends Error { }
class MandatoryFieldsMissingError extends Error { }
class FlaggedMediaRequiredError extends Error { }
class InvalidApproverRoleError extends Error { }
class InspectionNotApprovableError extends Error { }
class DuplicateApprovalError extends Error { }
class LevelOneApprovalRequiredError extends Error { }
class FlaggedEntriesBlockApprovalError extends Error { }

const templateItemDetailsSelect = {
  id: true,
  label: true,
  inputType: true,
  minValue: true,
  maxValue: true,
  isMandatory: true,
  section: true,
} satisfies Prisma.TemplateItemSelect;

const inspectionQueryInclude = {
  locomotive: true,
  template: {
    select: {
      id: true,
      name: true,
      version: true,
      isActive: true,
      createdAt: true,
    },
  },
  entries: {
    include: {
      templateItem: {
        select: templateItemDetailsSelect,
      },
    },
  },
  approvals: {
    select: {
      id: true,
      supervisorId: true,
      status: true,
      comments: true,
      level: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.InspectionInclude;

const getTrimmedValue = (value: string): string => value.trim();

const getApprovalLevelForRole = (role: UserRole): 1 | 2 => {
  if (role === UserRole.SUPERVISOR) {
    return 1;
  }

  if (role === UserRole.SENIOR_SUPERVISOR) {
    return 2;
  }

  throw new InvalidApproverRoleError();
};

const canAccessInspection = (
  role: UserRole,
  assignedTo: string,
  userId: string,
): boolean => {
  if (role === UserRole.SUPERVISOR || role === UserRole.SENIOR_SUPERVISOR) {
    return true;
  }

  return assignedTo === userId;
};

const isEntryFlagged = (
  value: string,
  minValue: number | null,
  maxValue: number | null,
): boolean => {
  if (minValue === null && maxValue === null) {
    return false;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return true;
  }

  if (minValue !== null && numericValue < minValue) {
    return true;
  }

  if (maxValue !== null && numericValue > maxValue) {
    return true;
  }

  return false;
};

const inspectionRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart);

  fastify.post<{ Body: CreateInspectionBody }>(
    '/inspections',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      if (request.user.role !== UserRole.WORKER) {
        return reply.code(403).send({ message: 'Only workers can create inspections' });
      }

      const { locoId, templateId } = request.body;

      if (
        typeof locoId !== 'string' ||
        typeof templateId !== 'string' ||
        locoId.trim() === '' ||
        templateId.trim() === ''
      ) {
        return reply.code(400).send({ message: 'locoId and templateId are required' });
      }

      try {
        const inspection = await prisma.$transaction(async (tx) => {
          const locomotive = await tx.locomotive.findUnique({
            where: { id: locoId },
            select: { id: true },
          });

          if (!locomotive) {
            throw new LocomotiveNotFoundError();
          }

          const template = await tx.template.findUnique({
            where: { id: templateId },
            include: {
              items: {
                select: {
                  id: true,
                },
              },
            },
          });

          if (!template) {
            throw new TemplateNotFoundError();
          }

          const createdInspection = await tx.inspection.create({
            data: {
              locoId,
              templateId,
              assignedTo: request.user.userId,
              status: InspectionStatus.DRAFT,
            },
          });

          if (template.items.length > 0) {
            await tx.inspectionEntry.createMany({
              data: template.items.map((item) => ({
                inspectionId: createdInspection.id,
                templateItemId: item.id,
                value: '',
                isFlagged: false,
              })),
            });
          }

          return tx.inspection.findUnique({
            where: { id: createdInspection.id },
            include: inspectionQueryInclude,
          });
        });

        if (!inspection) {
          return reply.code(500).send({ message: 'Failed to create inspection' });
        }

        return reply.code(201).send(inspection);
      } catch (error) {
        if (error instanceof LocomotiveNotFoundError) {
          return reply.code(404).send({ message: 'Locomotive not found' });
        }

        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: 'Template not found' });
        }

        throw error;
      }
    },
  );

  fastify.get(
    '/inspections',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const inspectionWhere: Prisma.InspectionWhereInput =
        request.user.role === UserRole.SUPERVISOR ||
        request.user.role === UserRole.SENIOR_SUPERVISOR
          ? {}
          : { assignedTo: request.user.userId };

      const inspections = await prisma.inspection.findMany({
        where: inspectionWhere,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          locomotive: {
            select: {
              locoNumber: true,
            },
          },
          template: {
            select: {
              name: true,
            },
          },
        },
      });

      return reply.send(inspections);
    },
  );

  fastify.get(
    '/locomotives',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const locomotives = await prisma.locomotive.findMany({
        orderBy: {
          locoNumber: 'asc',
        },
        select: {
          id: true,
          locoNumber: true,
        },
      });

      return reply.send(locomotives);
    },
  );

  fastify.get(
    '/templates',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const templates = await prisma.template.findMany({
        where: {
          isActive: true,
        },
        orderBy: [
          { name: 'asc' },
          { version: 'desc' },
        ],
        select: {
          id: true,
          name: true,
          version: true,
          isActive: true,
        },
      });

      return reply.send(templates);
    },
  );

  fastify.post(
    '/media/upload',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      let inspectionId = '';
      let templateItemId = '';
      let fileBuffer: Buffer | null = null;
      let originalFilename = '';
      let mimeType = '';

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          originalFilename = part.filename ?? 'upload.bin';
          mimeType = part.mimetype;

          const chunks: Buffer[] = [];

          for await (const chunk of part.file) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }

          fileBuffer = Buffer.concat(chunks);
          continue;
        }

        if (part.fieldname === 'inspectionId') {
          inspectionId = part.value;
          continue;
        }

        if (part.fieldname === 'templateItemId') {
          templateItemId = part.value;
        }
      }

      if (!fileBuffer || inspectionId.trim() === '' || templateItemId.trim() === '') {
        return reply.code(400).send({ message: 'file, inspectionId, and templateItemId are required' });
      }

      const inspection = await prisma.inspection.findUnique({
        where: { id: inspectionId },
        select: {
          id: true,
          assignedTo: true,
          entries: {
            where: {
              templateItemId,
            },
            select: {
              id: true,
            },
          },
        },
      });

      if (!inspection) {
        return reply.code(404).send({ message: 'Inspection not found' });
      }

      if (!canAccessInspection(request.user.role, inspection.assignedTo, request.user.userId)) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      if (inspection.entries.length === 0) {
        return reply.code(400).send({ message: 'templateItem does not belong to inspection' });
      }

      const uploadsDir = path.join(process.cwd(), 'uploads');
      const extension = path.extname(originalFilename) || '.bin';
      const generatedFilename = `${randomUUID()}${extension}`;
      const absoluteFilePath = path.join(uploadsDir, generatedFilename);
      const fileUrl = `/uploads/${generatedFilename}`;

      await mkdir(uploadsDir, { recursive: true });
      await writeFile(absoluteFilePath, fileBuffer);

      await prisma.media.create({
        data: {
          inspectionId,
          templateItemId,
          fileUrl,
          watermarkMeta: {
            originalFilename,
            mimeType,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      return reply.send({ fileUrl });
    },
  );

  fastify.get<{ Params: InspectionParams }>(
    '/inspections/:id',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const { id } = request.params;

      if (typeof id !== 'string' || id.trim() === '') {
        return reply.code(400).send({ message: 'Inspection id is required' });
      }

      const inspection = await prisma.inspection.findUnique({
        where: { id },
        include: inspectionQueryInclude,
      });

      if (!inspection) {
        return reply.code(404).send({ message: 'Inspection not found' });
      }

      if (!canAccessInspection(request.user.role, inspection.assignedTo, request.user.userId)) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      return reply.send(inspection);
    },
  );

  fastify.put<{ Params: InspectionParams; Body: UpdateInspectionEntriesBody }>(
    '/inspections/:id/entries',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const { id } = request.params;
      const { entries } = request.body;

      if (typeof id !== 'string' || id.trim() === '') {
        return reply.code(400).send({ message: 'Inspection id is required' });
      }

      if (!Array.isArray(entries) || entries.length === 0) {
        return reply.code(400).send({ message: 'entries must be a non-empty array' });
      }

      const uniqueEntryIds = new Set<string>();

      for (const entry of entries) {
        if (
          !entry ||
          typeof entry.entryId !== 'string' ||
          entry.entryId.trim() === '' ||
          typeof entry.value !== 'string'
        ) {
          return reply.code(400).send({ message: 'Each entry must contain entryId and value' });
        }

        if (typeof entry.remarks !== 'undefined' && typeof entry.remarks !== 'string') {
          return reply.code(400).send({ message: 'remarks must be a string when provided' });
        }

        if (uniqueEntryIds.has(entry.entryId)) {
          return reply.code(400).send({ message: 'Duplicate entryId in request' });
        }

        uniqueEntryIds.add(entry.entryId);
      }

      try {
        const inspection = await prisma.$transaction(async (tx) => {
          const currentInspection = await tx.inspection.findUnique({
            where: { id },
            include: {
              entries: {
                include: {
                  templateItem: {
                    select: {
                      id: true,
                      minValue: true,
                      maxValue: true,
                    },
                  },
                },
              },
            },
          });

          if (!currentInspection) {
            return null;
          }

          if (currentInspection.assignedTo !== request.user.userId) {
            throw new ForbiddenInspectionAccessError();
          }

          if (currentInspection.status !== InspectionStatus.DRAFT) {
            throw new InspectionNotEditableError();
          }

          const inspectionEntriesById = new Map(
            currentInspection.entries.map((entry) => [entry.id, entry]),
          );

          for (const entry of entries) {
            if (!inspectionEntriesById.has(entry.entryId)) {
              throw new InspectionEntryNotFoundError();
            }
          }

          await Promise.all(
            entries.map((entry) => {
              const currentEntry = inspectionEntriesById.get(entry.entryId);

              if (!currentEntry) {
                throw new InspectionEntryNotFoundError();
              }

              const value = entry.value;
              const remarks =
                typeof entry.remarks === 'string' ? entry.remarks : currentEntry.remarks;

              return tx.inspectionEntry.update({
                where: { id: entry.entryId },
                data: {
                  value,
                  remarks,
                  isFlagged: isEntryFlagged(
                    value,
                    currentEntry.templateItem.minValue,
                    currentEntry.templateItem.maxValue,
                  ),
                },
              });
            }),
          );

          return tx.inspection.findUnique({
            where: { id },
            include: inspectionQueryInclude,
          });
        });

        if (!inspection) {
          return reply.code(404).send({ message: 'Inspection not found' });
        }

        return reply.send(inspection);
      } catch (error) {
        if (error instanceof ForbiddenInspectionAccessError) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        if (error instanceof InspectionNotEditableError) {
          return reply.code(409).send({ message: 'Inspection is not in DRAFT status' });
        }

        if (error instanceof InspectionEntryNotFoundError) {
          return reply.code(400).send({ message: 'One or more entries do not belong to this inspection' });
        }

        throw error;
      }
    },
  );

  fastify.post<{ Params: InspectionParams }>(
    '/inspections/:id/submit',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const { id } = request.params;

      if (typeof id !== 'string' || id.trim() === '') {
        return reply.code(400).send({ message: 'Inspection id is required' });
      }

      try {
        const inspection = await prisma.$transaction(async (tx) => {
          const currentInspection = await tx.inspection.findUnique({
            where: { id },
            include: {
              entries: {
                include: {
                  templateItem: {
                    select: {
                      id: true,
                      isMandatory: true,
                    },
                  },
                },
              },
            },
          });

          if (!currentInspection) {
            return null;
          }

          if (currentInspection.assignedTo !== request.user.userId) {
            throw new ForbiddenInspectionAccessError();
          }

          if (currentInspection.status !== InspectionStatus.DRAFT) {
            throw new InspectionNotSubmittableError();
          }

          const missingMandatoryEntries = currentInspection.entries.filter(
            (entry) => entry.templateItem.isMandatory && getTrimmedValue(entry.value) === '',
          );

          if (missingMandatoryEntries.length > 0) {
            throw new MandatoryFieldsMissingError();
          }

          const flaggedTemplateItemIds = [
            ...new Set(
              currentInspection.entries
                .filter((entry) => entry.isFlagged)
                .map((entry) => entry.templateItemId),
            ),
          ];

          if (flaggedTemplateItemIds.length > 0) {
            const mediaRecords = await tx.media.findMany({
              where: {
                inspectionId: id,
                templateItemId: {
                  in: flaggedTemplateItemIds,
                },
              },
              select: {
                templateItemId: true,
              },
            });

            const mediaTemplateItemIds = new Set(
              mediaRecords
                .map((record) => record.templateItemId)
                .filter((templateItemId): templateItemId is string => templateItemId !== null),
            );

            const missingFlaggedMedia = flaggedTemplateItemIds.filter(
              (templateItemId) => !mediaTemplateItemIds.has(templateItemId),
            );

            if (missingFlaggedMedia.length > 0) {
              throw new FlaggedMediaRequiredError();
            }
          }

          await tx.inspection.update({
            where: { id },
            data: {
              status: InspectionStatus.SUBMITTED,
            },
          });

          return tx.inspection.findUnique({
            where: { id },
            include: inspectionQueryInclude,
          });
        });

        if (!inspection) {
          return reply.code(404).send({ message: 'Inspection not found' });
        }

        return reply.send(inspection);
      } catch (error) {
        if (error instanceof ForbiddenInspectionAccessError) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        if (error instanceof InspectionNotSubmittableError) {
          return reply.code(409).send({ message: 'Inspection is not in DRAFT status' });
        }

        if (error instanceof MandatoryFieldsMissingError) {
          return reply.code(400).send({ message: 'All mandatory fields must be filled before submission' });
        }

        if (error instanceof FlaggedMediaRequiredError) {
          return reply.code(400).send({ message: 'Flagged entries require at least one media attachment' });
        }

        throw error;
      }
    },
  );

  fastify.post<{ Params: InspectionParams }>(
    '/inspections/:id/approve',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      if (
        request.user.role !== UserRole.SUPERVISOR &&
        request.user.role !== UserRole.SENIOR_SUPERVISOR
      ) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      const { id } = request.params;

      if (typeof id !== 'string' || id.trim() === '') {
        return reply.code(400).send({ message: 'Inspection id is required' });
      }

      try {
        const inspection = await prisma.$transaction(async (tx) => {
          const currentInspection = await tx.inspection.findUnique({
            where: { id },
            include: {
              entries: {
                select: {
                  id: true,
                  isFlagged: true,
                },
              },
              approvals: {
                select: {
                  id: true,
                  level: true,
                  status: true,
                },
              },
            },
          });

          if (!currentInspection) {
            return null;
          }

          if (currentInspection.status !== InspectionStatus.SUBMITTED) {
            throw new InspectionNotApprovableError();
          }

          if (currentInspection.entries.some((entry) => entry.isFlagged)) {
            throw new FlaggedEntriesBlockApprovalError();
          }

          const approvalLevel = getApprovalLevelForRole(request.user.role);
          const hasLevelOneApproval = currentInspection.approvals.some(
            (approval) => approval.level === 1 && approval.status === 'APPROVED',
          );
          const duplicateApproval = currentInspection.approvals.some(
            (approval) => approval.level === approvalLevel && approval.status === 'APPROVED',
          );


          if (duplicateApproval) {
            throw new DuplicateApprovalError();
          }

          if (approvalLevel === 2 && !hasLevelOneApproval) {
            throw new LevelOneApprovalRequiredError();
          }

          const createdApproval = await tx.approval.create({
            data: {
              inspectionId: currentInspection.id,
              supervisorId: request.user.userId,
              status: 'APPROVED',
              comments: approvalLevel === 1 ? 'Level 1 approval' : 'Level 2 approval',
              level: approvalLevel,
            },
          });

          const nextStatus =
            approvalLevel === 2 ? InspectionStatus.APPROVED : InspectionStatus.SUBMITTED;

          await tx.inspection.update({
            where: { id: currentInspection.id },
            data: {
              status: nextStatus,
            },
          });

          const now = new Date();

          await tx.auditLog.create({
            data: {
              entity: 'Approval',
              entityId: createdApproval.id,
              oldData: {},
              newData: {
                inspectionId: currentInspection.id,
                supervisorId: request.user.userId,
                status: createdApproval.status,
                level: createdApproval.level,
              },
              changedBy: request.user.userId,
              action: 'CREATE',
              timestamp: now,
            },
          });

          await tx.auditLog.create({
            data: {
              entity: 'Inspection',
              entityId: currentInspection.id,
              oldData: {
                status: currentInspection.status,
                rejectionReason: currentInspection.rejectionReason,
              },
              newData: {
                status: nextStatus,
                rejectionReason: currentInspection.rejectionReason,
              },
              changedBy: request.user.userId,
              action: 'UPDATE',
              timestamp: now,
            },
          });

          return tx.inspection.findUnique({
            where: { id: currentInspection.id },
            include: inspectionQueryInclude,
          });
        });

        if (!inspection) {
          return reply.code(404).send({ message: 'Inspection not found' });
        }

        return reply.send(inspection);
      } catch (error) {
        if (error instanceof InvalidApproverRoleError) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        if (error instanceof InspectionNotApprovableError) {
          return reply.code(409).send({ message: 'Inspection is not approvable' });
        }

        if (error instanceof FlaggedEntriesBlockApprovalError) {
          return reply.code(400).send({ message: 'Flagged entries block approval' });
        }

        if (error instanceof DuplicateApprovalError) {
          return reply.code(409).send({ message: 'Duplicate approval is not allowed' });
        }

        if (error instanceof LevelOneApprovalRequiredError) {
          return reply.code(409).send({ message: 'Level 1 approval is required before final approval' });
        }

        throw error;
      }
    },
  );

  fastify.post<{ Params: InspectionParams; Body: RejectInspectionBody }>(
    '/inspections/:id/reject',
    { preHandler: authMiddleware },
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      if (
        request.user.role !== UserRole.SUPERVISOR &&
        request.user.role !== UserRole.SENIOR_SUPERVISOR
      ) {
        return reply.code(403).send({ message: 'Forbidden' });
      }

      const { id } = request.params;
      const { comments } = request.body;

      if (typeof id !== 'string' || id.trim() === '') {
        return reply.code(400).send({ message: 'Inspection id is required' });
      }

      if (typeof comments !== 'string' || comments.trim() === '') {
        return reply.code(400).send({ message: 'comments are required' });
      }

      try {
        const inspection = await prisma.$transaction(async (tx) => {
          const currentInspection = await tx.inspection.findUnique({
            where: { id },
            include: {
              approvals: {
                select: {
                  id: true,
                  level: true,
                },
              },
            },
          });

          if (!currentInspection) {
            return null;
          }

          if (
            currentInspection.status !== InspectionStatus.SUBMITTED &&
            currentInspection.status !== InspectionStatus.REJECTED
          ) {
            throw new InspectionNotApprovableError();
          }

          const approvalLevel = getApprovalLevelForRole(request.user.role);
          const hasLevelOneApproval = currentInspection.approvals.some(
            (approval) => approval.level === 1,
          );
          const duplicateApproval = currentInspection.approvals.some(
            (approval) => approval.level === approvalLevel,
          );

          if (duplicateApproval) {
            throw new DuplicateApprovalError();
          }

          if (approvalLevel === 2 && !hasLevelOneApproval) {
            throw new LevelOneApprovalRequiredError();
          }

          const createdApproval = await tx.approval.create({
            data: {
              inspectionId: currentInspection.id,
              supervisorId: request.user.userId,
              status: 'REJECTED',
              comments,
              level: approvalLevel,
            },
          });

          await tx.inspection.update({
            where: { id: currentInspection.id },
            data: {
              status: InspectionStatus.DRAFT,
              rejectionReason: comments,
            },
          });

          const now = new Date();

          await tx.auditLog.create({
            data: {
              entity: 'Approval',
              entityId: createdApproval.id,
              oldData: {},
              newData: {
                inspectionId: currentInspection.id,
                supervisorId: request.user.userId,
                status: createdApproval.status,
                comments: createdApproval.comments,
                level: createdApproval.level,
              },
              changedBy: request.user.userId,
              action: 'CREATE',
              timestamp: now,
            },
          });

          await tx.auditLog.create({
            data: {
              entity: 'Inspection',
              entityId: currentInspection.id,
              oldData: {
                status: currentInspection.status,
                rejectionReason: currentInspection.rejectionReason,
              },
              newData: {
                status: InspectionStatus.DRAFT,
                rejectionReason: comments,
              },
              changedBy: request.user.userId,
              action: 'UPDATE',
              timestamp: now,
            },
          });

          return tx.inspection.findUnique({
            where: { id: currentInspection.id },
            include: inspectionQueryInclude,
          });
        });

        if (!inspection) {
          return reply.code(404).send({ message: 'Inspection not found' });
        }

        return reply.send(inspection);
      } catch (error) {
        if (error instanceof InvalidApproverRoleError) {
          return reply.code(403).send({ message: 'Forbidden' });
        }

        if (error instanceof InspectionNotApprovableError) {
          return reply.code(409).send({ message: 'Inspection is not rejectable' });
        }

        if (error instanceof DuplicateApprovalError) {
          return reply.code(409).send({ message: 'Duplicate approval is not allowed' });
        }

        if (error instanceof LevelOneApprovalRequiredError) {
          return reply.code(409).send({ message: 'Level 1 approval is required before level 2 rejection' });
        }

        throw error;
      }
    },
  );
};

export default inspectionRoutes;
