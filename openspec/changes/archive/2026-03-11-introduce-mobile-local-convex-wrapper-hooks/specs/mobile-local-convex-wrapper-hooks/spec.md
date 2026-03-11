## ADDED Requirements

### Requirement: Mobile screens and contexts MUST consume mobile-local Convex wrapper hooks for covered domains
The mobile app MUST provide mobile-local wrapper hooks for covered Convex-backed domains so screens and context modules do not directly depend on generated Convex hook refs once wrapper coverage exists for that domain.

#### Scenario: Covered mobile onboarding or inbox flow uses local wrapper hooks
- **GIVEN** a mobile onboarding, workspace-selection, inbox, or conversation domain has adopted the local wrapper-hook pattern
- **WHEN** a covered mobile screen or context reads or mutates Convex-backed state for that domain
- **THEN** it uses mobile-local wrapper hooks owned by `apps/mobile`
- **AND** it does not call generated Convex `useQuery`, `useMutation`, or `useAction` refs directly for those covered operations

### Requirement: Mobile wrapper hooks MUST preserve screen behavior and server contract semantics
Mobile wrapper hooks MUST preserve the underlying Convex function targets, payload semantics, gating behavior, and user-visible outcomes of the mobile flows they encapsulate.

#### Scenario: Wrapped mobile flow preserves existing payload and behavior
- **GIVEN** a mobile flow that previously invoked a specific Convex operation with defined semantics
- **WHEN** that flow is migrated behind a mobile-local wrapper hook
- **THEN** the wrapper invokes the same underlying Convex target with equivalent semantics
- **AND** the mobile user-visible flow remains functionally equivalent

### Requirement: Type-system escape hatches MUST be centralized outside mobile screens and contexts
Any unavoidable cast or `@ts-expect-error` required because of generated Convex type complexity MUST live in the smallest practical mobile adapter or wrapper boundary rather than being repeated across screens and context modules.

#### Scenario: Generated mobile hook requires a type escape hatch
- **GIVEN** a generated Convex hook call exceeds TypeScript complexity limits in mobile code
- **WHEN** the operation is wrapped behind the mobile-local typed wrapper layer
- **THEN** the escape hatch is contained in the adapter or wrapper layer
- **AND** consuming mobile screens and contexts remain free of repeated inline suppression comments for that covered operation
