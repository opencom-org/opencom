## Why

The web app currently depends directly on `@opencom/sdk-core`, even though `sdk-core` also contains Convex-backed SDK API wrappers intended for client SDK runtimes. Because `sdk-core` exports source modules directly, unrelated Convex type issues inside SDK runtime wrappers can block `apps/web` typecheck and build verification.

## What Changes

- Remove direct `@opencom/sdk-core` imports from `apps/web`.
- Isolate selector-scoring and other web-safe shared utilities so web can consume them without traversing SDK runtime API wrappers.
- Narrow package boundaries so web builds are not blocked by native/client SDK implementation details.
- Preserve current web product behavior for tooltip and tour selector scoring.

## Capabilities

### New Capabilities
- `web-sdk-boundary-isolation`: Covers requirements for preventing `apps/web` from depending on SDK runtime wrapper modules while preserving access to web-safe shared selector utilities.

### Modified Capabilities
- `web-tour-editor-modularity`: Clarify that tour editor selector-quality logic must depend only on web-safe shared utilities, not SDK runtime client wrappers.

## Impact

- Affected code: `apps/web/package.json`, `apps/web/src/app/tooltips/page.tsx`, `apps/web/src/app/tours/[id]/tourEditorTypes.ts`, `packages/sdk-core/src/**`, and any new shared utility package or narrowed export surface.
- Affected systems: web build/typecheck dependency graph, shared package boundaries, and workspace package exports.
- Dependencies: `@opencom/sdk-core`, web-facing shared utilities, and monorepo package resolution behavior.
