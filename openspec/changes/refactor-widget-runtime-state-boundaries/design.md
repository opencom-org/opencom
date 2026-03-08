## Overview

This change improves widget maintainability by separating runtime concerns that currently interact through shared context and loosely distributed hooks. The main outcome is clearer ownership of navigation state, capability/tab resolution, and side effects such as tracking.

## Goals

- Reduce broad state ownership in central widget runtime modules.
- Make navigation/view transitions easier to reason about.
- Isolate side effects from core state transitions where feasible.
- Preserve current runtime behavior and public widget semantics.

## Non-Goals

- Redesigning the widget UX.
- Replacing the widget shell with an entirely new state-management library unless clearly justified during implementation.
- Changing visitor-visible feature availability.

## Architecture

### Runtime domains

- Separate widget runtime concerns into clearer domains such as:
  - navigation/view state
  - tab/capability visibility resolution
  - home/help/messages configuration interpretation
  - tracking and other side effects
- Keep shared context focused on stable, high-value cross-cutting state rather than owning every widget concern.

### Transition model

- Make view transitions and tab availability decisions more explicit in code structure.
- Prefer domain helpers or reducer-style organization where it improves readability and testability.

### Compatibility constraints

- Existing widget views, navigation semantics, and capability gating must remain functionally equivalent.
- Tracking and overlay behavior must preserve current runtime expectations.

## Risks and Mitigations

- Risk: navigation regressions from moving state logic.
  - Mitigation: preserve transition semantics and add focused coverage around runtime flows.
- Risk: over-engineering with too much abstraction.
  - Mitigation: extract by runtime domain, not by theoretical state-machine purity.
- Risk: split ownership becomes unclear.
  - Mitigation: define explicit module responsibility boundaries before moving logic.

## Rollout Notes

- Start with the most central runtime ownership points.
- Extract navigation and capability resolution first, then side-effect coordination.
