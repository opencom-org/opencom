# Public Package Matrix

This matrix is the source of truth for npm publication scope.

## Portfolio Inventory

| Package | Scope | Support tier | Owner | Channels | Notes |
| --- | --- | --- | --- | --- | --- |
| `@opencom/convex` | public-supported | supported | Backend Team | `latest`, `next` | Generated contract package for public SDK consumers |
| `@opencom/sdk-core` | public-supported | supported | SDK Team | `latest`, `next` | Shared runtime + API client for SDK surfaces |
| `@opencom/react-native-sdk` | public-supported | supported | Mobile SDK Team | `latest`, `next` | React Native public SDK |
| `@opencom/types` | internal-only | internal | Core Platform Team | none | Monorepo internal types |
| `@opencom/ui` | internal-only | internal | Web Team | none | Monorepo internal UI system |
| `@opencom/web` | internal-only | internal | Web Team | none | Product app (not an npm SDK) |
| `@opencom/mobile` | internal-only | internal | Mobile App Team | none | Product app (not an npm SDK) |
| `@opencom/widget` | internal-only | internal | Widget Team | none | Bundled runtime, CDN delivery path |
| `@opencom/landing` | internal-only | internal | Growth Team | none | Site app (not an npm SDK) |

## First Release Cohort

1. `@opencom/convex`
2. `@opencom/sdk-core`
3. `@opencom/react-native-sdk`

## Dependency Resolution Strategy (First Cohort)

- Public cohort manifests MUST use registry-resolvable semver ranges only (no `workspace:*`).
- Public cohort packages MUST set `private: false`, `publishConfig.access: "public"`, explicit `files`, and explicit `exports`.
- Convex contract dependency path:
  - `@opencom/react-native-sdk` depends on `@opencom/sdk-core` and `@opencom/convex`.
  - `@opencom/sdk-core` depends on `@opencom/convex`.
- Publish topology is fixed to: `@opencom/convex` -> `@opencom/sdk-core` -> `@opencom/react-native-sdk`.

## Support Commitments

- Stable channel (`latest`):
  - maintain current major line plus previous major line for critical fixes.
  - critical fix support window: 180 days from next major GA.
- Prerelease channel (`next`):
  - no backward-compatibility guarantee.
  - intended for early adoption and validation only.
