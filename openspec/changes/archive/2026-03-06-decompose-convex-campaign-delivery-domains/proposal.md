## Why

`packages/convex/convex/carousels.ts` and `packages/convex/convex/surveys.ts` are both monolithic campaign-delivery domain files (~1000 lines each) that combine authoring, delivery, analytics, and triggering logic.

## What Changes

- Split `carousels` into dedicated modules for shared helpers, authoring, delivery/tracking, and triggering.
- Split `surveys` into dedicated modules for shared helpers, authoring, responses/export, and delivery/analytics.
- Keep `carousels.ts` and `surveys.ts` as stable re-export entrypoints.
- Preserve endpoint names, args, and behavior.

## Capabilities

### New Capabilities

- `convex-campaign-delivery-modularity`: Carousel and survey campaign-delivery logic are organized into dedicated modules with shared helpers.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/convex/convex/carousels.ts`
  - `packages/convex/convex/surveys.ts`
  - new modules under `packages/convex/convex/carousels/` and `packages/convex/convex/surveys/`
- APIs:
  - No endpoint name/signature changes.
- Dependencies:
  - No new external dependencies.
