## Why

Large route components, surface controllers, and feature entry modules across the repo increasingly combine orchestration, data wiring, domain actions, local UI state, and view rendering in one place. This raises maintenance cost, increases contributor friction, and often leads to sprawling prop surfaces that are hard to scan and evolve safely. The codebase already uses extracted local hooks and domain modules in some areas, but the pattern is not yet consistently identified, documented, or promoted as a preferred decomposition approach.

## What Changes

- Audit app and package surfaces for opportunities to replace overgrown page/controller modules with a controller-hook and domain-module pattern.
- Identify candidate files where page-level composition should remain thin while extracted local hooks/modules own domain orchestration, view-model shaping, and local behavior.
- Produce a prioritized opportunity inventory rather than forcing immediate implementation in every surface.
- Update OpenSpec guidance/spec language so controller-hook/domain-module decomposition is documented as a preferred modularity pattern when route or surface files become orchestration-heavy.
- Preserve freedom to use other patterns where they are simpler; this change promotes a default heuristic, not a mandatory universal abstraction.

## Capabilities

### New Capabilities
- `controller-hook-and-domain-module-opportunity-audit`: Covers repo-wide auditing and prioritization of controller-hook/domain-module decomposition opportunities.

### Modified Capabilities
- `web-admin-page-composition-modularity`: Clarify that controller-hook and domain-module decomposition is a preferred way to implement page-level modularity when route files become orchestration-heavy.
- `web-settings-domain-modularity`: Clarify that domain extraction should prefer explicit controller-hook/domain-module boundaries over bloated page-level orchestration or opaque context-driven coupling.

## Impact

- Affected code: audit artifacts and follow-on implementation candidates across `apps/web`, `apps/widget`, `apps/mobile`, and selected shared frontend packages.
- Affected contributors: frontend and SDK contributors deciding how to decompose large route/controller modules.
- Dependencies: no immediate runtime changes; this change establishes inventory and guidance for future refactors.
