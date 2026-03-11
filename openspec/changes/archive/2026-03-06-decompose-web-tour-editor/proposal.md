## Why

`apps/web/src/app/tours/[id]/page.tsx` still combines page orchestration, step CRUD, selector-quality diagnostics, settings editing, and modal rendering in one large file. This increases regression risk for tour authoring changes and makes the editor harder to review or extend safely.

## What Changes

- Extract shared tour-editor types and helper logic from `page.tsx` into dedicated local modules.
- Extract the tour steps list/actions panel into a dedicated component.
- Extract the tour settings panel into a dedicated component.
- Extract the step create/edit modal into a dedicated component.
- Keep page-level query/mutation orchestration and top-level composition in `page.tsx`.
- Preserve existing behavior for step CRUD, selector warnings, route consistency guidance, authoring-session launch, and tour activation/save flows.

## Capabilities

### New Capabilities
- `web-tour-editor-modularity`: Tour editor render and local editing concerns are implemented through dedicated section modules.

### Modified Capabilities

## Impact

- Affected code:
  - `apps/web/src/app/tours/[id]/page.tsx`
  - new local tour editor modules under `apps/web/src/app/tours/[id]/`
- APIs:
  - No Convex API changes.
- Dependencies:
  - No new external dependencies.
