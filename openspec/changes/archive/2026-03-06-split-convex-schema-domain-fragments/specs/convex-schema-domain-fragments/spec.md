## ADDED Requirements

### Requirement: Convex schema tables MUST be organized through domain fragment modules

The Convex schema SHALL define table declarations in dedicated domain fragment modules and compose them through `schema.ts`.

#### Scenario: Updating a help-center table validator

- **WHEN** a contributor updates help-center table validation rules
- **THEN** changes SHALL be made in help-center schema fragment modules
- **AND** unrelated domain fragments SHALL not require unrelated edits

### Requirement: Schema fragmentation MUST preserve table and index contracts

Fragment extraction SHALL preserve all table names, index definitions, and validator semantics currently used by Convex-generated data model types.

#### Scenario: Typechecking downstream packages after schema split

- **WHEN** Convex schema is split into fragments
- **THEN** Convex package typecheck SHALL pass
- **AND** dependent package typechecks SHALL remain compatible without API signature changes
