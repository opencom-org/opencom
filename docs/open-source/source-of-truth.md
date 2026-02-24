# Documentation Source-of-Truth Contract

This document defines where documentation truth lives and how to keep it
synchronized with runtime code and scripts.

## Precedence Model

When two sources disagree, use this precedence order:

1. **Runtime/code truth**
   - Application/runtime code under `apps/**` and `packages/**`
   - Automation scripts under `scripts/**`
   - Command contracts in root and package `package.json`
2. **Curated docs truth**
   - Root entry docs (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`)
   - OSS hub docs under `docs/open-source/**`
   - Supporting docs in `docs/**`

## Canonical Ownership Matrix

| Concern                                       | Canonical source                                                                                                 | Maintainer-facing docs                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Workspace scripts and command names           | root `package.json`, package `package.json` files                                                                | `docs/open-source/testing-and-verification.md`, `README.md` |
| Convex runtime behavior and security controls | `packages/convex/convex/**`                                                                                      | `docs/open-source/security-and-operations.md`               |
| Frontend/backend connection behavior          | `apps/web/src/contexts/BackendContext.tsx`, `apps/mobile/src/contexts/BackendContext.tsx`                        | `docs/open-source/setup-self-host-and-deploy.md`            |
| Widget runtime contract                       | `apps/widget/src/**`                                                                                             | `docs/open-source/architecture-and-repo-map.md`             |
| Deployment scripts                            | `scripts/setup.sh`, `scripts/update-env.sh`, `scripts/build-widget-for-tests.sh`, `scripts/deploy-widget-cdn.sh` | `docs/open-source/setup-self-host-and-deploy.md`            |
| OSS release operations process                | `docs/open-source/security-and-operations.md`                                                                    | `docs/open-source/security-and-operations.md`               |

## Update Triggers

Update docs when any of these happen:

- command/script names change
- env var names or semantics (required/optional) change
- security boundary, auth, webhook, or CORS behavior changes
- release operations policy changes

## Required Verification Before Marking Docs Done

Run from repo root unless noted:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @opencom/convex typecheck
pnpm --filter @opencom/web typecheck
pnpm --filter @opencom/mobile typecheck
pnpm --filter @opencom/widget typecheck
```

Focused checks for touched test surfaces:

```bash
pnpm --filter @opencom/convex test -- --run tests/<file>.test.ts
pnpm --filter @opencom/web test
pnpm playwright test apps/web/e2e/<spec>.ts --project=chromium
```

## Drift-Prevention Checklist

Use this checklist in doc updates and PR review:

- [ ] Every documented command exists in scripts or package-scoped command context
- [ ] Environment-variable tables reflect actual names in source and examples
- [ ] Required vs optional semantics are explicitly stated
- [ ] Root docs link to OSS hub for canonical detail
- [ ] Any status claim cites a concrete file or command output date
