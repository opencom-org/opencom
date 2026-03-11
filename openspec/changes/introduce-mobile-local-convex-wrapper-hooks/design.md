## Overview

As of March 11, 2026, a repo-wide scan shows the mobile app has only a small but high-impact set of direct `convex/react` consumers left outside its provider boundary:

- `apps/mobile/src/contexts/AuthContext.tsx`
- `apps/mobile/src/contexts/NotificationContext.tsx`
- `apps/mobile/app/(app)/index.tsx`
- `apps/mobile/app/(app)/conversation/[id].tsx`
- `apps/mobile/app/(app)/settings.tsx`
- `apps/mobile/app/(app)/onboarding.tsx`

`apps/mobile/app/_layout.tsx` still imports `ConvexReactClient` for app bootstrapping and remains an allowed provider boundary. The problem is not raw file count anymore. It is that the remaining direct consumers are the exact auth, onboarding, inbox, conversation, settings, and notification surfaces where parity work keeps landing.

This change introduces a mobile-local wrapper hook layer so generated Convex hook refs are no longer consumed directly throughout mobile screens and context modules. The goal is to keep mobile navigation, onboarding, and inbox flows focused on user interaction and device-specific behavior while app-owned wrappers handle generated API refs, gating, and explicit mobile-local types.

## Goals

- Reduce direct generated Convex hook usage in mobile screens and contexts.
- Keep type-system escape hatches and transport-specific gating out of route components and shared mobile context modules.
- Support ongoing parity and onboarding work without increasing coupling between navigation logic and generated API complexity.
- Preserve existing mobile product behavior, payload semantics, and routing/user-visible flows.
- Establish a repeatable pattern for future mobile features that consume Convex APIs.

## Non-Goals

- Redesigning mobile UX, navigation structure, or backend/onboarding product rules.
- Moving all mobile domain logic into shared cross-surface packages in this change.
- Changing backend contracts or generated API output.
- Migrating every mobile Convex hook call in one implementation step.

## Architecture

### Layered mobile data-access model

- Add a minimal mobile-local adapter layer under `apps/mobile/src/lib/convex/` or an equivalent local path for narrow typed primitives.
- Add explicit domain wrapper hooks under `apps/mobile/src/hooks/convex/` or feature-local hook folders for onboarding/workspace selection, inbox/conversation flows, settings, and notifications.
- Allow context modules and screen/controller hooks to compose domain wrappers while keeping navigation and device-local state concerns separate.

### Domain-first migration

- Start with the most cross-cutting mobile domains: auth/workspace resolution, onboarding decisions, inbox/conversation flows, settings, and notification registration.
- Migrate the remaining direct consumers in three file-cluster batches:
  - auth/onboarding: `AuthContext.tsx`, `onboarding.tsx`
  - notification/settings: `NotificationContext.tsx`, `settings.tsx`
  - inbox/conversation shell: `index.tsx`, `conversation/[id].tsx`
- After the pattern is stable, migrate any new parity-driven mobile flows through the same wrapper layer instead of adding fresh direct hook usage.
- Keep new mobile code from introducing more direct generated Convex hook usage in screens or contexts once wrapper coverage exists for a domain.

### Wrapper design rules

- Wrapper hooks expose explicit mobile-local argument and return types instead of leaking generated inferred types into screen files.
- Gating and skip/enabled logic should live in wrapper APIs where practical so screens do not repeatedly reconstruct inline transport conditions.
- Wrapper ownership must remain distinct from shared cross-surface domain logic ownership.
- Any unavoidable cast or `@ts-expect-error` should live in the smallest practical adapter or wrapper boundary.

### Testing approach

- Add or update focused tests around migrated mobile flows where wrapper logic centralizes gating or derived data.
- Preserve existing navigation and parity expectations for inbox/onboarding/settings flows.
- Use targeted mobile verification and typecheck during migration.

## Risks and Mitigations

- Risk: mobile screen logic and shared onboarding domain logic become conflated.
  - Mitigation: keep wrapper hooks mobile-local and treat shared domain logic as an input, not the home for screen transport concerns.
- Risk: wrapper extraction changes mobile navigation timing or loading semantics.
  - Mitigation: preserve existing gating and route behavior; verify with focused flow checks.
- Risk: the mobile wrapper layer drifts from web patterns unnecessarily.
  - Mitigation: align naming and high-level conventions with web where useful, but keep runtime-specific implementation local.

## Rollout Notes

- Establish mobile-local wrapper foundations first.
- Keep `app/_layout.tsx` as the provider/runtime boundary and move all other remaining direct usage behind wrappers.
- Migrate auth/workspace, onboarding, inbox/conversation, settings, and notification domains next.
- Treat additional parity-driven mobile surfaces as incremental follow-on migrations.
