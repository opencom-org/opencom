# Opencom Roadmap

Last reviewed: 2026-02-23

Goal: ship a professional open-source customer messaging platform with strong defaults for both hosted and self-hosted users.

## Primary Scope

- Chat and inbox
- Product guidance (tours, tooltips, carousels, checklists)
- Knowledge base/help center
- Mobile apps + React Native SDK + push notifications
- Secure widget embedding (origin allowlist + identity verification)

## Prioritized TODO (with certainty)

### P0 (critical before OSS copy / production confidence)

- [ ] **(P0 | 0.95)** Finalize Convex integration:
  - CI for Convex functions on push.
  - set up proper CI strategy (preview branches on vercel and convex? Multiple vs single release branches?)

- [ ] Split up / simplify the settings page - maybe colocate settings with their corresponding functionality

- [ ] **(P0 | 0.90)** Finalize auth edge cases across web + mobile:
  - Password attempt should gracefully route to OTP flow when account is OTP-only.
  - Invite links should prefill email on both login and signup.
  - Decide and enforce final OTP behavior (single merged flow vs explicit sign-in/sign-up separation).

- [ ] **(P0 | 0.95)** Change visitor conversation lifecycle:
  - Do not create a new conversation thread until the visitor sends first message.
  - Replace current automatic intro-thread creation behavior.

- [ ] **(P0 | 0.85)** Run deployed security verification matrix:
  - Domain allowlist behavior on real deployed URLs.
  - HMAC identity verification in required/optional modes.
  - Alternative backend URL behavior and widget CDN loader behavior.

- [ ] **(P0 | 0.80)** Define release-gate E2E coverage and close remaining gaps:
  - Keep existing broad suite, then enforce a minimal "must-pass" matrix for OSS release quality.

### P1 (high priority)

- [ ] **(P1 | 0.80)** Multi-workspace QA matrix (web, mobile, widget):
  - Join/switch/create workflows
  - Permissions/role boundaries
  - Workspace-scoped settings and data isolation

- [ ] **(P1 | 0.82)** Widget blocking scheduler regression coverage (target: Friday, 2026-02-27):
  - Add E2E scenario that seeds tour + outbound post + large survey simultaneously.
  - Assert strict blocker order in runtime: tour -> outbound post -> large survey.
  - Assert deferred blockers are not counted as shown until visible.
  - Assert queue release paths: complete/dismiss for each blocker type.
  - Add compact/mobile viewport variant to catch stacking/pointer interaction regressions.

- [ ] **(P1 | 0.75)** Admin web responsiveness pass:
  - Ensure key pages are reliable on smaller laptop widths and tablets.

- [ ] **(P1 | 0.75)** Mobile chat parity verification:
  - Confirm conversation flows, notifications, deep links, and workspace switching in real devices.

- [ ] **(P1 | 0.70)** Hosted vs self-hosted product boundary documentation:
  - Clear support limits, cost controls (especially outbound email), abuse controls, and recommended deployment paths.

- [ ] **(P1 | 0.70)** Final OSS documentation polish:
  - README quickstart flow
  - setup/deploy cross-links
  - public-facing docs consistency

### P2 (important, can follow initial OSS publication)

- [ ] **(P2 | 0.70)** Productize user profile/session surfaces:
  - Editable user profile UX
  - Session activity visibility where useful

- [ ] **(P2 | 0.70)** Improve mobile distribution readiness:
  - App store submission process
  - Android large-screen/orientation policy compliance
  - Android 15+ deprecated window/status API follow-up

- [ ] **(P2 | 0.65)** React Native SDK integration demo hardening:
  - Keep example app as first-class reference implementation.

- [ ] **(P2 | 0.60)** AI assistant roadmap:
  - Better answer quality, context strategy, handoff rules, and evaluation prompts.

## Intercom-Parity Status Snapshot

- [x] Inbox
- [x] Help Center
- [~] Tickets (implemented baseline; continue hardening and full parity)
- [~] Workflows/automation settings (implemented baseline; continue parity)
- [~] Omnichannel/Email channel (implemented baseline; continue parity)
- [~] Reporting (implemented baseline; continue parity)
- [~] Outbound campaigns (implemented baseline; continue parity)
- [~] Surveys (implemented baseline; continue parity)
- [ ] Copilot (planned)
- [ ] Apps/integrations marketplace (planned)

Legend: `[x]` complete, `[~]` present but still maturing, `[ ]` not yet implemented.

## Completed Recently (Archived)

- [x] Upgraded major frontend stack to Next.js 15 and React 19 across web/landing/widget.
- [x] Added widget visual preview surfaces in web app (`/widget-preview` and `/widget-demo`).
- [x] Implemented widget styling customization in admin (colors, home cards, messenger/home settings).
- [x] Added domain origin validation and allowlist enforcement paths.
- [x] Added HMAC identity verification controls and server verification path.
- [x] Improved chat/widget UI quality and email capture timing.
- [x] Added multi-user workspace support, invites, and role-based management.
- [x] Added broad Playwright coverage with parallel-worker auth strategy.
- [x] Added public help center routes and privacy policy page.
- [x] Added notification infrastructure (email/push routing) with workspace/member preferences.
- [x] Added workspace switching flows in web and mobile settings.
- [x] Added setup/deploy/open-source documentation structure and canonical deployment guides.

## Open Questions (to resolve explicitly)

- [ ] Should OTP be the only default path for new users, with password optional?
- [ ] How strict should hosted-tier limits be for email campaigns and push usage?
- [ ] What exact feature set is required for "v1 OSS release" vs "post-release roadmap"?
