## ADDED Requirements

### Requirement: Remaining covered widget runtime and shell modules MUST adopt local wrapper hooks
The system MUST route covered widget shell, session, tracking, overlay, and tour-support Convex operations through widget-local wrapper hooks or feature-local typed ref helpers instead of runtime-level direct `convex/react` usage.

#### Scenario: Covered widget runtime module performs a Convex operation
- **WHEN** a covered widget shell, session, overlay, tracking, or tour-support module needs Convex data or mutations
- **THEN** it consumes a widget-local wrapper hook or feature-local typed ref helper
- **AND** the runtime module does not declare direct `useQuery`, `useMutation`, or `useAction` imports for those covered operations

### Requirement: Widget direct Convex hook imports MUST remain limited to infrastructure boundaries
The system MUST limit direct `convex/react` imports in `apps/widget` to explicit adapter, bootstrap, or targeted test boundaries once the remaining wrapper coverage is in place.

#### Scenario: Widget feature module imports Convex hooks after wrapper expansion
- **WHEN** a widget source file outside the approved adapter, bootstrap, or targeted test boundaries imports `convex/react`
- **THEN** hardening guard verification treats it as a regression
- **AND** the module must migrate to widget-local wrapper or feature-local helper composition instead

### Requirement: Widget adapter escape hatches MUST remain explicit and localized
The system MUST keep any widget-specific Convex hook typing escape hatches confined to `apps/widget/src/lib/convex/hooks.ts`, and the adapter MUST use the narrowest practical helper or cast shape instead of broad runtime-facing boundaries.

#### Scenario: Widget adapter still needs a type escape hatch
- **WHEN** `apps/widget/src/lib/convex/hooks.ts` cannot satisfy `convex/react` hook signatures directly for a widget-local wrapper
- **THEN** the adapter uses the smallest practical helper signature or cast within that file
- **AND** covered widget runtime, shell, session, overlay, and tracking modules do not reintroduce equivalent Convex hook cast boundaries
- **AND** widget hardening verification keeps the residual adapter boundary explicit
