## Overview

This change introduces a widget-local wrapper hook layer so generated Convex hook refs are not consumed directly throughout widget runtime and overlay code. The main goal is to keep runtime-state, view transitions, authoring overlays, and visitor-facing UI focused on widget behavior while explicit widget-owned wrapper modules handle generated API refs, gating, and stable local types.

## Goals

- Reduce direct generated Convex hook usage in central widget runtime and overlay modules.
- Keep type-system escape hatches out of high-risk widget runtime controllers.
- Support the ongoing widget runtime-state boundary refactor with a dedicated data-access boundary rather than mixing the two concerns.
- Preserve existing widget runtime behavior, capability gating, visitor-visible UX, and embedding contracts.
- Establish a repeatable pattern for future widget features that need Convex-backed data access.

## Non-Goals

- Redesigning widget UX, routing, or overlay behavior.
- Replacing the widget runtime-state refactor with a broad data layer abstraction.
- Moving widget data-access logic into shared cross-surface packages unless a later change explicitly justifies that move.
- Changing backend contracts or generated API output.

## Architecture

### Layered widget data-access model

- Add a minimal widget-local adapter layer under `apps/widget/src/lib/convex/` or an equivalent local path for narrow typed primitives.
- Add explicit domain wrapper hooks under `apps/widget/src/hooks/convex/` or feature-local hook folders for widget domains such as session/bootstrap, conversations, tours, surveys, outbound, help/home content, and authoring overlays.
- Allow runtime/controller hooks to compose domain wrappers while preserving clear separation from navigation/view-state ownership.

### Domain-first migration

- Prioritize the current remaining runtime hotspots first: `components/ConversationView.tsx` and `tourOverlay/useTourOverlayActions.ts`.
- Follow with any additional shell or overlay modules only after those hotspots establish the wrapper pattern.
- Keep new widget code from introducing more direct generated Convex hook usage in runtime/UI modules once wrapper coverage exists for a domain.

### Wrapper design rules

- Wrapper hooks expose explicit widget-local types instead of leaking complex generated inferred types into runtime code.
- Gating and skip/enabled behavior should live in wrapper APIs where practical so widget modules do not repeatedly construct inline transport conditions.
- Controller hooks may compose wrappers, but wrapper ownership must remain distinct from runtime-state ownership.
- Any unavoidable cast or `@ts-expect-error` should live in the smallest practical adapter or wrapper boundary.

### Testing approach

- Add or update focused tests around wrapped widget flows where gating, normalization, or derived result shapes are centralized.
- Preserve behavior coverage for shell/runtime and overlay flows during migration.
- Use targeted widget and web-embedding verification alongside typecheck for touched areas.

## Risks and Mitigations

- Risk: runtime-state and data-access refactors blur together.
  - Mitigation: treat wrapper hooks as a separate layer consumed by runtime modules, not a replacement for runtime-state boundaries.
- Risk: widget-specific transport/gating behavior changes during extraction.
  - Mitigation: preserve existing API refs, payloads, and visitor-visible outcomes; add focused behavior checks around migrated flows.
- Risk: wrapper APIs become too broad for heterogeneous widget features.
  - Mitigation: prefer explicit domain wrappers over a single generic factory.

## Rollout Notes

- Establish widget-local wrapper foundations first.
- Migrate `ConversationView` first, then the tour overlay action boundary.
- Keep shared widget test-helper cleanup coordinated under the cross-surface guardrail change rather than broadening this change's runtime scope.
