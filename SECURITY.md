# Security Policy

## Start With the OSS Security Docs

Use these as the canonical security and operational references:

- OSS security/operations guide: [`docs/open-source/security-and-operations.md`](docs/open-source/security-and-operations.md)
- Platform security deep dive: [`docs/security.md`](docs/security.md)

## Supported Versions

Opencom is under active development. Security fixes are applied to the latest main branch.

## Reporting a Vulnerability

Please report security vulnerabilities privately. Do not open a public issue for active vulnerabilities.

1. Email: security@opencom.dev
2. Include:
   - Affected component(s)
   - Reproduction steps / proof of concept
   - Impact assessment
   - Suggested mitigation (if available)
3. You will receive an acknowledgement within 3 business days.

## Disclosure Process

- We will validate and triage the report.
- We will work on a fix and coordinate disclosure timing with the reporter.
- We may request additional detail for verification.
- Please do not publicly disclose exploit details until a coordinated disclosure window is agreed.

## Scope Notes

- Secrets accidentally committed to the repository should be treated as compromised.
- Production deployments should enforce webhook signature validation and origin allowlists.
- Test-only mutation controls (`ALLOW_TEST_DATA`, `TEST_ADMIN_SECRET`) must never be enabled in production.
