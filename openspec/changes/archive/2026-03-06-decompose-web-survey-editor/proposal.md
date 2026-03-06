## Why

`apps/web/src/app/surveys/[id]/page.tsx` concentrates survey state, mutation orchestration, and all tab UIs in one large module. This slows feature changes and increases regression risk in survey authoring flows.

## What Changes

- Extract survey-editor domain state/update helpers into dedicated modules/hooks.
- Extract tab-level UIs (builder, targeting, settings, analytics) into focused components.
- Keep `page.tsx` as orchestration + tab composition.
- Preserve existing behavior for save/status toggles, trigger/frequency/scheduling rules, and CSV export.

## Capabilities

### New Capabilities

- `web-survey-editor-modularity`: Survey editor behavior is implemented through explicit domain modules and section components with stable contracts.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/web/src/app/surveys/[id]/page.tsx`
  - new survey editor modules under `apps/web/src/app/surveys/[id]/`
- APIs:
  - No Convex API shape changes.
- Dependencies:
  - No new external dependencies.
