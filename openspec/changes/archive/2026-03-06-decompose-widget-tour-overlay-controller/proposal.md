## Why

`apps/widget/src/TourOverlay.tsx` is a large controller (~1400 lines) that mixes business rules (route matching, advance guidance, skip/advance recovery), DOM positioning math, and JSX rendering variants in one file.

This increases change risk and makes behavior-preserving updates harder across widget, web embedding flows, and mobile/sdk consumers that rely on stable tour behavior.

## What Changes

- Extract tour domain types and pure helper logic into dedicated `tourOverlay` modules.
- Extract overlay render sections into dedicated presentational components.
- Keep `TourOverlay` as the stable exported controller entrypoint with unchanged props and mutation behavior.
- Preserve test selectors and interaction semantics used by widget and embedding tests.

## Capabilities

### New Capabilities

- `widget-tour-overlay-modularity`: Tour overlay logic is organized by domain helpers + presentational sections, with a thin controller composition layer.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/widget/src/TourOverlay.tsx`
  - new modules under `apps/widget/src/tourOverlay/`
- APIs:
  - No public prop or endpoint contract changes.
- Dependencies:
  - No new external dependencies.
