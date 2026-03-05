# Convex Test Data Modules

This directory owns internal test-data seed and cleanup definitions grouped by fixture domain.

## Ownership

- `seeds.ts`: Focused single-feature E2E seed helpers (tour/survey/carousel/outbound/articles/visitor/segment/settings).
- `cleanup.ts`: E2E-prefixed cleanup flows plus aggregate seed/cleanup helpers.
- `demoWorkspace.ts`: Full workspace demo seeding for screenshot and high-fidelity fixture flows.
- `landing.ts`: Landing-page-specific demo cleanup and seeding flows.

## Compatibility

`../testData.ts` remains the compatibility entrypoint for `api.testData.*` while this folder owns module-local fixture definitions.
