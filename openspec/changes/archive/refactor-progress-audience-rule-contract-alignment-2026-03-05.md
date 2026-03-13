# Refactor Progress: Audience Rule Contract Alignment (2026-03-05)

## Scope

- `packages/types`
- `apps/web`
- validation guardrails for:
  - `packages/convex`
  - `apps/widget`
  - `packages/sdk-core`
  - `apps/mobile`
  - `packages/react-native-sdk`

## Problems Addressed

1. Web audience rule types drifted from Convex validator contracts.
2. Segment reference shape in web builder did not match backend payload contract.
3. Outbound editor used a segment-capable type even though backend accepts inline rules only.
4. Article markdown export loop accessed `content` without narrowing file union type.

## What Was Changed

### Shared contracts

- Added `packages/types/src/audienceRules.ts` with shared audience-rule contracts and helpers.
- Exported via `packages/types/src/index.ts`.

### Web audience rule adoption

- Refactored `apps/web/src/components/AudienceRuleBuilder.tsx`:
  - uses shared audience contracts
  - uses backend-compatible segment payload shape `{ segmentId }`
  - limits nested group depth to match validator-supported rule depth
- Refactored `apps/web/src/lib/audienceRules.ts`:
  - segment detection now based on `segmentId` shape
  - inline conversion helper alignment for builder and unknown payloads

### Outbound + articles fixes

- Updated `apps/web/src/app/outbound/[id]/page.tsx`:
  - targeting state switched to inline-only rules
  - builder output normalized with inline conversion helper
  - explicit null guard before post-specific save logic
- Updated `apps/web/src/app/articles/page.tsx`:
  - markdown export archive generation now narrows `file.type` before reading `content`

### Tests added

- `apps/web/src/lib/__tests__/audienceRules.test.ts`
  - segment payload exclusion
  - inline rule preservation
  - builder conversion behavior

## Verification

Passed:

- `pnpm --filter @opencom/types typecheck`
- `pnpm --filter @opencom/web test -- src/lib/__tests__/audienceRules.test.ts src/lib/__tests__/visitorIdentity.test.ts`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`

Outcome:

- Current `@opencom/web` typecheck blockers from audience-rule drift and article export union narrowing are resolved in this slice.
