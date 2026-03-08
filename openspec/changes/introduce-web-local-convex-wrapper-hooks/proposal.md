## Why

The web app currently performs many direct `useQuery`, `useMutation`, and `useAction` calls against generated Convex API refs inside page and component files. As the generated type graph has grown, some of these call sites now require `@ts-expect-error` suppressions for TypeScript instantiation depth limits. This makes UI code harder to read, spreads fragile type workarounds across feature code, and increases the risk that future refactors will mix transport concerns with rendering and state orchestration.

## What Changes

- Introduce a web-local typed Convex wrapper hook layer that centralizes generated API ref interaction behind app-owned hooks.
- Add thin typed adapter primitives, where needed, so unavoidable casts or suppressions live in one constrained layer instead of across page files.
- Provide domain-scoped wrapper hooks for high-churn web admin areas first, starting with settings/security, outbound authoring, and tours/editor flows.
- Allow large route/controller hooks to compose domain wrappers for page orchestration, while keeping UI files free of direct generated Convex hook calls where practical.
- Preserve all existing Convex query/mutation/action targets, payload semantics, permissions, routing, and user-visible behavior.

## Capabilities

### New Capabilities
- `web-local-convex-wrapper-hooks`: Covers app-local typed wrapper hooks that isolate generated Convex hook complexity from web UI modules.

### Modified Capabilities
- `web-admin-page-composition-modularity`: Clarify that page decomposition may depend on a dedicated wrapper-hook layer rather than embedding Convex hook details directly in UI modules.
- `web-admin-action-flow-standardization`: Clarify that async action standardization composes with wrapper hooks but does not own data-access typing boundaries.

## Impact

- Affected code: `apps/web/src/app/**`, `apps/web/src/components/**`, new wrapper layers under `apps/web/src/lib` and/or `apps/web/src/hooks`, and targeted tests for migrated domains.
- Affected contributors: web contributors working on settings, editor surfaces, reports, inbox, and other Convex-backed admin routes.
- Dependencies: no external package changes; internal web hook boundaries and local typing conventions will be introduced.
