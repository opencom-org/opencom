## Why

Web admin pages repeatedly implement their own async save/delete flows, confirmation prompts, and unknown error handling. This duplication increases maintenance cost, causes UX drift between pages, and makes new admin surfaces harder to implement consistently.

## What Changes

- Standardize shared async action, delete confirmation, and error feedback orchestration for covered web admin flows.
- Replace repeated page-level save/delete boilerplate with reusable web admin hooks or utilities.
- Ensure covered admin routes use shared non-blocking feedback and confirmation behavior instead of bespoke inline implementations.
- Preserve current mutation targets, payload semantics, and user-visible workflow outcomes while consolidating shared control flow.

## Capabilities

### New Capabilities
- `web-admin-action-flow-standardization`: Covers reusable orchestration for async admin actions, delete confirmations, and save/error state handling across covered web admin pages.

### Modified Capabilities
- `frontend-error-feedback-standardization`: Extend covered paths to include more web admin save/delete flows that currently use bespoke inline handling.

## Impact

- Affected code: repeated `appConfirm(...)` and async mutation patterns across `apps/web/src/app/**/page.tsx` and local admin components.
- Affected contributors: anyone adding or updating save/delete flows in the web admin.
- Dependencies: no external package changes; shared frontend utilities/hooks will be introduced or expanded.
