## ADDED Requirements

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
