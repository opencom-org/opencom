## ADDED Requirements

### Requirement: Survey editor page MUST compose domain modules instead of co-locating all tab logic

The survey editor implementation SHALL separate tab UI and editor-domain logic into dedicated modules so feature changes do not require editing one monolithic page file.

#### Scenario: Updating question builder behavior

- **WHEN** a contributor changes question create/update/reorder logic
- **THEN** the change SHALL be made in survey editor domain modules
- **AND** tab shell composition in `page.tsx` SHALL not require unrelated updates

### Requirement: Survey editor extraction MUST preserve existing save/status/export behavior

Refactoring SHALL preserve existing mutation targets, payload semantics, and error handling behavior for save, activate/pause, and CSV export actions.

#### Scenario: Agent saves survey changes

- **WHEN** an agent updates survey fields and triggers save
- **THEN** the same survey update mutation SHALL be invoked with equivalent payload semantics
- **AND** success/error behavior SHALL remain functionally equivalent
