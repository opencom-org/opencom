## Overview

This change reduces maintenance risk in large web admin page files by separating route composition from domain-specific behavior and local editor state. The target outcome is that page files remain responsible for routing, coarse data wiring, and top-level layout, while extracted hooks and local modules own focused domain behavior.

## Goals

- Reduce file-level complexity in `settings/page.tsx` and `tickets/forms/page.tsx`.
- Make section-specific changes possible without understanding unrelated settings or editor logic.
- Preserve all existing mutation targets, payloads, permissions, and visible UI behavior.
- Improve testability by allowing focused unit coverage of extracted helpers and hooks.

## Non-Goals

- Redesigning the settings UX or ticket forms UX.
- Changing permission rules, routing, or server payload contracts.
- Consolidating all admin pages under one abstraction in this change.

## Architecture

### Settings route decomposition

- Keep `settings/page.tsx` as a composition/orchestration entry point.
- Extract section-specific modules for domains that currently carry their own save/error/loading logic.
- Move repeated form initialization, async save orchestration, and normalization helpers into local hooks/utilities where appropriate.

### Ticket forms route decomposition

- Keep the route entry responsible for workspace selection, coarse layout, and selected form routing.
- Extract form list actions, editor state manipulation, and field editing behavior into dedicated modules.
- Keep local editor behavior colocated with the ticket forms feature rather than introducing a broad cross-app abstraction.

### Testing approach

- Add or update focused tests around extracted helpers/hooks where logic moves out of page files.
- Preserve existing behavior coverage for key save/delete/editor flows.

## Risks and Mitigations

- Risk: behavior drift during extraction.
  - Mitigation: preserve existing mutation calls and payload semantics; prefer moving code without changing business logic.
- Risk: introducing too many tiny files.
  - Mitigation: extract by domain responsibility, not by arbitrary line count.
- Risk: duplicated helper patterns remain after decomposition.
  - Mitigation: keep this change focused on composition boundaries; follow-on standardization work will handle shared async/confirmation flows.

## Rollout Notes

- Implement settings decomposition first because it has the highest contributor friction.
- Follow with ticket forms decomposition once the local extraction pattern is established.
