## Context

Web inbox has evolved into a richer operator workspace with AI review and visitor workflows, while mobile remains focused on basic messaging. Key operational context is missing on mobile, forcing workflow switching back to web.

## Goals / Non-Goals

**Goals:**
- Add AI workflow visibility and review context to mobile inbox/conversation flows.
- Add visitor directory list/search/detail navigation in mobile app.
- Distinguish AI-generated messages from human-agent messages in mobile conversation UI.
- Reuse existing backend APIs/contracts where possible.

**Non-Goals:**
- Rebuilding full desktop inbox layout on mobile.
- Implementing every web sidecar/tooling feature in this change.

## Decisions

### 1) Progressive parity with mobile-native layout

Decision:
- Deliver parity-critical capabilities (AI review, attribution, visitors directory/detail) via mobile-native screens and panels, not a 1:1 web layout clone.

Rationale:
- Preserves mobile usability while closing functional gaps.

Alternatives considered:
- Port web inbox layout directly. Rejected due to poor mobile UX fit.

### 2) Reuse existing Convex AI/visitor APIs where possible

Decision:
- Consume current conversation AI workflow and AI response APIs, plus visitor directory/detail APIs, with minimal backend additions.

Rationale:
- Reduces backend churn and keeps parity focused on client experience.

Alternatives considered:
- Build separate mobile-specific API layer. Rejected for duplication.

### 3) Add explicit AI attribution markers in message list

Decision:
- Mobile conversation UI marks AI-generated messages and handoff context explicitly.

Rationale:
- Operators need quick trust and review context.

## Risks / Trade-offs

- [Risk] Additional inbox context may clutter mobile UI.
  - Mitigation: progressive disclosure (collapsible sections/sheets).
- [Risk] API payloads may increase mobile data usage.
  - Mitigation: paginate and fetch review details on-demand.

## Migration Plan

1. Extend mobile inbox list to display AI workflow metadata.
2. Add mobile AI review view in conversation screen.
3. Add visitor directory list/search/detail screens and navigation links.
4. Add tests for parity-critical flows and regression checks.
5. Roll out behind feature flag if needed.

Rollback:
- Hide new screens behind feature flag and revert to basic inbox list/detail flow.

## Open Questions

- Which subset of AI review metrics is required in first mobile release?
- Should visitor detail include linked tickets in initial scope or follow-up?
