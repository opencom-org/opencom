## Why

`apps/web/src/app/settings/page.tsx` combines multiple independent domains (team membership, signup/auth policy, help-center access, email channel, workspace origins, backend switching) in one monolithic file. This slows iteration and increases regression risk when making domain-specific changes.

## What Changes

- Extract team membership and invitation state/handlers into a dedicated hook.
- Extract major settings sections into focused components:
  - team members
  - signup/auth
  - help-center access
  - email channel
- Keep existing behavior and permissions unchanged.
- Reduce `settings/page.tsx` to orchestration + section composition.

## Capabilities

### New Capabilities

- `web-settings-domain-modularity`: Settings page domains can evolve independently via dedicated modules.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/web/src/app/settings/page.tsx`
  - new settings domain components/hooks under `apps/web/src/app/settings/`
- APIs:
  - No backend API shape changes.
- Dependencies:
  - No new external dependencies.
