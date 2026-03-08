## Overview

This change creates a structured audit of where controller-hook and domain-module decomposition would materially improve maintainability across the repo. The target outcome is not an automatic broad rewrite, but a repeatable way to identify when route or controller modules should stay thin and delegate focused domain behavior to local hooks/modules. The change also codifies that pattern in OpenSpec guidance so future proposals can reference a shared architectural default.

## Goals

- Identify high-value decomposition candidates where one module owns too many concerns.
- Promote a consistent pattern in which route/surface modules focus on composition and top-level wiring while local controller hooks or domain modules own focused orchestration.
- Reduce ambiguity about when explicit prop passing is still healthy versus when a page/controller file has become too orchestration-heavy.
- Keep guidance practical and non-dogmatic.

## Non-Goals

- Mandating controller hooks everywhere.
- Replacing simple explicit prop passing with context by default.
- Forcing an immediate multi-surface refactor as part of the audit itself.
- Creating a single global abstraction that all surfaces must share.

## Architecture

### Audit criteria

Candidate modules should be flagged when several of the following hold:

- one file combines multiple unrelated domains or workflows
- page/controller files own many state variables and event handlers across separate concerns
- child section props are long because the parent owns cross-domain orchestration
- changes to one sub-flow require understanding unrelated sections in the same file
- repeated normalization, gating, or async action wiring is embedded directly in route/controller files

### Preferred decomposition pattern

When a candidate is identified, the preferred default is:

- keep the route/surface entry module focused on composition, coarse routing, and top-level layout
- extract local controller hooks for domain orchestration and view-model shaping
- extract local domain modules/utilities for cohesive sub-feature behavior
- keep prop passing explicit where practical, but group related state/actions into cohesive domain-shaped contracts
- avoid introducing context unless state truly needs to span multiple descendant layers and explicit dependencies become structurally awkward

### Audit outputs

The audit should produce:

- a prioritized opportunity list by surface/domain
- rationale for why each candidate is worth refactoring
- recommended extraction boundary shape for each candidate
- notes on related existing OpenSpec changes to avoid overlap or duplication

## Risks and Mitigations

- Risk: the pattern is applied too mechanically.
  - Mitigation: document heuristics and tradeoffs, not a blanket rule.
- Risk: contributors use context as a shortcut instead of improving boundaries.
  - Mitigation: guidance explicitly treats context as a secondary tool, not the default fix for large prop surfaces.
- Risk: the audit becomes a vague wishlist.
  - Mitigation: require prioritization, rationale, and recommended extraction boundaries for each candidate.

## Rollout Notes

- Start with web admin and article/inbox-style orchestration-heavy pages.
- Extend the audit to widget, mobile, and shared frontend packages where similar controller sprawl exists.
- Use the audit to seed later scoped refactor changes rather than bundling implementation into this change.
