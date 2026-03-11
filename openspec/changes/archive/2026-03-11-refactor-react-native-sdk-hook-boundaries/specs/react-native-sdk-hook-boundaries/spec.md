## ADDED Requirements

### Requirement: React Native SDK public hooks MUST depend on explicit internal transport boundaries
The React Native SDK MUST define internal boundaries for generated Convex hook access, visitor/session/config resolution, and gating behavior so exported hooks do not each inline those concerns independently.

#### Scenario: Public SDK conversation hook uses internal transport helpers
- **GIVEN** an exported SDK hook for a covered domain such as conversations or tickets
- **WHEN** that hook reads or mutates Convex-backed state
- **THEN** it uses explicit internal SDK transport or adapter helpers for generated hook interaction and visitor/session/config resolution
- **AND** the exported hook remains focused on public SDK ergonomics

### Requirement: SDK refactors MUST preserve public hook and component compatibility
Internal SDK hook-boundary refactors MUST preserve the observable behavior and semantics of the exported hooks and components they reorganize.

#### Scenario: Refactored SDK ticket hook preserves public behavior
- **GIVEN** a consuming app using an exported SDK ticket hook
- **WHEN** the SDK internally refactors the hook behind clearer transport boundaries
- **THEN** the public hook continues to provide equivalent behavior and semantics for that consuming app

### Requirement: Generated-type escape hatches MUST be centralized in internal SDK boundaries
Any unavoidable cast or type-system escape hatch required because of generated Convex hook complexity MUST live in the smallest practical internal SDK helper or adapter boundary rather than being repeated across exported hooks and components.

#### Scenario: Generated SDK hook requires a type escape hatch
- **GIVEN** a generated Convex hook call exceeds TypeScript complexity limits inside the SDK
- **WHEN** the operation is organized behind the internal SDK transport boundary
- **THEN** the escape hatch is contained in that internal boundary
- **AND** exported hooks and components remain free of repeated inline suppression comments for that covered operation
