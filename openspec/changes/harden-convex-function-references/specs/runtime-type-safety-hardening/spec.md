## ADDED Requirements

### Requirement: RAG-critical runtime boundaries MUST minimize residual ref and runner casts

The system MUST keep RAG-critical AI retrieval and embedding runtime files on fixed typed refs or shared typed ref modules, with any remaining runner cast localized to one named helper per boundary.

#### Scenario: RAG runtime file invokes another Convex function

- **WHEN** a covered AI retrieval or embedding runtime file calls an internal or public Convex query, mutation, or action
- **THEN** the file SHALL use a fixed typed ref or a shared typed ref module for the target function
- **AND** any remaining `ctx.runQuery`, `ctx.runMutation`, or `ctx.runAction` workaround SHALL live in a named helper rather than repeated inline double casts

### Requirement: Runtime hardening guardrails MUST track covered backend hotspot inventory changes

The system MUST update runtime hardening guardrails in the same change that adds, removes, or narrows a covered backend hotspot or accepted exception.

#### Scenario: Backend hotspot inventory changes

- **WHEN** a hardening change moves a file into or out of the covered backend hotspot inventory
- **THEN** the runtime guard test SHALL be updated in the same change
- **AND** the guard SHALL distinguish approved exceptions from regressions in uncovered files
