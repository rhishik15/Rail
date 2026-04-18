# RAIL Build Summary

## Overview

This repository currently contains two parallel parts:

1. A Node.js backend built with Fastify, TypeScript, Prisma ORM, and PostgreSQL.
2. A React Native mobile app built with Expo and TypeScript under `mobile/`.

The implemented work so far covers:

- Prisma data model for the railway inspection domain
- backend authentication
- inspection creation, retrieval, update, submission, approval, and rejection routes
- Expo mobile authentication context
- Expo mobile Axios API service
- Expo mobile navigation and basic screens

---

## Prisma Data Model

File:

- `prisma/schema.prisma`

Implemented schema models:

- `User`
- `Locomotive`
- `Template`
- `TemplateItem`
- `Inspection`
- `InspectionEntry`
- `Media`
- `Approval`
- `AuditLog`

Implemented enums:

- `UserRole`
- `TemplateInputType`
- `InspectionStatus`
- `ApprovalStatus`

Implemented schema details:

- all primary keys use `String @id @default(uuid())`
- timestamps added where requested:
  - `User.createdAt`, `User.updatedAt`
  - `Locomotive.createdAt`, `Locomotive.updatedAt`
  - `Template.createdAt`, `Template.updatedAt`
  - `Inspection.createdAt`, `Inspection.updatedAt`
  - `Approval.createdAt`, `Approval.updatedAt`
- `User.deviceId` is optional
- `Approval.level` exists for multi-level approvals
- `Inspection.rejectionReason` exists
- `Media.templateItemId` exists to link media to a specific checklist item
- `AuditLog.action` exists
- relations and indexes are defined across the workflow entities

Notes:

- the `datasource db` block currently has `provider = "postgresql"` but no inline `url`
- current backend Prisma usage is via generated Prisma Client in `src/lib/prisma.ts`

---

## Backend Structure

Files:

- `src/server.ts`
- `src/lib/prisma.ts`
- `src/types/fastify.d.ts`
- `src/modules/auth/*`
- `src/modules/inspections/*`

### Prisma Client

File:

- `src/lib/prisma.ts`

Implemented:

- singleton Prisma client
- development-safe reuse through `globalThis`

### Fastify Request Typing

File:

- `src/types/fastify.d.ts`

Implemented:

- `FastifyRequest.user` typing for authenticated requests

### Server Registration

File:

- `src/server.ts`

Implemented:

- Fastify server bootstrap
- auth routes registration
- inspection routes registration
- protected test route using auth middleware

---

## Backend Authentication Module

Files:

- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.middleware.ts`
- `src/modules/auth/auth.jwt.ts`
- `src/modules/auth/auth.session.ts`
- `src/modules/auth/index.ts`

### JWT Utility

File:

- `src/modules/auth/auth.jwt.ts`

Implemented:

- `AuthTokenPayload` with:
  - `userId`
  - `role`
- `signAuthToken(...)`
- `verifyAuthToken(...)`
- `JWT_SECRET`-based signing and verification

### Auth Middleware

File:

- `src/modules/auth/auth.middleware.ts`

Implemented:

- bearer token parsing from `Authorization` header
- JWT verification
- attaching decoded user payload to `request.user`
- 401 handling for missing or invalid tokens

### Session Placeholder

File:

- `src/modules/auth/auth.session.ts`

Implemented:

- placeholder inspection-session tracking structure
- `MAX_INSPECTIONS_PER_SESSION`
- `createInspectionSessionState(...)`
- `registerInspectionAgainstSession(...)`
- `shouldForceRelogin(...)`

This is placeholder logic only. There is no persistent server-side enforcement yet.

### Login Route

File:

- `src/modules/auth/auth.routes.ts`

Implemented route:

- `POST /auth/login`

Implemented behavior:

- validates `employeeId`, `password`, `deviceId`
- finds user by `employeeId`
- compares password with `bcrypt`
- device binding logic:
  - if `deviceId` is `null`, binds first login device
  - if already set, rejects mismatched device
- creates JWT with:
  - `userId`
  - `role`
- returns:
  - `token`
  - `user.id`
  - `user.role`

---

## Backend Inspection Workflow

Files:

- `src/modules/inspections/inspection.routes.ts`
- `src/modules/inspections/index.ts`

### Inspection Creation

Implemented route:

- `POST /inspections`

Implemented behavior:

- protected by auth middleware
- restricted to `WORKER`
- validates `locoId` and `templateId`
- validates locomotive existence
- loads template and template items
- creates inspection with:
  - `assignedTo = current user`
  - `status = DRAFT`
- creates one `InspectionEntry` per `TemplateItem`
  - `value = ""`
  - `isFlagged = false`
- returns created inspection with:
  - locomotive
  - template
  - entries
  - approvals include block

### Inspection Retrieval

Implemented route:

- `GET /inspections/:id`

Implemented behavior:

- protected by auth middleware
- returns inspection details including:
  - locomotive
  - template
  - entries
  - template item details
  - approvals
- only the assigned worker can access

### Inspection Entry Update

Implemented route:

- `PUT /inspections/:id/entries`

Implemented behavior:

- protected by auth middleware
- only assigned worker can update
- only allowed while inspection is `DRAFT`
- validates request body and duplicate entry IDs
- validates that each entry belongs to the inspection
- updates:
  - `value`
  - `remarks`
  - `isFlagged`

Validation logic:

- if template item has `minValue` or `maxValue`, value is converted to number
- non-numeric values for ranged items are flagged
- out-of-range values are flagged
- in-range values are unflagged

### Inspection Submission

Implemented route:

- `POST /inspections/:id/submit`

Implemented behavior:

- protected by auth middleware
- only assigned worker can submit
- only allowed while inspection is `DRAFT`
- validates mandatory entries are filled
- validates flagged entries have at least one `Media` record linked through `templateItemId`
- transitions inspection status to `SUBMITTED`

### Multi-Level Approval

Implemented route:

- `POST /inspections/:id/approve`

Implemented approval roles:

- `SUPERVISOR` = level 1
- `SENIOR_SUPERVISOR` = level 2

Implemented behavior:

- protected by auth middleware
- restricted to supervisor roles
- only approvable when inspection status is `SUBMITTED`
- blocks approval if any inspection entry is flagged
- prevents duplicate approved records at the same level
- requires level 1 approval before level 2 approval
- creates `Approval` record
- status transitions:
  - level 1 approval keeps inspection at `SUBMITTED`
  - level 2 approval moves inspection to `APPROVED`
- writes audit logs for:
  - approval creation
  - inspection status update

### Rejection Workflow

Implemented route:

- `POST /inspections/:id/reject`

Input:

- `comments`

Implemented behavior:

- protected by auth middleware
- restricted to supervisor roles
- creates rejected `Approval` record
- sets:
  - `inspection.status = DRAFT`
  - `inspection.rejectionReason = comments`
- writes audit logs for:
  - approval creation
  - inspection status update

Current rejection behavior in code:

- editable state is restored by moving status back to `DRAFT`

---

## Audit Logging

Implemented inside approval/rejection flow:

- `AuditLog` records are created for approval creation
- `AuditLog` records are created for inspection state transitions

Current coverage:

- approval and rejection workflow

Not currently implemented:

- audit logging for login
- audit logging for inspection creation
- audit logging for entry updates
- audit logging for submission

---

## Mobile App Structure

Root:

- `mobile/`

Key files:

- `mobile/App.tsx`
- `mobile/package.json`
- `mobile/app.json`
- `mobile/tsconfig.json`
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `mobile/src/services/api.ts`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/screens/InspectionListScreen.tsx`
- `mobile/src/screens/InspectionDetailScreen.tsx`
- `mobile/src/components/EntryField.tsx`
- `mobile/src/types/inspection.ts`

### Mobile App Bootstrap

File:

- `mobile/App.tsx`

Implemented:

- wraps app with `AuthProvider`
- mounts `AppNavigator`

### Mobile Authentication Context

File:

- `mobile/src/context/AuthContext.tsx`

Implemented:

- React Context + `useState`
- stores:
  - `token`
  - `user`
- exposes:
  - `login(employeeId, password)`
  - `logout()`
- calls API login
- stores token and user in memory
- registers a token getter with the Axios service

Current behavior:

- token is in React state only
- no persistence to AsyncStorage or secure storage

### Mobile API Service

File:

- `mobile/src/services/api.ts`

Implemented:

- Axios instance
- base URL:
  - `http://192.168.1.103:3000`
- timeout:
  - `5000ms`
- request interceptor that attaches bearer token via token getter placeholder

Exported functions:

- `login(...)`
- `getInspections()`
- `getInspectionById(...)`
- `submitInspection(...)`

### Mobile Navigation

File:

- `mobile/src/navigation/AppNavigator.tsx`

Implemented:

- React Navigation stack
- auth-gated navigation
- routes:
  - `Login`
  - `InspectionList`
  - `InspectionDetail`

Navigation behavior:

- if not logged in:
  - show `LoginScreen`
- if logged in:
  - show `InspectionListScreen`
  - navigate to `InspectionDetailScreen`

### Login Screen

File:

- `mobile/src/screens/LoginScreen.tsx`

Implemented:

- `employeeId` input
- `password` input
- login button
- loading state
- error text
- calls `useAuth().login(...)`

### Inspection List Screen

File:

- `mobile/src/screens/InspectionListScreen.tsx`

Implemented:

- fetches inspections through `getInspections()`
- loading state
- displays list of:
  - inspection ID
  - status
- tap navigates to inspection detail

### Inspection Detail Screen

File:

- `mobile/src/screens/InspectionDetailScreen.tsx`

Implemented:

- fetches inspection by ID using `getInspectionById(...)`
- shows:
  - template name
  - status
  - inspection ID
  - basic list of entries
- submit button calls `submitInspection(...)`
- loading and submit states

### Dynamic Form Component

File:

- `mobile/src/components/EntryField.tsx`

Implemented component support for:

- `TEXT`
- `NUMBER`
- `CHECKBOX`
- `DROPDOWN`

Implemented behavior:

- renders basic input control per `templateItem.inputType`
- remarks field
- flagged marker
- min/max display

Current usage status:

- component exists
- current `InspectionDetailScreen` does not use it
- current `InspectionDetailScreen` does basic read-only entry rendering plus submit

### Shared Mobile Types

File:

- `mobile/src/types/inspection.ts`

Implemented:

- auth response types
- inspection list item types
- inspection detail types
- template item detail types
- user role and status unions

---

## Current Functional Gaps / Integration Mismatches

These are important to keep in mind because they affect runtime behavior.

### 1. Backend does not currently expose `GET /inspections`

Current mobile code calls:

- `GET /inspections`

Current backend routes implemented:

- `POST /inspections`
- `GET /inspections/:id`
- `PUT /inspections/:id/entries`
- `POST /inspections/:id/submit`
- `POST /inspections/:id/approve`
- `POST /inspections/:id/reject`

Impact:

- `InspectionListScreen` will not work against the backend until a list route is added

### 2. Mobile detail screen is basic, not dynamic

Current state:

- `EntryField.tsx` supports dynamic controls
- `InspectionDetailScreen.tsx` currently renders entries read-only in a simple list

Impact:

- worker-side entry editing UI is not wired into the current mobile detail screen

### 3. Mobile API no longer exports inspection entry update function

Backend supports:

- `PUT /inspections/:id/entries`

Current mobile API service exports:

- login
- getInspections
- getInspectionById
- submitInspection

Impact:

- mobile app cannot currently edit inspection entries through the backend

### 4. Approval assignment is not modeled in the schema

Requirement discussed:

- only assigned supervisors should approve

Current schema:

- has supervisor users
- has approvals
- does not have a dedicated “assigned supervisor” field on inspection

Current code behavior:

- approval authorization is role-based
- no explicit assigned-supervisor enforcement is possible with the current schema

### 5. Prisma datasource URL is not embedded in schema

Current schema:

- `provider = "postgresql"`
- no inline `url = env("DATABASE_URL")`

Impact:

- Prisma CLI commands may require explicit config setup or schema updates depending on how they are run

---

## Files Added or Updated During This Build

Backend:

- `prisma/schema.prisma`
- `src/lib/prisma.ts`
- `src/types/fastify.d.ts`
- `src/server.ts`
- `src/modules/auth/auth.jwt.ts`
- `src/modules/auth/auth.middleware.ts`
- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.session.ts`
- `src/modules/auth/index.ts`
- `src/modules/inspections/inspection.routes.ts`
- `src/modules/inspections/index.ts`

Mobile:

- `mobile/package.json`
- `mobile/app.json`
- `mobile/tsconfig.json`
- `mobile/App.tsx`
- `mobile/src/types/inspection.ts`
- `mobile/src/services/api.ts`
- `mobile/src/context/AuthContext.tsx`
- `mobile/src/navigation/AppNavigator.tsx`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/screens/InspectionListScreen.tsx`
- `mobile/src/screens/InspectionDetailScreen.tsx`
- `mobile/src/components/EntryField.tsx`

---

## Summary

The backend currently supports:

- schema-backed railway inspection entities
- device-bound JWT login
- worker inspection creation
- worker inspection retrieval
- inspection entry updates with range-based flagging
- inspection submission with mandatory-field and media validation
- two-level approval and rejection flow
- audit logging for approval decisions

The mobile app currently supports:

- login flow
- in-memory auth context
- bearer-token Axios service
- authenticated navigation switching
- inspection list screen shell
- inspection detail screen shell
- submit action

The main next integration items are:

- add backend `GET /inspections`
- re-enable editable dynamic inspection form in mobile detail
- add mobile API support for updating entries
- resolve Prisma CLI datasource configuration consistently
