# Security and Operations Guide

This document is the OSS-facing security and operations entrypoint.

For deep security internals, see `docs/security.md`.

## Security Boundaries

Opencom has two primary runtime trust boundaries:

1. **Agent/admin boundary**
   - authenticated via Convex auth session
   - permission-checked via workspace membership + role permissions
2. **Visitor boundary**
   - authenticated via signed `sessionToken` for visitor-facing APIs
   - ownership-validated against workspace and visitor identity

Key implementation surfaces:

- `packages/convex/convex/authConvex.ts`
- `packages/convex/convex/permissions.ts`
- `packages/convex/convex/http.ts`
- `packages/convex/convex/emailChannel.ts`
- `packages/convex/convex/testAdmin.ts`
- `packages/convex/convex/testData.ts`

## Webhook and Email Security

Webhook processing routes live in `packages/convex/convex/http.ts` and use:

- signature verification (`RESEND_WEBHOOK_SECRET`)
- optional internal-secret gate (`EMAIL_WEBHOOK_INTERNAL_SECRET`)
- fail-closed toggle (`ENFORCE_WEBHOOK_SIGNATURES`, defaults to enabled)
- replay-window guard (`WEBHOOK_MAX_AGE_SECONDS`, defaults to `300`)

Operational expectation for production:

- configure webhook signature secret
- keep signature enforcement enabled
- configure an explicit internal secret for webhook-only handlers

## CORS and Public Discovery Route

Public backend metadata route:

- `/.well-known/opencom.json` in `packages/convex/convex/http.ts`

Production behavior expectation:

- set `OPENCOM_PUBLIC_CORS_ORIGINS` to explicit web origins
- when unset, route defaults to localhost/127.0.0.1 allowlist only

## Test-Only Mutation Boundary

Test mutations are internal-only and exposed externally only through controlled gateway action:

- gateway: `testAdmin:runTestMutation` (`packages/convex/convex/testAdmin.ts`)
- required secret: `TEST_ADMIN_SECRET`
- gated data mutations require `ALLOW_TEST_DATA=true`

Do not enable test-data mutation flags in production deployments.

## Notification Routing Safety Controls

Notification fanout is governed by explicit routing controls:

- canonical event normalization (`notificationEvents`)
- per-recipient/channel idempotency keys (`notificationDedupeKeys`)
- suppression and failure telemetry (`notificationDeliveries`)
- workspace/member/token preference layering (`workspaceNotificationDefaults`, `notificationPreferences`, token enablement flags)

Operational expectation: avoid direct transport sends that bypass routing,
deduplication, and delivery telemetry persistence.

## Visitor Merge Auditability

Visitor identity merges triggered by email matching are auditable through
`auditLogs` (`action: "visitor.merged"`), including source/target IDs and
merge timestamp metadata. This trace is required for support/debug review of
conversation ownership history after identity merges.

## CI Supply Chain Policy (GitHub Actions)

Repository workflows must pin third-party GitHub Actions to immutable commit
SHAs (not floating tags alone), and pin updates should include nearby
traceability comments to the upstream release/source used during selection.

## Release Operations Baseline

Use the verification commands below as the minimum release baseline.
Capture decision/evidence artifacts in your release process tooling.

## Mandatory Verification Commands

Run from repository root:

```bash
pnpm lint
pnpm typecheck
pnpm security:secret-scan
pnpm security:headers-check
pnpm security:convex-auth-guard
pnpm security:convex-any-args-gate
pnpm --filter @opencom/convex test
pnpm web:test:e2e
```

## Incident and Vulnerability Reporting

- Security contact and disclosure policy: root `SECURITY.md`
- Keep active vulnerabilities private until coordinated disclosure is complete.

## Related Docs

- Setup and env contracts: [`./setup-self-host-and-deploy.md`](./setup-self-host-and-deploy.md)
- Testing and verification: [`./testing-and-verification.md`](./testing-and-verification.md)
- Ownership/source-of-truth model: [`./source-of-truth.md`](./source-of-truth.md)
