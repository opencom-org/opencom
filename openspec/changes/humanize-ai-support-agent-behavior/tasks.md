## 1. Backend Turn Coordination

- [ ] 1.1 Add the conversation and/or AI-response metadata needed to identify the latest unresolved visitor turn and mark superseded AI attempts.
- [ ] 1.2 Refactor AI generation entrypoints to assemble reply context from persisted conversation messages instead of relying on client-only history snapshots.
- [ ] 1.3 Prevent stale in-flight generations from posting visitor-facing replies after newer visitor input arrives.

## 2. Human-Like Support Behavior

- [ ] 2.1 Add explicit handling for routine conversational turns such as greetings, thanks, acknowledgement-only messages, clarifications, corrections, and short follow-ups.
- [ ] 2.2 Update AI prompt and response-policy logic so supported questions get direct human-like answers and ambiguous questions get focused clarifying replies before escalation.
- [ ] 2.3 Preserve explicit handoff behavior for unsupported, sensitive, or low-confidence cases while reducing unnecessary handoff for routine chat turns.

## 3. Surface Integration And Traceability

- [ ] 3.1 Update widget conversation send and typing orchestration to align with backend turn coordination and consecutive-message handling.
- [ ] 3.2 Update inbox and AI review payloads or rendering so superseded or merged AI attempts remain operator-visible without changing the visitor-facing thread.
- [ ] 3.3 Confirm coordinated replies, handoffs, and subsequent human replies keep conversation workflow state and thread rendering consistent.

## 4. Verification

- [ ] 4.1 Add or expand Convex tests covering greetings, clarification behavior, routine acknowledgement turns, and latest-turn coordination semantics.
- [ ] 4.2 Add or expand widget tests covering consecutive sends, mid-processing follow-ups, stale-reply suppression, and typing-state behavior.
- [ ] 4.3 Run strict OpenSpec validation plus targeted package tests and typechecks for the touched AI/chat paths.
