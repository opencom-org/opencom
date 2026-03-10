## ADDED Requirements

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
