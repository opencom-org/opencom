## ADDED Requirements

### Requirement: Residual backend hotspots MUST prefer fixed refs over broad object-cast selectors
The system MUST implement covered backend hardening hotspots with explicit fixed function refs or narrow local ref helpers instead of broad `unsafeApi` / `unsafeInternal` object casts that expose multiple unrelated targets at once.

#### Scenario: Covered hotspot invokes multiple Convex functions
- **WHEN** a covered backend module needs several internal or public Convex function refs
- **THEN** it resolves each target through fixed named refs or a dedicated local ref helper
- **AND** feature logic does not depend on a wide object-cast view of `anyApi` to pick the function

### Requirement: Residual backend `TS2589` workarounds MUST stay enumerated and guard-railed
The system MUST keep remaining backend `TS2589` workarounds explicitly inventoried and protected by guard tests so new broad escape hatches do not spread beyond approved hotspots.

#### Scenario: New backend escape hatch is introduced
- **WHEN** a new `unsafeApi`, `unsafeInternal`, or equivalent broad ref-cast pattern is added outside the approved hotspot inventory
- **THEN** guard verification fails or the inventory must be deliberately updated as part of the change
- **AND** the team can distinguish accepted local exceptions from accidental regression

### Requirement: Covered backend hotspots MUST keep shallow runner casts smaller than feature logic
The system MUST keep any remaining shallow `ctx.runQuery`, `ctx.runMutation`, or `ctx.runAction` cast boundary smaller than the feature logic it supports.

#### Scenario: Covered hotspot still needs a shallow runner helper
- **WHEN** a covered backend module still requires a shallow runner cast to avoid deep type expansion
- **THEN** the cast lives in a named local helper or similarly narrow boundary
- **AND** the surrounding feature logic does not recreate anonymous runner casts for each call
