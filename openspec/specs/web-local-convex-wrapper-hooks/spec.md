# web-local-convex-wrapper-hooks Specification

## Purpose
TBD - created by archiving change introduce-web-local-convex-wrapper-hooks. Update Purpose after archive.
## Requirements
### Requirement: Web UI modules MUST consume app-local Convex wrapper hooks for covered domains

The web app MUST provide app-local wrapper hooks for covered Convex-backed domains so page and component files do not need to directly depend on generated Convex hook refs once wrapper coverage exists for that domain.

#### Scenario: Covered settings/security UI uses local wrapper hooks

- **GIVEN** the settings/security domain has adopted the local wrapper-hook pattern
- **WHEN** a settings UI module reads audit log access, widget session settings, identity verification settings, or workspace member mutations
- **THEN** it uses app-local wrapper hooks owned by `apps/web`
- **AND** the UI module does not call generated Convex `useQuery`, `useMutation`, or `useAction` refs directly for those covered operations

### Requirement: Wrapper hooks MUST preserve server contract semantics

Wrapper hooks MUST preserve the underlying Convex function targets, permission behavior, skip/enabled gating semantics, and payload/result meanings of the operations they encapsulate.

#### Scenario: Wrapped mutation preserves existing payload contract

- **GIVEN** a web mutation flow that previously called a specific Convex mutation with a defined payload
- **WHEN** the flow is migrated to a local wrapper hook
- **THEN** the wrapper invokes the same underlying Convex mutation target
- **AND** it preserves the same payload semantics and observable user-visible outcomes

### Requirement: Type-system escape hatches MUST be centralized outside UI files

Any unavoidable cast or `@ts-expect-error` required because of generated Convex type complexity MUST live in the smallest practical adapter or wrapper boundary rather than being repeated across page and component files.

#### Scenario: Generated API ref requires a type instantiation escape hatch

- **GIVEN** a generated Convex hook call exceeds TypeScript instantiation depth in the web app
- **WHEN** the operation is wrapped behind the local typed wrapper-hook layer
- **THEN** the escape hatch is contained in the adapter or domain wrapper layer
- **AND** consuming UI files remain free of repeated inline suppression comments for that covered operation

### Requirement: Large web admin routes MUST support controller-hook composition when orchestration is complex

Large web routes with multiple related Convex operations MUST support route-local controller/composition hooks that combine domain wrappers when that reduces page complexity without changing behavior.

#### Scenario: Editor route composes multiple wrapped operations

- **GIVEN** a route such as an outbound or tour editor that needs several related queries and mutations
- **WHEN** the route adopts the local wrapper-hook pattern
- **THEN** the route may use a controller hook to compose multiple domain wrappers
- **AND** the route file remains focused on layout, composition, and local UI state
- **AND** the controller preserves current routing, permission, and mutation behavior

### Requirement: Remaining covered web routes, contexts, and shared components MUST adopt local wrapper hooks
The system MUST route covered web admin, reporting, onboarding, visitor, and shared-component Convex operations through app-local wrapper hooks or controller hooks instead of feature-level direct `convex/react` usage.

#### Scenario: Covered web module loads Convex-backed data
- **WHEN** a covered tours, surveys, tickets, reports, visitors, settings, help, onboarding, snippets, segments, or shared-component module needs Convex data or mutations
- **THEN** it consumes app-local wrapper hooks or a controller hook composed from them
- **AND** the feature module does not declare direct `useQuery`, `useMutation`, or `useAction` imports for those covered operations

### Requirement: Web direct Convex hook imports MUST remain limited to infrastructure boundaries
The system MUST limit direct `convex/react` imports in `apps/web` to explicit provider, local adapter, or targeted test boundaries once the remaining wrapper coverage is in place.

#### Scenario: Feature module imports Convex hooks after wrapper expansion
- **WHEN** a web source file outside the approved provider, adapter, or targeted test boundaries imports `convex/react`
- **THEN** hardening guard verification treats it as a regression
- **AND** the module must migrate to local wrapper or controller composition instead

