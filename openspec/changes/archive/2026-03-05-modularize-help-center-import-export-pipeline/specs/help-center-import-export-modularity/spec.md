## ADDED Requirements

### Requirement: Help Center markdown pipeline MUST isolate stage responsibilities

The markdown import/export pipeline SHALL separate parsing, reference normalization/rewrite, import apply, and export packaging into explicit modules with stable contracts.

#### Scenario: Parser behavior changes

- **WHEN** frontmatter parsing rules are updated
- **THEN** changes SHALL be made in parsing modules
- **AND** export packaging modules SHALL not require edits

#### Scenario: Export packaging behavior changes

- **WHEN** archive file path policy is updated
- **THEN** changes SHALL be made in export packaging modules
- **AND** markdown parsing modules SHALL remain unaffected

### Requirement: Import and export MUST share canonical reference normalization rules

Import rewrite and export rewrite behavior MUST use shared deterministic normalization for markdown paths and internal asset references.

#### Scenario: Imported markdown image reference is rewritten

- **WHEN** sync apply rewrites a local markdown image reference to internal asset format
- **THEN** rewrite behavior SHALL use canonical normalization utilities shared with export

#### Scenario: Export rewrites internal references to relative paths

- **WHEN** markdown containing internal asset references is exported
- **THEN** exported paths SHALL be derived with the same canonical normalization rules used by import

### Requirement: Refactor MUST preserve sync/export parity outcomes

The modularized implementation MUST preserve unresolved-reference reporting and portable export outcomes currently produced by the pipeline.

#### Scenario: Import includes missing referenced files

- **WHEN** markdown references image paths that cannot be resolved
- **THEN** sync responses SHALL continue reporting unresolved references with file context
- **AND** the operation SHALL not crash

#### Scenario: Export bundle is re-imported

- **WHEN** a generated markdown export bundle is re-imported unchanged
- **THEN** image references SHALL still resolve correctly after import
