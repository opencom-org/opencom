## Context

`SurveyOverlay.tsx` currently contains:

- survey domain types and answer value normalization
- orchestration for impression/start/submit/dismiss
- small/large format containers
- all question-type renderers

This produces a single high-coupling file for unrelated concerns.

## Goals / Non-Goals

**Goals:**

- Move survey types and answer normalization helpers out of controller.
- Move container and question renderers into dedicated view modules.
- Keep `SurveyOverlay` controller behavior and props stable.

**Non-Goals:**

- Changing survey product logic or response payloads.
- Changing Convex survey endpoint contracts.

## Decisions

### 1) Extract `surveyOverlay` domain modules

Decision:

- Move types + answer normalization helpers into `surveyOverlay/types.ts` and `surveyOverlay/answers.ts`.

Rationale:

- Makes answer-shape behavior explicit and reusable.

### 2) Extract layout + question renderers

Decision:

- Move small/large wrappers and question renderer variants to `surveyOverlay/components.tsx`.

Rationale:

- Reduces main controller complexity and isolates UI variants.

### 3) Keep `SurveyOverlay` orchestration in place

Decision:

- Keep submission/dismiss/impression orchestration in `SurveyOverlay.tsx`.

Rationale:

- Preserves current integration semantics with minimal risk.

## Risks / Trade-offs

- [Risk] Selector/class drift in extracted question components.
  - Mitigation: preserve class names and run widget tests.
- [Risk] Answer normalization regressions.
  - Mitigation: keep normalization logic unchanged and centralized.

## Migration Plan

1. Extract survey types + answer helpers.
2. Extract container + question renderers.
3. Recompose `SurveyOverlay.tsx`.
4. Run widget typecheck + widget tests + web typecheck.
5. Update refactor docs.

Rollback:

- Inline modules back into `SurveyOverlay.tsx`.
