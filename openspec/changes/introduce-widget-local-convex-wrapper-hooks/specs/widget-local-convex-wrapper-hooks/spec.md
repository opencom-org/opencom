## ADDED Requirements

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
