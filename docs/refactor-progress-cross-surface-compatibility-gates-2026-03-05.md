# Refactor Progress: Cross-Surface Compatibility Gates (2026-03-05)

## Slice

- `add-cross-surface-compatibility-gates` (P0)

## Why

Primary refactors across `web`, `widget`, and `convex` require stronger guardrails so we do not silently break:

- `@opencom/sdk-core` visitor-path contracts
- `@opencom/react-native-sdk` runtime contracts
- `apps/mobile` compile-time integrations

## What Changed

1. Added a root cross-surface verification script:
   - `test:compat:cross-surface`
   - Runs:
     - `@opencom/sdk-core` tests
     - `@opencom/react-native-sdk` tests
     - `@opencom/mobile` typecheck
2. Extended sdk-core contract coverage for outbound impression mutation stability:
   - `packages/sdk-core/tests/contracts.test.ts`
3. Added RN SDK outbound contract tests to lock query/mutation refs and payload shapes:
   - `packages/react-native-sdk/tests/outboundContracts.test.ts`

## Verification Run Notes

Executed in this pass:

- `pnpm test`
  - Unit: pass
  - E2E: fail (12 failures, 181 pass, 7 skipped)
- `pnpm --filter @opencom/convex test`
  - pass (32 files, 216 tests)
- `pnpm test:compat:cross-surface`
  - pass

Known unresolved failures are currently in e2e selectors/expectations across:

- `ai-agent-settings`
- `carousels`
- `home-settings` preview
- `inbox` sidecar
- `knowledge` delete flow
- `tooltips` CRUD
- `widget` email capture
- no-auth signup flow

These need a dedicated e2e stabilization follow-up before full green can be claimed.
