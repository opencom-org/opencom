## Why

The React Native SDK exports hooks and components that currently mix visitor/session resolution, direct Convex hook calls, skip/gating behavior, and UI-facing response shaping in the same modules. As the SDK grows across conversations, tickets, articles, AI features, and home/configuration flows, this blending increases maintenance cost, makes public hook behavior harder to reason about, and raises the risk that generated Convex typing or transport concerns leak into the SDK’s public surface.

## What Changes

- Refactor React Native SDK hook boundaries so exported hooks and components depend on clearer internal data-access and controller boundaries.
- Introduce internal adapter/wrapper layers where needed so generated Convex hook complexity and visitor/session transport details do not sprawl across exported hook modules.
- Separate public SDK hook ergonomics from internal transport/gating helpers for the current March 10, 2026 hotspot clusters: conversations/tickets, home/content/settings/support, and AI/survey/carousel/push supporting domains.
- Preserve existing public SDK behavior, payload semantics, and runtime expectations for consuming apps.

## Capabilities

### New Capabilities
- `react-native-sdk-hook-boundaries`: Covers explicit internal boundaries between data-access adapters, visitor/session transport concerns, and exported React Native SDK hooks/components.

### Modified Capabilities
- `mobile-sdk-public-hook-ergonomics`: Clarify that public hook ergonomics depend on stable internal boundaries rather than direct generated Convex hook usage across exported modules.

## Impact

- Affected code: `packages/react-native-sdk/src/hooks/**`, selected exported components/controllers, and internal SDK helpers around visitor/session/config resolution.
- Affected contributors: SDK maintainers and mobile integrators evolving the React Native SDK API.
- Dependencies: no external dependency changes; internal SDK module boundaries and local typing conventions will change.
