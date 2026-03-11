## Context

The current widget email-capture experience is owned by `ConversationView` state and rendered inside `ConversationFooter`. It appears after the first visitor message when `collectEmailEnabled` is on and the visitor is not already identified. Today the prompt:

- renders above the composer inside the footer;
- animates upward from the bottom edge;
- stores dismissal in `sessionStorage` via `opencom_email_dismissed`; and
- exposes a `Skip` button that hides the prompt until a later agent reply re-triggers it.

That behavior creates two UX problems the proposal is trying to fix. First, the prompt consumes the same bottom space used for the newest content and next action, so it can hide the most recent reply or make the thread feel visually crowded. Second, if we want email capture to remain available until the visitor provides it, the current dismiss-and-reprompt model adds more state complexity without preserving a clear, lightweight prompt location.

## Goals / Non-Goals

**Goals:**
- Reposition email capture so it appears directly under the widget header and no longer pushes against the latest message and composer area.
- Keep the prompt visible for unidentified visitors once the conversation has started, including after conversation updates and view re-entry.
- Remove temporary dismissal semantics and simplify the state model to "pending until identified."
- Preserve existing visitor identification submission behavior and keep the composer usable while the prompt is visible.

**Non-Goals:**
- Redesign the broader widget header, message composer, or conversation routing model.
- Change backend visitor-identification APIs or add new persistence tables for this UX update.
- Make email collection blocking; visitors should still be able to read and send messages while the prompt is pending.

## Decisions

### 1. Render email capture in a dedicated top-of-thread slot

Decision:
- Move the email capture surface out of `ConversationFooter` and render it immediately below `.opencom-header`, above the scrollable message list.

Rationale:
- A top-anchored surface matches the requested "descend from the top bar" behavior.
- Keeping the prompt in normal document flow avoids covering the newest message while still leaving it persistently visible.
- This separates identity collection from composer controls, which makes the footer easier to keep focused on message input and reply-time/status UI.

Alternatives considered:
- Keep the prompt in the footer but reduce height: rejected because it still competes with the newest message and typing area.
- Overlay the prompt on top of messages: rejected because it would still obscure conversation content, only in a different position.

### 2. Replace dismiss-and-reprompt state with pending-until-identified state

Decision:
- Remove the skip button and `opencom_email_dismissed` storage, and drive visibility from two conditions: the visitor is still unidentified, and the conversation has already received at least one visitor message.

Rationale:
- Persistent email capture no longer needs a temporary hidden state.
- Removing dismissal storage simplifies the effect logic and avoids special-case re-prompt behavior after later agent replies.
- The state should be derived from durable conversation context where possible, so reopening the conversation keeps the prompt visible until identification completes.

Alternatives considered:
- Keep skip but make the surface smaller: rejected because the request explicitly prefers leaving the prompt visible instead of giving it a dismiss path.
- Persist dismissal longer in storage: rejected because it works against the new "stay there until filled in" behavior.

### 3. Make the prompt compact and top-descending, not full-panel

Decision:
- Restyle the prompt as a compact banner/card with shorter copy, tighter spacing, and an entrance motion that originates from the header/top edge. The layout can stay inline on wider widths and stack cleanly on narrow widget sizes.

Rationale:
- The prompt needs to remain noticeable without taking over the thread.
- Compact layout reduces vertical cost, especially on mobile widget heights where the footer and latest message already compete for space.
- Top-origin motion reinforces that the surface is attached to the header area, not replacing message content.

Alternatives considered:
- Reuse the current large panel styling and move it upward: rejected because it would still feel oversized even if relocated.

### 4. Update automated coverage around persistence and non-obstruction

Decision:
- Update widget E2E expectations to verify the new position and behavior: prompt appears after the first visitor message, no skip action is available, the prompt remains visible until successful email submission, and it disappears once identification succeeds.

Rationale:
- Current tests encode the bottom-panel and skip-button behavior, so they would otherwise preserve the old UX contract by accident.
- The new tests should assert persistence semantics instead of dismissal semantics.

Alternatives considered:
- Leave tests focused only on submission success: rejected because the proposal changes the core interaction model, not just styling.

## Risks / Trade-offs

- [Risk] A persistent prompt can still feel noisy if the compact layout is not small enough.
  - Mitigation: keep copy short, remove secondary actions, and cap vertical height tightly across breakpoints.
- [Risk] Moving the prompt out of the footer could introduce scroll or layout regressions in the conversation view.
  - Mitigation: keep the surface in normal flow under the header and verify desktop/mobile widget sizes with focused tests.
- [Risk] Removing dismissal storage changes current E2E and manual expectations.
  - Mitigation: update tests and helpers in the same implementation slice so the new persistence contract is explicit.

## Migration Plan

1. Move the email-capture render path from the footer to a dedicated top-of-thread slot in `ConversationView` or a small companion render module.
2. Remove skip/dismiss UI and simplify the email-capture state logic so it remains visible until identification succeeds.
3. Update widget styles and motion for the compact top-descending surface across responsive breakpoints.
4. Update focused widget E2E coverage and any affected component tests to reflect the persistent top-anchored contract.

Rollback strategy:
- Revert the top-slot render change and restore the footer prompt plus dismissal state if the new compact surface causes unacceptable layout regressions.

## Open Questions

- None for the initial proposal fast-forward. The implementation should assume the compact email-capture surface stays pinned directly beneath the widget header while visible.
