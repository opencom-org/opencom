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

### P0 (critical before production confidence)

<!-- - [ ] Split up / simplify the settings page - maybe colocate settings with their corresponding functionality -->
<!-- - [ ] Fix inbox chat responsiveness (header bar buttons row) -->
<!-- - [ ] ai handoff happening too frequently -->
- [ ] make deploy of web and landing and updates to app stores dependent on successful convex deploy, otherwise the apps will be speaking to an old version of our convex functions
- [ ] Merge some sidebar items
- [ ] check email campaign setup
- [ ] check series setup
- [ ] edit app store description for License to AGPLv3
- [ ] do we need a way for users to fix versions to avoid potentially breaking changes? How would we do that - would it be just the widget JS, the convex backend too, anything else? 
- [ ] SSO, SAML, OIDC, and granular role-based access controls 
- [ ] Lets add an option for admins so they can set the  /// 
- [ ] merge internal articles into regular articles, and add a toggle per article for internal vs public? or equivalent. Perhaps collection based, or article based, needs more thought. (can then remove the Knowledge page)
- [ ] should snippets be accessible from inbox, rather than its own panel?
- [ ] improved inbox management (sorting, filtering etc.)
- [ ] dont allow requesting human support multiple times in a row on same chat
- [ ] "resolve visitor from expression - session expired" - are we handling refresh properly?
- [p] maintain message state in mobile app when switching apps
- [ ] Fix CI e2e
- [ ] telegram feedback
  - [p] chat attachments
  - [p] can we make the email collection component shown after sending a message less obtrusive - Maybe it can descend from the top bar, rather than from the bottom where it covers the latest message. then maybe we can leave it there until filled in without a skip button, but just have it take up less space so its not in the way? 
    - [ ] in the current set up, if skipped, dont re-ask for their email each time - give them a subtle affordance where they can add their email if they change their mind
  - [ ] showcase the dashboard on the landing app?
  - [p] API for headless management
- [ ] publish RN-SDK to npm (anything else need publishing? or web etc is fine since users just use JS snippet for install)
- [ ] paid plan
  - [ ] what pricing model - one off fee? Limited free tier? PAYG for AI & email credits? + options for BYOKs? Start simple and add complexity - $49/month (with generous fair usage limits - if people approach limits, I will set up PAYG for powerusers to cover edge cases)? 
- [ ] AI updates
  - [ ] BYOK for AI in hosted / paid plan
  - [ ] pull available models from provider API and display them in the settings UI to control which model is used
  - [ ] allow customising the agent's system prompt? 
- [p] a CI AI agent to check for any doc drift and update docs based on the latest code
- [ ] convert supportAttachments.finalizeUpload into an action + internal mutation pipeline so we can add real signature checks too. The current finalizeUpload boundary is a Convex mutation and ctx.storage.get() is only available in actions. Doing true magic-byte validation would need a larger refactor of that finalize flow.
- [ ] add URL param deep links for the widget - Go to a url like ?open-widget-tab=home to open the widget to that tab, etc. 
- [ ] make web admin chat input field multi line, with scrollbar when needed (currently single line max)

  apps/web/src/app/outbound/[id]/OutboundTriggerPanel.tsx
Comment on lines +67 to 71
              value={value.delaySeconds ?? 5}
              onChange={(e) =>
                onChange({ ...value, delaySeconds: Number.parseInt(e.target.value, 10) })
                onChange({ ...value, delaySeconds: parseOptionalInteger(e.target.value) })
              }
              min={1}
Switching from || to ?? means a value of 0 will now be treated as valid and shown in the number input, even though the input has min={1}. Consider normalizing/clamping parsed values (e.g., treat <= 0 as undefined/default) to avoid persisting an invalid delaySeconds state.




- [p] Check AI chat / article suggestions setup is working
  - [p] Add links to relevant help center articles in the widget AI responses, and maybe in chat (suggested articles)
- [p] deploy necessary packages to NPM or Github and fix instructions for Mobile SDK install (npm package + release pipeline)
- [p] AI Autotranslate for speaking to people in any language
- [p] make mobile app match inbox functionality (understand AI review, which messages were sent by AI, visitors list and details/navigation flows)
<!-- - [ ] make sure AI responses that result in a handoff are still stored and tracked so they can be seen in AI review to understand what the full response was from the AI that resulted in the handoff -->
<!-- - [ ] expandable size widget like intercom - make it big for reading articles etc. -->
<!-- - [ ] Import feature for docs / help center, so you can keep a folder of markdown anywhere outside of Opencom that you edit and maintain, and upload it to opencom to sync latest changes while keeping folder structure (as collections), etc. Test it by uploading a folder of markdown files to opencom (e.g. our docs folder) and then opening the help center to see if it works. Consider how to handle reuploading the folder - should overwrite duplicates, add new files, etc. We should maintain a history also in case they accidentally delete a folder. We should have allow uploading subfolders of a folder, so where you upload the folder will matter (e.g. root folder vs subfolder) -->
<!-- - [ ] add notification count to inbox tile in sidebar for admins, and play bing sound on new messages.  -->
- [ ] ensure domain validation is working
  - 2/27/2026, 11:45:52 AM [CONVEX M(widgetSessions:boot)] Uncaught Error: Origin validation failed: Origin not in allowed list
    at requireValidOrigin (../../convex/originValidation.ts:116:0)
    at async handler (../../convex/widgetSessions.ts:119:4)
<!-- - [ ] triggering tour from widget should close widget before/when starting the tour -->
<!-- - [ ] didnt reply first time ai agent -->
<!-- - [ ] dont ask if you want to be connected with an agent when doing it, just do it -->
<!-- - [ ] Dont create new chats when an existing new chat is open. Reopen the existing empty chat instead. -->
<!-- - [ ] create persona for the human responding to make more personal, like the AI agent has a little name and icon, the human agent should have a name and icon too
- [ ] when I interact with a chat that has new responses, then I exit the chat, the messages I have seen should be marked as read not unread -->
<!-- - [ ] make the messages render markdown properly (new lines, etc.) - ideally use a preexisting implementation rather than building from scratch -->

- [ ] featurebase feature exploration
  - [ ] learn from featurebase docs and site for landing app
  - [ ] slick animations
  - [ ] suggested queries / replies for visitors



- [ ] offer JWT identity verification as alternative to HMAC? 
- [ ] ensure HMAC identity verification is working on landing page setup
- [ ] switch to https://github.com/axelmarciano/expo-open-ota if EAS MAU costs become an issue

- [ ] **(P0 | 0.95)** Finalize Convex integration:
  - CI for Convex functions on push.
  - set up proper CI strategy (preview branches on vercel and convex? Multiple vs single release branches?)

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

RN & Native SDKs 
  Installation
  Configuration
  Using Opencom
  Help Center
  Push Notifications
  Secure Your Messenger
  Deep Linking
  Identity Verification
  Supported Versions
  Data Hosting Region Configuration
  Code Samples

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
- [ ] What is required for Production Readiness, vs nice-to-haves?




I followed the AGENTS.md memory/instructions (focused, repo-scoped audit with PNPM-era conventions) and used jcodemunch + repo grep to map this.

1) Manual makeFunctionReference hotspots

RAG-follow-up critical

packages/convex/convex/aiAgentActionsKnowledge.ts:45 (GET_CONTENT_BY_ID_REF)
packages/convex/convex/aiAgentActionsKnowledge.ts:54 (GET_EMBEDDING_BY_ID_REF)
packages/convex/convex/aiAgentActions.ts:162 (GET_RELEVANT_KNOWLEDGE_FOR_RUNTIME_ACTION_REF)
packages/convex/convex/embeddings.ts:172 (GENERATE_BATCH_INTERNAL_REF)
packages/convex/convex/embeddings.ts:137 (LIST_BY_CONTENT_REF) and adjacent refs used in embedding pipeline
Broader repo hotspots (same pattern)

packages/convex/convex/notifications/functionRefs.ts
packages/convex/convex/push/functionRefs.ts
packages/convex/convex/series/scheduler.ts
packages/convex/convex/pushCampaigns.ts
packages/convex/convex/testing/helpers/notifications.ts
packages/convex/convex/emailChannel.ts
packages/convex/convex/embeddings/functionRefs.ts
packages/convex/convex/carousels/triggering.ts
packages/convex/convex/events.ts
packages/convex/convex/http.ts
packages/convex/convex/outboundMessages.ts
packages/convex/convex/snippets.ts
packages/convex/convex/testAdmin.ts
packages/convex/convex/visitors/mutations.ts
packages/convex/convex/widgetSessions.ts
packages/convex/convex/workspaceMembers.ts
packages/convex/convex/tickets.ts
2) as unknown as reduction targets

Immediate (RAG path)

packages/convex/convex/aiAgentActionsKnowledge.ts:39
packages/convex/convex/aiAgentActionsKnowledge.ts:49
packages/convex/convex/aiAgentActionsKnowledge.ts:58
packages/convex/convex/aiAgentActions.ts:123
packages/convex/convex/aiAgentActions.ts:155
packages/convex/convex/aiAgentActions.ts:172
packages/convex/convex/aiAgentActions.ts:189
packages/convex/convex/embeddings.ts:30
packages/convex/convex/embeddings.ts:37
packages/convex/convex/embeddings.ts:44
packages/convex/convex/embeddings.ts:123
packages/convex/convex/embeddings.ts:176
Full broader set

Same file list as section 1 (19 Convex files matched for makeFunctionReference ... as unknown as).
3) Batching/perf refactor sites

packages/convex/convex/embeddings.ts:371 (generateBatch loops serially over args.items)
packages/convex/convex/embeddings.ts:465 (backfillExisting runs batch chunks sequentially)
packages/convex/convex/embeddings.ts:509 (generateBatchInternal loops serially over args.items)
These are the concrete places to introduce concurrency-limited parallelism / true batched embedding work.

4) SDK route migration sites (getRelevantKnowledge old query path)

Source

packages/sdk-core/src/api/aiAgent.ts:12 (aiAgent:getRelevantKnowledge ref)
packages/sdk-core/src/api/aiAgent.ts:76 (getRelevantKnowledge exported function)
packages/sdk-core/src/api/aiAgent.ts:83 (client.query(GET_RELEVANT_KNOWLEDGE_REF, ...))
Tests/contracts expecting old route

packages/sdk-core/tests/contracts.test.ts:478
packages/sdk-core/tests/api.test.ts:56
packages/sdk-core/tests/api.test.ts:150
Backend fallback currently kept for compatibility

packages/convex/convex/aiAgent.ts:318 (getRelevantKnowledge public query)
If you want, I can turn this into a prioritized migration checklist (P0/P1/P2) with exact replacement strategy per file.

