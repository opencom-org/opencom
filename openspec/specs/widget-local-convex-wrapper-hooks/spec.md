# widget-local-convex-wrapper-hooks Specification

## Purpose
TBD - created by archiving change introduce-widget-local-convex-wrapper-hooks. Update Purpose after archive.
## Requirements
### Requirement: Widget runtime and UI modules MUST consume widget-local Convex wrapper hooks for covered domains
The widget MUST provide widget-local wrapper hooks for covered Convex-backed domains so runtime, overlay, and UI modules do not directly depend on generated Convex hook refs once wrapper coverage exists for that domain.

#### Scenario: Covered widget conversation flow uses local wrapper hooks
- **GIVEN** the widget conversation flow domain has adopted the local wrapper-hook pattern
- **WHEN** a widget module reads or mutates covered conversation/session data
- **THEN** it uses widget-local wrapper hooks owned by `apps/widget`
- **AND** the module does not call generated Convex `useQuery`, `useMutation`, or related refs directly for those covered operations

### Requirement: Widget wrapper hooks MUST preserve runtime behavior and server contract semantics
Widget wrapper hooks MUST preserve the underlying Convex function targets, payload semantics, gating behavior, and visitor-visible outcomes of the widget flows they encapsulate.

#### Scenario: Wrapped widget mutation preserves existing behavior
- **GIVEN** a widget interaction that previously invoked a specific Convex mutation or action
- **WHEN** that interaction is migrated behind a widget-local wrapper hook
- **THEN** the wrapper invokes the same underlying Convex target with equivalent behavior
- **AND** the visitor-visible widget flow remains functionally equivalent

### Requirement: Type-system escape hatches MUST be centralized outside widget runtime/UI modules
Any unavoidable cast or `@ts-expect-error` required because of generated Convex type complexity MUST live in the smallest practical widget adapter or wrapper boundary rather than being repeated across runtime and overlay modules.

#### Scenario: Generated widget hook requires a type escape hatch
- **GIVEN** a generated Convex hook call exceeds TypeScript complexity limits in widget code
- **WHEN** the operation is wrapped behind the widget-local typed wrapper layer
- **THEN** the escape hatch is contained in the adapter or wrapper layer
- **AND** consuming runtime/UI modules remain free of repeated inline suppression comments for that covered operation

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

