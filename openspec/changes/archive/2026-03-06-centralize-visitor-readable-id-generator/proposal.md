## Why

Visitor readable ID generation is duplicated across web and Convex with independent word lists and hash helpers. This creates drift risk for identity fallback labels in inbox, visitors, and seeded backend data.

## What Changes

- Add a shared deterministic visitor-readable-ID utility in `@opencom/types`.
- Refactor Convex `visitorReadableId` to delegate to the shared utility while preserving its public helper signature.
- Refactor web `visitorIdentity` to use the shared numbered-ID generator for fallback labels.
- Add focused tests locking deterministic outputs and label-fallback behavior.

## Capabilities

### New Capabilities

- `visitor-readable-id-generation`: One canonical deterministic generator for adjective-noun-number visitor IDs consumed by web and Convex.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/types/src/*`
  - `packages/convex/convex/visitorReadableId.ts`
  - `apps/web/src/lib/visitorIdentity.ts`
  - related web unit tests
- APIs:
  - No external API changes; existing callsites keep current helper names.
- Dependencies:
  - No new external dependencies.
