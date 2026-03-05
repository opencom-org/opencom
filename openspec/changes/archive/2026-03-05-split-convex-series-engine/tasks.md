## 1. Module Boundary Setup

- [x] 1.1 Define target module layout for series authoring, runtime, scheduler, and telemetry responsibilities.
- [x] 1.2 Add typed shared contracts used by cross-module runtime and scheduler flows.

## 2. Incremental Extraction

- [x] 2.1 Extract pure helpers and authoring handlers into dedicated modules while preserving export signatures.
- [x] 2.2 Extract telemetry updates into a dedicated module and wire through facade exports.
- [x] 2.3 Extract runtime progression and scheduler integration behind typed adapters.

## 3. Parity Validation

- [x] 3.1 Add tests covering retries, wait/resume transitions, and terminal state progression parity.
- [x] 3.2 Run targeted Convex typecheck/tests for series and event integration paths.

## 4. Cleanup

- [x] 4.1 Remove obsolete monolith branches from `series.ts` after module migration.
- [x] 4.2 Document module ownership and extension points for future series changes.
