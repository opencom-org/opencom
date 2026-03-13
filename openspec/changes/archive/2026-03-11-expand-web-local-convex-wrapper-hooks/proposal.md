## Why

The archived `introduce-web-local-convex-wrapper-hooks` change hardened the first set of web hotspots, but a March 11, 2026 repo scan still found direct `convex/react` usage across remaining admin, reporting, onboarding, visitor, and shared-component surfaces. These are mostly consistency gaps rather than current typecheck blockers, but they still leave page and context files recreating Convex hook and ref details inline.

## What Changes

- Expand app-local wrapper and controller-hook coverage to the remaining direct-import web domains identified in the March 11, 2026 scan.
- Move direct `convex/react` imports and inline `makeFunctionReference(...)` declarations out of covered web routes, contexts, and shared components into `apps/web`-owned wrapper or controller layers.
- Extend web hardening guards so only the approved provider, adapter, and test boundaries keep direct Convex hook imports.
- Preserve existing route behavior, loading semantics, permission checks, and payload contracts while the coverage expands.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `web-local-convex-wrapper-hooks`: Expand the archived pilot coverage to the remaining direct-import web routes, contexts, and shared components discovered by the March 11, 2026 scan.

## Impact

- Affected code: remaining direct-import files under `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/contexts/**`, and the associated web hardening guard tests.
- Affected systems: web admin/reporting route composition, wrapper-hook boundaries, and local type-hardening guard verification.
- Dependencies: existing `apps/web/src/lib/convex/hooks.ts` adapter boundary and the archived wrapper-hook pattern already used in earlier web domains.
