## Overview

This change reduces parity drift between web and mobile by moving shared onboarding/backend/workspace rules into explicit cross-surface domain helpers while leaving surface-specific routing and rendering local to each app.

## Goals

- Make shared domain rules reusable across web and mobile.
- Reduce duplicate fixes for backend/workspace/onboarding logic.
- Keep current UX behavior intact while clarifying where shared decision logic lives.
- Improve contributor confidence when making parity-sensitive changes.

## Non-Goals

- Making web and mobile screens identical.
- Forcing all surface state management into a shared abstraction.
- Changing product behavior beyond what is needed to preserve parity.

## Architecture

### Shared domain extraction

- Identify behavior that is truly shared, such as:
  - backend URL defaulting and validation decisions
  - workspace selection rules
  - onboarding gating and next-step decision rules
- Move those rules into shared domain helpers/types in an appropriate package.
- Keep app-specific rendering, navigation, and persistence concerns in each surface.

### Surface integration

- Web and mobile should both consume shared helpers for common rule evaluation.
- Each app remains responsible for UI state, navigation wiring, and surface-specific copy or presentation.

## Risks and Mitigations

- Risk: over-sharing behavior that should remain surface-specific.
  - Mitigation: share domain rules only where parity is intentionally desired.
- Risk: migration introduces subtle flow differences.
  - Mitigation: preserve existing behavior through targeted tests in both surfaces.
- Risk: shared helpers become a dumping ground.
  - Mitigation: limit scope to backend/workspace/onboarding domain logic only.

## Rollout Notes

- Start with the most obviously duplicated rule sets.
- Integrate one surface at a time while preserving existing route behavior.
