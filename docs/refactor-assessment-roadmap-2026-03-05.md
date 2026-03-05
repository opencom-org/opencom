# Refactor Roadmap: Web + Widget + Convex (2026-03-05)

## Goals

1. Separate business logic from UI render layers.
2. Eliminate duplicate domain logic across frontends.
3. Standardize Convex auth/permission and public/private API patterns.

## Architecture Direction

- `@opencom/types`: canonical domain contracts and default configuration objects (no runtime/browser coupling).
- `@opencom/sdk-core`: pure shared runtime logic used across web/widget/mobile/RN.
- `packages/web-shared` (new): DOM-dependent shared logic for web + widget only (markdown/sanitization, browser notification cue helpers).

## Cross-App Compatibility Constraints

The roadmap itself does not change after reviewing `apps/mobile`, `packages/sdk-core`, and `packages/react-native-sdk`. Execution needs these hard constraints:

1. Preserve public SDK contracts.
   - Keep `@opencom/react-native-sdk` and `@opencom/sdk-core` exported types/hooks/API signatures stable while internals are refactored.
2. Preserve Convex visitor-path compatibility.
   - Do not break function references used by sdk-core/RN visitor paths without compatibility aliases and migration sequencing.
3. Keep platform security semantics explicit.
   - Backend discovery URL handling (`@opencom/types`) and sdk-core Convex URL validation are related but not identical; centralize shared pieces without flattening behavior.
4. Prefer extraction by surface responsibility.
   - Pure contracts in `@opencom/types`, runtime-only logic in `@opencom/sdk-core`, DOM utilities in `packages/web-shared`.

## Phase Plan

### Phase 0: Guardrails (1-2 days)

- Add a lightweight architecture note documenting source-of-truth ownership for:
  - messenger settings/home config contracts
  - audience rule contracts
  - visitor readable ID generation
- Add compatibility guardrails for external/mobile surfaces:
  - lock critical sdk-core + RN SDK contract tests (Convex function refs and argument shapes)
  - define “no API break” checklist for exported RN SDK hooks/types
  - map work items to active OpenSpec changes for RN/mobile to avoid duplicate tracks
- Add focused regression tests before moving logic:
  - markdown/sanitization behavior parity tests
  - home config normalization behavior
  - visitor readable ID deterministic output snapshots

### Phase 1: Shared Contract Extraction (3-5 days)

- Move duplicated contracts/defaults into shared packages:
  - Messenger settings + home config types/defaults/normalizers
  - Audience rule types shared between builder/backend
  - Visitor readable ID generator
- During extraction:
  - keep RN SDK return shapes and default behavior unchanged
  - align mobile/web backend normalization on shared utilities (remove ad-hoc trailing-slash normalization paths)
- Refactor consumers:
  - `packages/convex/convex/messengerSettings.ts`
  - `apps/web/src/app/settings/HomeSettingsSection.tsx`
  - `apps/widget/src/components/Home.tsx`
  - `packages/react-native-sdk/src/components/OpencomHome.tsx`
  - `apps/web/src/lib/visitorIdentity.ts`
  - `packages/convex/convex/visitorReadableId.ts`

### Phase 2: UI Decomposition (5-8 days)

#### 2A. Web Inbox

- Introduce controller hooks:
  - `useInboxData` (queries/mutations/actions)
  - `useInboxRouteSync` (URL <-> selected conversation)
  - `useInboxAttentionCues` (snapshot + sound + browser notifications)
- Move large panes into focused components:
  - conversation list pane
  - thread pane
  - side panels (AI review/suggestions/knowledge)

#### 2B. Widget Shell

- Introduce `useWidgetShellController` that composes existing hooks and data fetches.
- Move feature slices out of `Widget.tsx`:
  - tickets controller
  - home/help controller
  - survey/outbound/tour orchestration controller
- Keep `Widget.tsx` mostly as layout + routing glue.

#### 2C. Settings Surface

- Extract per-domain hooks from `apps/web/src/app/settings/page.tsx`:
  - workspace membership/invitations
  - signup/auth-mode policy
  - email channel settings

### Phase 3: Convex Consistency Pass (4-6 days)

- Standardize on auth wrappers where possible; for exceptions, document why.
- Extract repeated workspace-permission/resource-fetch logic into reusable helpers.
- Normalize endpoint naming:
  - use `getPublic*` for unauthenticated/public queries
  - reserve plain `get/list/update/...` for auth-gated admin paths
- Add compatibility aliases before removals/renames for currently consumed paths:
  - `automationSettings.get` / `automationSettings.getOrCreate`
  - existing visitor-facing queries used by widget/RN hooks
- Start with highest repetition modules:
  - `workspaces.ts`, `workspaceMembers.ts`, `identityVerification.ts`, `segments.ts`, `assignmentRules.ts`, `commonIssueButtons.ts`

### Phase 4: Cleanup + Adoption (2-3 days)

- Remove or adopt dead/partial abstractions:
  - `apps/widget/src/components/WidgetContext.tsx`
  - `apps/web/src/components/TriggerConfigEditor.tsx`
  - `apps/web/src/components/CollapsibleSection.tsx`
  - unused Convex validation helpers not in active use
- Ensure docs reflect final source-of-truth package boundaries.

## Suggested Sequencing (Lowest Risk First)

1. Shared pure contracts/defaults (low runtime risk, high drift reduction).
2. Web/widget DOM-shared utility extraction (markdown + cues).
3. UI decomposition in `web/inbox` and `widget/Widget`.
4. Convex wrapper and API naming normalization.
5. Dead code cleanup.

## Exit Criteria

- No duplicated messenger/home/audience/visitor-ID contract definitions across web/widget/convex/RN.
- `web/inbox` and `widget/Widget` reduced to orchestrators with domain hooks and smaller render components.
- Convex modules in target set follow one documented auth/public pattern.
- Shared behavior covered by tests in source-of-truth packages.
- Mobile + SDK safeguards in place:
  - `apps/mobile` typecheck passes for backend/workspace flows after shared utility moves.
  - `@opencom/sdk-core` contract tests pass without Convex visitor-path regressions.
  - `@opencom/react-native-sdk` tests/typecheck pass with unchanged public API behavior.
