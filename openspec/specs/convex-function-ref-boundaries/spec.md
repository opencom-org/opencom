# convex-function-ref-boundaries Specification

## Purpose
TBD - created by archiving change stabilize-convex-function-ref-boundaries. Update Purpose after archive.
## Requirements
### Requirement: Covered backend dynamic Convex calls MUST use explicit typed boundaries

Covered backend modules SHALL route dynamic Convex invocations through explicit typed adapter functions or fixed typed function refs instead of generic string-based ref factories inside feature logic.

#### Scenario: Covered backend module invokes an internal function dynamically

- **GIVEN** a covered Convex module needs `runQuery`, `runAction`, `runMutation`, or `scheduler.runAfter` to invoke another Convex function
- **WHEN** that dynamic boundary is hardened for type safety
- **THEN** the module uses a typed adapter boundary or fixed typed ref for the specific target function
- **AND** feature logic does not rely on an arbitrary `name: string` helper to select the function at runtime

### Requirement: Covered app surfaces MUST isolate Convex escape hatches behind local wrappers

Covered web and widget domains SHALL isolate unavoidable Convex type-system escape hatches behind local wrapper layers or feature-local typed ref modules rather than repeating them in UI or runtime files.

#### Scenario: Covered web or widget domain avoids page-level ref recreation

- **GIVEN** a web or widget domain has adopted the approved local wrapper pattern
- **WHEN** a page, component, runtime hook, or overlay module performs a covered Convex query, mutation, or action
- **THEN** the module consumes an app-local wrapper or feature-local typed ref owned by that surface
- **AND** the module does not declare its own ad hoc `makeFunctionReference<..., any, ...>` or bare `FunctionReference` cast for the covered operation

### Requirement: Ref-boundary migrations MUST be validated incrementally

Convex ref-boundary migrations SHALL expand only after the current migration slice passes the package-level typecheck and targeted tests relevant to the touched surface.

#### Scenario: Team completes a pilot migration slice

- **GIVEN** a pilot or follow-on migration slice changes backend, web, or widget Convex ref boundaries
- **WHEN** the team decides whether to expand the pattern to additional modules
- **THEN** the current slice has already passed the relevant package typecheck command
- **AND** targeted tests for the touched domain have been run before broader migration continues

### Requirement: Test ref-name helpers MUST use supported Convex APIs

Shared test utilities that compare or route on Convex function refs SHALL use supported Convex function-name extraction APIs rather than private object-shape inspection.

#### Scenario: Test code needs to identify a Convex function ref

- **GIVEN** a test helper receives a Convex function ref or a string mock
- **WHEN** the helper resolves the function name for assertions or mock routing
- **THEN** it uses a supported Convex helper such as `getFunctionName(...)` for real refs
- **AND** it does not depend on private symbol names or object field probing as the primary mechanism

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

