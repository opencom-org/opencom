## Context

The current AI chat flow is split across widget runtime code and backend generation logic. In the widget, `apps/widget/src/components/ConversationView.tsx` sends the visitor message and then separately calls `aiAgentActions.generateResponse`, passing the just-typed text plus a local `messages` snapshot. That makes the client responsible for deciding when to generate, what history to include, and how to behave if the visitor sends more context before the reply is delivered.

On the backend, `packages/convex/convex/aiAgentActions.ts` is optimized for retrieval-backed answers and handoff decisions, but it does not yet define explicit behavior for routine conversational turns such as greetings, brief thanks, clarifications, or quick "one more thing" follow-ups. `packages/convex/convex/aiAgent.ts` stores delivered AI and handoff records for review, but it does not currently distinguish a final delivered response from an earlier attempt that was superseded by newer visitor input.

This change is cross-cutting because it touches runtime behavior, backend response orchestration, persisted AI response state, and review surfaces that explain what the AI attempted versus what the visitor actually received.

## Goals / Non-Goals

**Goals:**

- Make routine AI chat behavior feel like a capable human support agent for greetings, acknowledgements, clarifications, short follow-ups, and common conversational turns.
- Ensure the next automated reply is always based on the latest unresolved visitor turn, including messages that arrive while generation is already in flight.
- Preserve clear operator traceability so inbox review can explain superseded, merged, delivered, and handoff outcomes without polluting the visitor-facing thread.
- Keep manual human-agent participation authoritative so existing handoff and "human already replied" protections still apply.

**Non-Goals:**

- Replacing the existing AI provider stack, retrieval pipeline, or billing gates.
- Broad persona customization beyond using the existing AI settings and prompt surface more effectively.
- Redesigning inbox or widget layout beyond behavior/status changes needed to support coordinated replies.
- Extending this change to unrelated channels beyond the current conversation AI workflow.

## Decisions

### 1. Move authoritative turn assembly to the backend

`generateResponse` SHALL stop depending on the widget's local message snapshot as the source of truth for reply context. The backend should reconstruct the current turn from persisted conversation messages and use the latest unresolved visitor input as the authoritative response target.

Why:

- The current client-driven history is race-prone because the visitor message is sent before AI generation starts, yet the history passed to the action can lag behind what was just persisted.
- Back-to-back messages and mid-generation follow-ups are easier to coordinate when a single backend path decides which visitor messages belong to the next reply.

Alternative considered:

- Keep the current client-supplied `conversationHistory` model and tighten prompt wording. Rejected because it does not solve stale history or in-flight coordination races.

### 2. Introduce lightweight turn-coordination metadata for conversations and AI attempts

The backend should track enough metadata to identify the latest unresolved visitor turn and whether an AI attempt was delivered, superseded, merged into a later turn, or ended in handoff. This can be conversation-level turn watermarking, AI-attempt status on `aiResponses`, or an equivalent narrow state model, but the visitor-visible thread must continue to show only the final delivered outcome.

Why:

- The system needs an objective way to reject stale generations that finish after newer visitor input arrives.
- Inbox review needs to explain what happened without pretending every stored generation was shown to the visitor.

Alternative considered:

- Do not persist superseded attempt state and only keep the final delivered record. Rejected because it removes operator traceability for exactly the races this change is meant to fix.

### 3. Add a conversational response-policy layer before fallback and handoff

`aiAgentActions.generateResponse` should explicitly recognize routine conversational turns such as greetings, thanks, acknowledgement-only messages, clarifications, corrections, and quick follow-ups. That policy layer should decide whether the right next action is a brief conversational reply, a focused clarification question, a retrieval-backed support answer, or a true human handoff.

Why:

- Routine turns often do not need knowledge retrieval or escalation, but they still need a natural support response.
- Keeping this logic explicit makes it testable and prevents all conversational polish from being delegated to one large prompt.

Alternative considered:

- Rely entirely on prompt changes to make the model "sound more human." Rejected because prompt-only behavior is harder to make deterministic across greeting, clarification, and handoff edge cases.

### 4. Keep widget typing UX optimistic, but make backend state authoritative

The widget can continue to show an "AI typing" state quickly after the visitor sends a message, but it should no longer assume a one-send-to-one-reply mapping. The surface should tolerate multiple visitor sends being folded into one coordinated reply and should reflect final handoff or delivered outcomes from backend state rather than from local assumptions.

Why:

- This preserves the current fast-feeling UI without keeping fragile coordination logic in React state.
- It reduces the chance that the widget posts or labels a reply based on outdated local timing assumptions.

Alternative considered:

- Move all triggering to a separate scheduled backend pipeline in this change. Deferred because the main gap is behavioral coordination, and that can be fixed without a larger architecture migration.

## Risks / Trade-offs

- [Risk] Turn-coordination metadata can drift from the underlying message timeline.
  -> Mitigation: derive from persisted message ordering where possible, treat metadata as a lightweight watermark, and recompute conservatively when there is disagreement.
- [Risk] More human-sounding behavior can increase output variability and make regressions harder to notice.
  -> Mitigation: add focused scenario tests for greetings, thanks, clarifications, consecutive messages, and stale-generation suppression.
- [Risk] Coordinating rapid follow-up messages may slightly delay the first AI reply.
  -> Mitigation: keep coordination logic narrow and optimize for "latest unresolved turn" correctness over immediate but stale output.
- [Risk] Review surfaces may become harder to interpret if every AI attempt is shown equally.
  -> Mitigation: explicitly model delivered versus superseded outcomes and keep the visitor-facing thread limited to the final delivered message.

## Migration Plan

1. Add any new optional conversation and AI-response metadata in a backward-compatible way so existing records remain readable.
2. Update backend generation and persistence logic to classify conversational turns, coordinate against the latest unresolved visitor input, and mark superseded attempts appropriately.
3. Update widget and inbox/review consumers to read the new response status semantics while preserving legacy defaults for older records.
4. Verify targeted backend and widget tests, then run strict OpenSpec validation before implementation handoff or PR preparation.

Rollback strategy:

- Revert the new coordination/status semantics while continuing to treat legacy `aiResponses` rows as delivered-or-handoff records.
- Fall back to current direct generation behavior if the new turn-coordination path proves unstable.

## Open Questions

- Should rapid-message coordination rely purely on message ordering, or should it also use a short coalescing window for bursty typing behavior?
- What is the minimum AI-attempt status model that gives operators useful traceability without overcomplicating review UI?
- Should existing `personality` settings remain the only configurable tone input, or is a narrower built-in "support tone" mode needed later?
