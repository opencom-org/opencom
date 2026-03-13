## Why

`apps/widget/src/SurveyOverlay.tsx` (~720 lines) combines survey domain types, answer normalization, container layout variants, and all question renderer variants in one file.

This limits maintainability and increases risk when changing one survey question type or container flow.

## What Changes

- Extract survey overlay domain types and answer normalization helpers.
- Extract container wrappers and question renderers into dedicated modules.
- Keep `SurveyOverlay` as the orchestration boundary with unchanged props/behavior.
- Preserve survey selector/classname behavior.

## Capabilities

### New Capabilities

- `widget-survey-overlay-modularity`: Survey overlay concerns are separated into domain helpers and render modules.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/widget/src/SurveyOverlay.tsx`
  - new modules under `apps/widget/src/surveyOverlay/`
- APIs:
  - No public prop contract changes.
- Dependencies:
  - No new external dependencies.
