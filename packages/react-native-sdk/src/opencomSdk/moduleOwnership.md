# RN SDK Orchestrator Module Ownership

This directory owns internal orchestration concerns for `OpencomSDK` while keeping the public API in
`src/OpencomSDK.ts` stable.

## Module boundaries

- `state.ts`
  - Owns shared mutable orchestrator state (`isSDKInitialized`, timers, app-state subscription, survey listeners).
  - Provides `resetOpencomSDKState()` for deterministic teardown.
- `storageService.ts`
  - Owns session/visitor/session-token persistence keys and storage adapter access.
  - No lifecycle or push behavior.
- `lifecycleService.ts`
  - Owns heartbeat scheduling, refresh timer scheduling, and app foreground/background hooks.
  - Depends on sdk-core runtime state and storage persistence helpers.
- `sessionService.ts`
  - Owns initialize/identify/logout orchestration flow and delegates timer/listener work to lifecycle service.
  - No UI/event presentation concerns.
- `pushService.ts`
  - Owns push registration gate behavior for initialization checks and delegates provider logic to `src/push.ts`.

## Facade contract

- `OpencomSDK.ts` is the only public orchestrator facade.
- Host apps (`apps/mobile`) and shared consumers (`sdk-core`, RN components) must keep using `OpencomSDK` APIs.
- Internal module changes must not require public API signature changes.

## Extension guidance

- Put new persistence concerns in `storageService.ts`.
- Put new timers/app-state hooks in `lifecycleService.ts`.
- Put new boot/session transitions in `sessionService.ts`.
- Keep `OpencomSDK.ts` focused on:
  - input validation
  - public guardrails/warnings
  - facade-level event routing
