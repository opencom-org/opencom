# Convex Compatibility Contract

Public SDK packages that depend on Convex contracts must declare and validate compatibility explicitly.

## Compatibility Metadata Contract

Package metadata location: `package.json` -> `opencom.release.convexCompatibility`

Required fields:

- `minimum`: minimum supported backend contract version
- `current`: current contract version validated in release checks
- `maximum`: supported upper range (`<major>.x` for a supported major line)

Current first-cohort range:

- minimum: `1.0.0`
- current: `1.0.0`
- maximum: `1.x`

## Where Compatibility Is Surfaced

- Release metadata:
  - package manifests contain declared compatibility range.
  - release checks validate the minimum/current matrix.
- Runtime:
  - React Native SDK initialization attempts to resolve backend contract version via:
    1. explicit `backendContractVersion` in `SDKConfig` (if provided), or
    2. `/.well-known/opencom.json` discovery metadata.
  - Unsupported versions throw deterministic `OpencomConvexCompatibilityError` with code:
    - `OPENCOM_UNSUPPORTED_CONVEX_CONTRACT`

## Release Validation Gate

`scripts/release/validate-convex-compatibility.js` runs package-defined compatibility tests for:

1. minimum supported contract version
2. current supported contract version

The pipeline fails if either matrix entry fails.

## Migration Playbook for Breaking Backend Contract Changes

When backend contracts break SDK assumptions:

1. Evaluate adapter path first:
  - add compatibility adapter/shim in current SDK major line when feasible.
2. If adapter is not feasible:
  - coordinate a major SDK release with backend contract major change.
  - publish migration guide before release.
  - keep older major line in critical-fix support window where possible.
