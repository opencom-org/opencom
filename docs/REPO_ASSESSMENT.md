# Repository Analysis and Assessment: Opencom

This document serves as a persistent record of the repository assessment and analysis performed on March 18, 2026. It highlights core architectural patterns, security standards, and development workflows to guide future development.

## 1. Architecture and Tech Stack
Opencom is an open-source customer messaging platform alternative to Intercom, organized as a **PNPM monorepo** with the following primary components:

*   **Backend**: Powered by **Convex**, a serverless platform handling database (schema-driven), authentication, real-time subscriptions, and file storage.
*   **Web Dashboard (`apps/web`)**: A Next.js application for agents and admins to manage conversations, tickets, and workspace settings.
*   **Mobile App (`apps/mobile`)**: An Expo-based React Native application for on-the-go support.
*   **Widget (`apps/widget`)**: A lightweight Vite-based React application that generates an IIFE bundle for embedding on customer websites.
*   **Landing Page (`apps/landing`)**: A Next.js marketing site.
*   **SDKs**: Shared logic is abstracted into `packages/sdk-core`, with dedicated SDKs for React Native, iOS (Swift), and Android (Kotlin).

## 2. Core Logic and Security
*   **Multi-tenancy**: Strictly enforced at the database level using `workspaceId`. All queries and mutations are indexed and filtered by workspace.
*   **Authentication**: Dual-path auth system. Agents use session-based auth with RBAC, while visitors use signed session tokens (`wst_...`) validated via `resolveVisitorFromSession`.
*   **Permission System**: Fine-grained permissions (e.g., `conversations.read`, `conversations.reply`) are checked at the backend boundary.
*   **Bot Protection**: Bot and system messages are restricted to internal mutations, preventing external callers from impersonating the system.

## 3. Development Workflow and Standards
*   **Convex Type Safety**: The project enforces strict standards to prevent `TS2589` (excessive type instantiation) errors. It uses an adapter pattern in the frontend and named, module-scope function references in the backend. (Refer to `docs/convex-type-safety-playbook.md`).
*   **OpenSpec**: A formal specification workflow is used to manage changes. Proposals, designs, and tasks are tracked in `openspec/changes/`.
*   **Quality Gates**: The `pnpm ci:check` command runs a comprehensive suite of checks, including linting, typechecking, security audits (secret scanning, header checks, dependency audits), and tests.
*   **UI Consistency**: Shared components are located in `packages/ui`, built with **Tailwind CSS** and **Shadcn UI**.

## 4. Assessment Summary
The repository demonstrates high engineering standards and is exceptionally well-structured for scalability. The decision to use Convex as a unified backend simplifies state management and real-time features. Strict type-hardening and automated security gates (including dependency audits and secret scanning) provide a robust foundation for community contributions. The "OpenSpec" workflow ensures that requirements and implementations remain aligned.
