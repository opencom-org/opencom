# Notifications Domain Modules

This folder contains notification orchestration internals split by responsibility.  
`../notifications.ts` remains the stable entrypoint surface for `internal.notifications.*`.

## Ownership

- `contracts.ts`: shared validators, constants, and typed payload contracts.
- `helpers.ts`: pure helper utilities (formatting, truncation, metadata rendering, debounce batch selection).
- `recipients.ts`: recipient resolution queries and fallback visitor recipient lookup.
- `dispatch.ts`: delivery logging and push/email channel dispatch actions.
- `routing.ts`: event routing, recipient filtering, dedupe key enforcement, and scheduling.
- `emitters/chat.ts`: chat/conversation/assignment notification emitters.
- `emitters/ticket.ts`: ticket lifecycle notification emitters.

## Extension Patterns

- Add new event emitters in `emitters/*` and keep them thin by delegating routing to `routeEvent`.
- Keep routing semantics changes isolated in `routing.ts` so emitter payload changes do not alter dedupe behavior.
- Keep formatting/debounce/template-adjacent logic in `helpers.ts` to preserve testability and reuse.
- Add new recipient policy logic in `recipients.ts` rather than duplicating query logic in emitters.

## Cross-Surface Notes

- This refactor is backend-internal and does not change public API contracts for `apps/web`, `apps/widget`, `apps/mobile`, `packages/sdk-core`, or `packages/sdk-react-native`.
- If future work needs shared behavior changes across clients, update shared specs/contracts first, then consume them in each surface.
