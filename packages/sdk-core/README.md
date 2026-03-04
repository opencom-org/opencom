# @opencom/sdk-core

Shared runtime utilities and backend API client primitives used by Opencom SDK packages.

## Installation

```bash
pnpm add @opencom/sdk-core @opencom/convex
```

## Convex Compatibility

This package validates backend contract compatibility using:

- `assertConvexContractCompatibility(version)`
- `discoverBackendContractVersion(convexUrl)`

Supported contract range is declared in `package.json` under
`opencom.release.convexCompatibility`.
