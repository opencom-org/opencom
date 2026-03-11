## Context

`apps/mobile/app/(app)/conversation/[id].tsx` currently stores composer text in local React state only. That means any app backgrounding, route remount, memory pressure, or manual navigation away from the conversation can drop the unsent reply.

The mobile app and React Native SDK already use AsyncStorage-based persistence for backend, session, and workspace state, so this change can reuse an established local-storage pattern without adding a backend draft model. The affected workflow is operator-authored conversation replies in the mobile app, not visitor-side messaging.

## Goals / Non-Goals

**Goals:**
- Preserve unsent mobile conversation drafts when the operator switches apps and returns to the same conversation.
- Restore drafts only within the correct backend, operator, workspace, and conversation scope.
- Clear persisted drafts after a successful send while keeping failed-send retry behavior intact.
- Keep the implementation local to the mobile app and avoid backend schema or API changes.

**Non-Goals:**
- Syncing drafts across devices or between mobile and web.
- Persisting rich composer attachments or non-text reply state in this change.
- Introducing a server-backed draft entity or a generalized inbox-draft platform.

## Decisions

### 1) Persist drafts locally with AsyncStorage instead of adding backend draft records

Decision:
- Store mobile reply drafts in an app-local AsyncStorage utility consumed by the conversation screen.

Rationale:
- The requested behavior is resume-after-app-switch on the same device. Local persistence is faster, works without additional network calls, and fits the existing mobile storage model.

Alternatives considered:
- Server-backed drafts. Rejected because it adds schema, API, and cross-device semantics that are not required for this problem.
- In-memory global state only. Rejected because it still loses drafts when the screen unmounts or the app process is reclaimed.

### 2) Scope draft keys by backend, operator, workspace, and conversation

Decision:
- Use a composite storage key that includes backend URL, signed-in user ID, active workspace ID, and conversation ID.

Rationale:
- The same device can switch backend environments, workspaces, and operator accounts. A composite key prevents draft leakage across tenants and threads.

Alternatives considered:
- Conversation-only keys. Rejected because conversation IDs are not sufficient to isolate drafts across accounts or environments.
- User-and-conversation keys only. Rejected because workspace/backend context can still change on the same device.

### 3) Restore on screen load and persist through both edit and app lifecycle events

Decision:
- Add a small mobile draft controller or utility that hydrates on conversation load, writes draft updates as the text changes, and flushes the latest value when the app transitions to the background.

Rationale:
- Hydration on load solves route remounts. Persisting during editing plus a background flush reduces the chance of losing the most recent keystrokes when the app is suspended quickly.

Alternatives considered:
- Save only on unmount or route blur. Rejected because mobile apps may be suspended without a reliable cleanup path.
- Save on every keystroke without coordination. Rejected because it adds unnecessary storage churn.

### 4) Clear only after confirmed send success and on scope reset

Decision:
- Keep the current optimistic UI pattern of clearing the composer before send, but restore the text if send fails and delete persisted storage only after send success. Also clear draft storage when logout or workspace/account scope changes invalidate the key.

Rationale:
- This preserves current retry behavior while ensuring successful sends do not resurrect stale drafts later.

Alternatives considered:
- Delete the draft at send start. Rejected because failed sends would permanently lose the message.
- Never clear automatically. Rejected because old drafts would keep reappearing after successful replies.

## Risks / Trade-offs

- [Risk] Frequent storage writes could add UI overhead on slower devices.
  - Mitigation: centralize writes in a small utility and debounce or otherwise coalesce updates before writing.
- [Risk] Stale drafts may linger if a conversation is abandoned for a long time.
  - Mitigation: store lightweight metadata such as last-updated time so future cleanup can be added without changing the key format.
- [Risk] Incorrect key scoping could restore drafts into the wrong operator context.
  - Mitigation: build keys from the same backend/auth/workspace context already used for mobile persistence and add scope-isolation tests.

## Migration Plan

1. Add a mobile draft persistence utility and typed draft payload for conversation replies.
2. Integrate hydration, background flush, send-success clear, and send-failure restore into `apps/mobile/app/(app)/conversation/[id].tsx`.
3. Add focused tests for restore, scope isolation, and clear-on-send behavior.
4. Run targeted mobile verification and strict OpenSpec validation before implementation handoff.

Rollback:
- Remove the conversation-screen integration and stop reading stored drafts. Persisted keys can be left inert or cleared by prefix if rollback cleanup is required.

## Open Questions

- None for initial scope. The first version assumes drafts persist until successful send, explicit overwrite with blank content, logout, or workspace/account context change.
