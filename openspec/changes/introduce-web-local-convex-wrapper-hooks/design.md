## Overview

This change introduces an app-local wrapper hook layer in `apps/web` so generated Convex hook refs are no longer consumed directly throughout page and component files. The intent is to keep UI modules focused on rendering, local interaction state, and composition, while a dedicated web-owned layer handles generated API refs, skip/enabled gating, and stable app-local types.

## Goals

- Remove the need for repeated `@ts-expect-error` suppressions in web UI files caused by generated Convex type instantiation depth.
- Define a stable local pattern for web data-access hooks that is incremental, readable, and easy to adopt in new code.
- Keep wrapper logic local to `apps/web` so frontend ergonomics can improve without forcing a cross-package Convex API redesign.
- Support route/controller hooks that compose multiple domain wrappers for large editor/admin pages.
- Preserve all existing server contracts and user-visible behavior while moving typing complexity out of UI call sites.

## Non-Goals

- Redesigning Convex backend contracts, auth wrappers, or generated API output in this change.
- Replacing every direct Convex hook call in the web app in one implementation step.
- Introducing a generic abstraction so broad that it obscures which query, mutation, or action is being executed.
- Changing route UX, permissions, or business logic as part of wrapper extraction.

## Architecture

### Layered wrapper model

- Add a minimal web-local Convex adapter layer under `apps/web/src/lib/convex/` for narrow typed primitives that can centralize any unavoidable cast/suppression.
- Add domain-specific wrapper hooks under `apps/web/src/hooks/convex/` or feature-local hook folders for readable, explicit app-owned APIs such as `useAuditLogAccess`, `useWidgetSessionSettings`, `useOutboundMessages`, and `useTourEditorData`.
- Allow large route/controller hooks to compose those domain wrappers so pages such as settings, outbound editors, and tour editors can own orchestration without owning generated Convex type complexity.

### Domain-first migration

- Start with high-value domains that already show suppression pressure and dense direct hook usage: settings/security, workspace member settings, outbound flows, and tours.
- After the pattern is established, migrate additional high-churn admin routes incrementally.
- Keep new code from introducing more direct generated Convex hook usage in UI modules once wrapper coverage exists for a domain.

### Wrapper design rules

- Wrapper hooks expose explicit, app-local argument and return types instead of leaking giant inferred generated types into UI files.
- Skip/enabled logic should live inside wrapper signatures where practical so UI modules do not repeatedly construct `"skip"` conditions inline.
- Domain wrappers should remain explicit and discoverable rather than relying on a single generic factory for all queries/mutations/actions.
- Any unavoidable cast or suppression should be centralized in the smallest possible adapter boundary.

### Testing approach

- Add focused tests for wrapper logic that normalizes args, gating, or derived return shapes.
- Update existing page/component tests for migrated domains without changing visible behavior expectations.
- Use targeted web typecheck/test runs during migration because wrapper extraction affects many high-usage files.

## Risks and Mitigations

- Risk: a generic wrapper utility becomes too magical and recreates inference problems in a new place.
  - Mitigation: keep shared adapter primitives thin and push explicit types to domain-specific wrappers.
- Risk: migration churn creates mixed patterns during rollout.
  - Mitigation: document a clear adoption rule and migrate by domain, starting with the worst-affected routes.
- Risk: wrappers accidentally change payload or permission semantics.
  - Mitigation: wrappers must preserve existing generated function refs, args, and behavior; tests should focus on parity.
- Risk: overlap with other web refactor changes causes unclear ownership.
  - Mitigation: keep this change focused on typed data-access boundaries, while page composition and async-flow changes consume the resulting layer rather than duplicating it.

## Rollout Notes

- Establish the wrapper foundation first.
- Migrate settings/security and workspace member flows next because they already contain concentrated suppressions and repeated direct hook usage.
- Follow with outbound and tours editor/controller hooks.
- Treat remaining web admin routes as incremental follow-on migrations once the pattern is validated.
