# Opencom OSS Documentation Hub

This directory is the canonical home for contributor, self-hosting, security,
testing, and release-readiness docs.

If you start from root docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`),
this is the next stop.

## Start Here by Role

- **Contributor**: [`./testing-and-verification.md`](./testing-and-verification.md) and [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)
- **Self-hoster / operator**: [`./setup-self-host-and-deploy.md`](./setup-self-host-and-deploy.md) and [`./security-and-operations.md`](./security-and-operations.md)
- **SDK integrator**: [`../widget-sdk.md`](../widget-sdk.md) and [`../mobile-sdks.md`](../mobile-sdks.md)
- **Maintainer / release owner**: [`./source-of-truth.md`](./source-of-truth.md) and [`./security-and-operations.md`](./security-and-operations.md)

## Documentation Map

### OSS Hub (this directory)

| Domain                                          | Canonical document                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Architecture and repository layout              | [`./architecture-and-repo-map.md`](./architecture-and-repo-map.md)   |
| Setup, self-hosting, deployment paths           | [`./setup-self-host-and-deploy.md`](./setup-self-host-and-deploy.md) |
| Testing and verification flows                  | [`./testing-and-verification.md`](./testing-and-verification.md)     |
| Security controls and operational readiness     | [`./security-and-operations.md`](./security-and-operations.md)       |
| Documentation ownership / source-of-truth model | [`./source-of-truth.md`](./source-of-truth.md)                       |

### Reference Documentation (`docs/`)

| Domain                                      | Canonical document                                                 |
| ------------------------------------------- | ------------------------------------------------------------------ |
| System architecture and data flows          | [`../architecture.md`](../architecture.md)                         |
| Database schema (50+ tables)                | [`../data-model.md`](../data-model.md)                             |
| Backend API reference (Convex functions)    | [`../api-reference.md`](../api-reference.md)                       |
| Widget SDK reference (client-side JS API)   | [`../widget-sdk.md`](../widget-sdk.md)                             |
| Mobile SDK reference (RN, iOS, Android)     | [`../mobile-sdks.md`](../mobile-sdks.md)                           |
| Security deep dive (RBAC, HMAC, auth model) | [`../security.md`](../security.md)                                 |
| Testing guide (unit, integration, E2E, CI)  | [`../testing.md`](../testing.md)                                   |
| Scripts reference (build, deploy, security) | [`../scripts-reference.md`](../scripts-reference.md)               |
| Feature audit and inventory                 | [`../feature-audit.md`](../feature-audit.md)                       |
| Survey delivery contract                    | [`../survey-delivery-contract.md`](../survey-delivery-contract.md) |

## Documentation Maintenance Contract

### Source-of-truth precedence

1. **Runtime behavior and command contracts**: code and scripts (`apps/**`, `packages/**`, `scripts/**`, root/package `package.json`)
2. **Curated guidance**: this hub and root docs

If docs conflict with runtime code/scripts, update docs immediately and treat
code/scripts as authoritative.

### Update triggers

Update this hub and linked root docs when any of the following changes:

- command names or script behavior
- environment variable usage or required/optional semantics
- auth/security boundaries, webhook behavior, CORS behavior, or release operations policy

### Verification checklist

After documentation updates:

1. Validate command references against root and package `package.json` scripts.
2. Validate environment variables against source usage and `.env` examples.
3. Ensure root docs link to this hub and avoid conflicting duplicate guidance.

For a detailed ownership matrix and repeatable checklist, use
[`./source-of-truth.md`](./source-of-truth.md).
