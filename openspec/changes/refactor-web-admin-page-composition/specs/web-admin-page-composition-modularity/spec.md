# web-admin-page-composition-modularity Specification

## Purpose

Define modular composition requirements for large web admin routes so page files remain orchestration-focused and domain behavior is implemented in dedicated local modules.

## Requirements

### Requirement: Large web admin routes MUST delegate domain behavior to dedicated modules

Covered web admin routes SHALL keep top-level route composition in `page.tsx` while delegating domain-specific behavior, local editor state, and complex section rendering to dedicated local modules or hooks.

#### Scenario: Settings route renders extracted domains

- **WHEN** the settings route renders
- **THEN** top-level route composition SHALL remain in `settings/page.tsx`
- **AND** high-complexity settings domain behavior SHALL be implemented in dedicated local modules or hooks
- **AND** `settings/page.tsx` SHALL not be the primary home for unrelated settings domain logic

#### Scenario: Ticket forms route renders extracted editor modules

- **WHEN** the ticket forms route renders
- **THEN** route-level layout and selection orchestration SHALL remain at the page level
- **AND** ticket form editing behavior SHALL be delegated to dedicated local modules
- **AND** field CRUD and ordering logic SHALL not remain concentrated in a single route file

### Requirement: Composition refactors MUST preserve existing route behavior

Covered route decomposition SHALL preserve existing mutation targets, payload semantics, permissions, and user-visible save/delete/editor behavior.

#### Scenario: Existing settings mutation behavior remains intact

- **WHEN** a user saves a covered settings section after the refactor
- **THEN** the same underlying mutation target SHALL be invoked with equivalent payload semantics
- **AND** success and error behavior SHALL remain functionally equivalent

#### Scenario: Existing ticket form editing behavior remains intact

- **WHEN** a user creates, edits, reorders, saves, or deletes ticket form fields after the refactor
- **THEN** the user-visible workflow SHALL remain functionally equivalent
- **AND** the same backend contract semantics SHALL be preserved
