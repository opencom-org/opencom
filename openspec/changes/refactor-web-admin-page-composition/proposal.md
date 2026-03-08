## Why

Several web admin routes concentrate unrelated domain logic, mutation orchestration, and UI composition into large page files. This makes the code harder to reason about, increases regression risk when changing one section, and raises the contribution cost for new maintainers.

## What Changes

- Decompose high-complexity web admin routes into page-level composition plus dedicated local modules and hooks.
- Extract settings domain behavior from `apps/web/src/app/settings/page.tsx` into section-scoped modules that preserve existing permissions and mutation semantics.
- Extract ticket form authoring behavior from `apps/web/src/app/tickets/forms/page.tsx` into dedicated editor, list, and state-management modules.
- Align the decomposition approach with existing modular admin patterns used by other web editor surfaces.
- Preserve all existing user-visible behavior, routing, permissions, and mutation payload semantics.

## Capabilities

### New Capabilities
- `web-admin-page-composition-modularity`: Covers modular decomposition standards for large web admin routes that currently combine orchestration, domain logic, and rendering.

### Modified Capabilities
- `web-settings-domain-modularity`: Expand settings modularity coverage to additional settings domains currently still implemented in `settings/page.tsx`.

## Impact

- Affected code: `apps/web/src/app/settings/page.tsx`, `apps/web/src/app/tickets/forms/page.tsx`, adjacent local modules/hooks/tests.
- Affected contributors: web admin contributors working on settings, ticket forms, and future admin surfaces.
- Dependencies: no external dependency changes; internal module boundaries and tests will be reorganized.
