# web-admin-action-flow-standardization Specification

## Purpose

Define standard async action and confirmation flow requirements for covered web admin routes so save/delete behavior remains consistent and easier to maintain.

## Requirements

### Requirement: Covered web admin actions MUST use shared async orchestration

Covered web admin save and delete flows SHALL be implemented through shared action-flow utilities or hooks rather than route-specific control-flow boilerplate.

#### Scenario: Covered admin save action runs through shared orchestration

- **WHEN** a covered web admin route performs a save action
- **THEN** loading-state sequencing, unknown-error normalization, and feedback emission SHALL be handled through shared action-flow primitives
- **AND** the route SHALL remain responsible only for domain-specific inputs and messages

### Requirement: Covered destructive actions MUST preserve explicit confirmation behavior

Covered destructive admin actions SHALL require explicit user confirmation before mutation execution while using shared confirmation orchestration.

#### Scenario: Covered delete action is confirmed before mutation

- **WHEN** a user triggers a covered destructive action
- **THEN** the UI SHALL request explicit confirmation before invoking the mutation
- **AND** the same mutation semantics SHALL be preserved after migration

### Requirement: Standardization MUST preserve route-specific feedback semantics

Standardized action helpers SHALL allow covered routes to provide route-specific success or next-step messaging while still using shared normalization and feedback behavior.

#### Scenario: Route-specific save guidance remains available

- **WHEN** a covered route save action fails
- **THEN** the UI SHALL surface standardized non-blocking feedback
- **AND** the route SHALL still be able to provide context-specific fallback and next-action copy
