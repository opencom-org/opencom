## Context

Current handoff logic optimizes visitor UX by storing/sending one handoff message, but loses diagnostic value by discarding the generated candidate response in review records. Operators need that context to understand AI behavior and improve prompts/settings.

## Goals / Non-Goals

**Goals:**
- Preserve full generated response context for handoff outcomes.
- Keep visitor-visible conversation thread behavior unchanged.
- Expose traceable review payloads that distinguish generated vs delivered handoff text.
- Maintain compatibility for existing AI review consumers.

**Non-Goals:**
- Showing unsent generated responses to visitors in chat.
- Changing handoff decision policy in this change.

## Decisions

### 1) Store dual response context for handoff records

Decision:
- Extend AI response records to store both generated candidate response context and delivered handoff message context when handoff occurs.

Rationale:
- Preserves observability without changing visitor experience.

Alternatives considered:
- Create separate table only for handoff diagnostics. Rejected for added query complexity.

### 2) Keep visitor thread single-message handoff behavior

Decision:
- Continue sending only configured handoff message to conversation thread.

Rationale:
- Avoids confusing visitors with mixed AI/handoff text.

Alternatives considered:
- Send both generated and handoff messages. Rejected due to UX noise.

### 3) Backward-compatible response payload evolution

Decision:
- Add optional fields to AI review payloads and preserve existing fields for older records.

Rationale:
- Allows migration without breaking existing UI queries.

## Risks / Trade-offs

- [Risk] Additional stored payload increases storage footprint.
  - Mitigation: keep candidate payload compact and bounded.
- [Risk] Review UI confusion between generated and delivered text.
  - Mitigation: explicit labels and ordered display in AI review panel.

## Migration Plan

1. Extend AI response schema/contracts with optional generated-candidate fields for handoff cases.
2. Update handoff path in `generateResponse` to persist candidate and delivered contexts.
3. Update AI review query/UI to display full context with clear labels.
4. Add tests for handoff persistence, payload shape, and review rendering.

Rollback:
- Stop writing new candidate fields and keep existing handoff message-only behavior.

## Open Questions

- Do we retain full candidate source payloads indefinitely or apply retention limits?
- Should analytics dashboards include candidate-vs-delivered comparison metrics now or later?
