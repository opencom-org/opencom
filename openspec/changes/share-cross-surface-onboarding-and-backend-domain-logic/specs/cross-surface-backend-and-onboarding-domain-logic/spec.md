# cross-surface-backend-and-onboarding-domain-logic Specification

## Purpose

Define shared cross-surface domain rules for backend selection, workspace selection, and onboarding decisions where web and mobile are intended to stay aligned.

## Requirements

### Requirement: Shared onboarding and backend rules MUST be implemented in reusable domain helpers

Covered backend selection, workspace selection, and onboarding decision rules that are intended to remain aligned across web and mobile SHALL be implemented in reusable shared domain helpers rather than duplicated independently in each surface.

#### Scenario: Shared workspace selection rule is applied on both surfaces

- **WHEN** web and mobile evaluate a covered workspace-selection or onboarding rule
- **THEN** both surfaces SHALL derive the rule outcome from shared domain logic
- **AND** each surface MAY still render and navigate differently according to local UI needs

### Requirement: Shared rule extraction MUST preserve intended surface behavior

Cross-surface domain extraction SHALL preserve the intended effective behavior of covered onboarding/backend/workspace flows on both surfaces.

#### Scenario: Existing onboarding gating remains aligned after extraction

- **WHEN** a user reaches a covered onboarding decision point after the refactor
- **THEN** the same effective gating outcome SHALL occur for that surface
- **AND** surface-specific presentation details SHALL remain local to the app
