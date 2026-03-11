## ADDED Requirements

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
