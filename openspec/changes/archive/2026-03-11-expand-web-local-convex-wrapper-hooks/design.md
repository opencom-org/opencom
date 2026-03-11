## Context

The archived `introduce-web-local-convex-wrapper-hooks` change established the local wrapper pattern for selected web domains, but the March 11, 2026 scan still found direct `convex/react` imports in the following remaining web modules:

- route and page modules
  - `apps/web/src/app/campaigns/email/[id]/page.tsx`
  - `apps/web/src/app/help/[slug]/page.tsx`
  - `apps/web/src/app/help/page.tsx`
  - `apps/web/src/app/inbox/InboxConversationListPane.tsx`
  - `apps/web/src/app/onboarding/page.tsx`
  - `apps/web/src/app/outbound/page.tsx`
  - `apps/web/src/app/reports/ai/page.tsx`
  - `apps/web/src/app/reports/conversations/page.tsx`
  - `apps/web/src/app/reports/csat/page.tsx`
  - `apps/web/src/app/reports/page.tsx`
  - `apps/web/src/app/reports/team/page.tsx`
  - `apps/web/src/app/segments/page.tsx`
  - `apps/web/src/app/snippets/page.tsx`
  - `apps/web/src/app/surveys/[id]/page.tsx`
  - `apps/web/src/app/surveys/page.tsx`
  - `apps/web/src/app/tickets/[id]/page.tsx`
  - `apps/web/src/app/tickets/forms/page.tsx`
  - `apps/web/src/app/tickets/page.tsx`
  - `apps/web/src/app/tours/[id]/page.tsx`
  - `apps/web/src/app/tours/page.tsx`
  - `apps/web/src/app/visitors/[id]/page.tsx`
  - `apps/web/src/app/visitors/page.tsx`
- settings, shared components, and contexts
  - `apps/web/src/app/settings/AIAgentSection.tsx`
  - `apps/web/src/app/settings/AuditLogViewer.tsx`
  - `apps/web/src/app/settings/AutomationSettingsSection.tsx`
  - `apps/web/src/app/settings/HomeSettingsSection.tsx`
  - `apps/web/src/app/settings/MobileDevicesSection.tsx`
  - `apps/web/src/app/settings/NotificationSettingsSection.tsx`
  - `apps/web/src/app/settings/SecurityIdentitySettingsCard.tsx`
  - `apps/web/src/app/settings/SecuritySettingsSection.tsx`
  - `apps/web/src/app/settings/SignedSessionsSettings.tsx`
  - `apps/web/src/app/settings/useTeamMembersSettings.ts`
  - `apps/web/src/components/AppSidebar.tsx`
  - `apps/web/src/components/AudienceRuleBuilder.tsx`
  - `apps/web/src/components/SuggestionsPanel.tsx`
  - `apps/web/src/components/WorkspaceSelector.tsx`
  - `apps/web/src/contexts/AuthContext.tsx`

The scan also found direct imports in explicit infrastructure or test boundaries:

- `apps/web/src/components/convex-provider.tsx`
- `apps/web/src/lib/convex/hooks.ts`
- `apps/web/src/app/settings/MessengerSettingsSection.test.tsx`
- `apps/web/src/app/typeHardeningGuard.test.ts`

Those four files are acceptable boundaries if they remain provider, adapter, or test infrastructure rather than application feature modules.

## Goals / Non-Goals

**Goals:**

- Expand local wrapper coverage to the remaining scanned web routes, shared components, and contexts.
- Keep direct `convex/react` imports limited to explicit provider, adapter, and test boundaries after the migration.
- Preserve current route/controller behavior and page-level user experience.
- Extend hardening guard coverage so the March 11, 2026 inventory stays explicit.

**Non-Goals:**

- Rewriting the existing provider or low-level adapter modules that are supposed to own direct Convex hook usage.
- Changing backend contracts or user-visible behavior in tours, surveys, tickets, visitors, reports, settings, help, or onboarding flows.
- Migrating every existing test mock to a wrapper-only model if direct hook mocking remains the right test boundary.

## Decisions

### 1) Migrate by domain clusters, not one file at a time

Decision:

- Group the remaining web modules into domain clusters: auth/onboarding/help/shared components, reporting and visitors, settings, and CRUD admin routes such as tours, surveys, tickets, and campaigns.
- Use controller hooks where route composition is already complex, instead of forcing every page to wire several wrapper hooks inline.

Rationale:

- The remaining inventory is broad enough that single-file migrations would create a lot of duplicated setup.
- The archived pattern already allows controller-hook composition for large routes.

Alternatives considered:

- Migrate each remaining file independently. Rejected because many of the remaining pages share the same wrapper and gating concerns.

### 2) Keep approved direct-import exceptions explicit

Decision:

- Treat `components/convex-provider.tsx`, `lib/convex/hooks.ts`, and targeted test files as the only accepted direct `convex/react` boundaries during this change unless another explicit infrastructure exception is added deliberately.

Rationale:

- The remaining issue is feature-level direct usage, not provider/bootstrap or test harness code.

### 3) Expand guard coverage alongside wrapper adoption

Decision:

- Update the web hardening guard to pin the remaining scanned inventory so regressions are visible once the new clusters migrate.

Rationale:

- This keeps the change from becoming a one-time cleanup with no anti-regression protection.

### 4) Reuse existing local adapter primitives where possible

Decision:

- Build on `apps/web/src/lib/convex/hooks.ts` and the existing archived wrapper conventions rather than inventing a second local adapter pattern.

Rationale:

- The repo already has a working local wrapper architecture for covered web domains. The remaining work is extension, not reinvention.

## Risks / Trade-offs

- [Risk] Broad route migrations could accidentally change loading or permission gating semantics.
  - Mitigation: preserve existing route/controller behavior and validate touched domains with targeted web tests plus typecheck.
- [Risk] Settings and shared component migrations could blur ownership between domain wrappers and presentation components.
  - Mitigation: keep wrappers responsible for transport details and let components remain focused on composition and UI state.
- [Risk] Guard inventory could drift if new feature files appear during the migration.
  - Mitigation: freeze the current scan inventory first and update it deliberately if new files are added during implementation.

## Migration Plan

1. Freeze the March 11, 2026 web inventory and record the allowed direct-import exceptions.
2. Add or extend wrapper/controller coverage for auth, onboarding, help, shared components, reporting, and visitors.
3. Migrate the remaining settings sections and shared settings hooks.
4. Migrate remaining tours, surveys, tickets, snippets, segments, campaigns email, and outbound routes.
5. Update web hardening guard coverage and any touched tests.
6. Run `pnpm --filter @opencom/web typecheck`, targeted web tests, and strict OpenSpec validation.

Rollback:

- Revert only the current domain cluster if wrapper extraction changes route behavior. Do not widen the allowed direct-import exception list just to get a failing batch through.

## Open Questions

- Should `apps/web/src/contexts/AuthContext.tsx` stay a context-owned consumer that composes wrapper hooks, or should it move to a dedicated controller module once the wrapper boundary exists?
