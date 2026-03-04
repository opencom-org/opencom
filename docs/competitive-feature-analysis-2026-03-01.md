# Competitive Product Feature Analysis (Featurebase, Gleap, Crisp, Chatbase, Intercom)

Date: 2026-03-01

## Scope and method

This analysis is documentation-first.

- Primary sources: official help/docs collections, sitemaps, and API references.
- Goal: build a deep, normalized feature inventory, including subfunctionality.
- Note: where a capability is inferred from API endpoints (eg, `create/update/delete` resources), that means the platform exposes it programmatically; UI parity can vary by plan.

## Executive summary

Across this set, the space splits into three strategic clusters:

1. **Feedback-led product ops**: Featurebase (feedback boards, roadmaps, changelogs, surveys, support inbox + AI).
2. **Support/engagement suites**: Intercom and Crisp (omnichannel inbox + automation + knowledge + outbound + analytics, with stronger channel depth in Intercom).
3. **AI-agent builders**: Chatbase and Gleap (Chatbase = external/customer-facing AI agent deployment; Gleap = SDK-first in-app support/feedback/engagement platform with broad API surface).

Intercom currently has the broadest enterprise-grade breadth in AI, channels, workflow orchestration, and reporting; Featurebase has the strongest feedback+roadmap+changelog unification; Chatbase is strongest in configurable agent actions + deployment connectors; Gleap is strongest in SDK/API-level instrumentation depth; Crisp has strong practical breadth for SMB/mid-market support + AI-assisted operations.

## Product deep dives

### 1) Featurebase

#### Core modules documented

- Feedback & Roadmaps
- Support Platform (Inbox, Messenger, AI agent)
- Help Center
- Changelog
- Surveys
- Users/Segmentation
- Developers (widgets, API, webhooks, auth)
- Integrations
- Branding/Customization
- Privacy/Security

#### Deep feature map

**Feedback management and product planning**

- Feedback boards and portal setup.
- Post lifecycle/statuses, moderation, duplicate merge, bulk edit, metadata/custom fields.
- Voting and comments (including anonymous mode options and permission controls).
- Tagging and AI auto-tag/grouping/summarization.
- Prioritization workflows/framework support.
- Board privacy and access models:
  - read-only boards
  - internal team boards
  - author-only boards
  - company-only boards/posts
  - segmented access boards
- Public portal controls:
  - hide statuses/vote counts/leaderboard
  - theme/menu customization
  - language localization

**Roadmaps and changelogs**

- Dedicated roadmap sharing and privacy controls.
- Changelog creation/editing/backdating.
- Changelog widgets and embedded changelog surfaces.
- Changelog notification emails and email state updates.
- Changelog analytics.
- Multilingual changelog support.

**Surveys**

- Survey widget installation.
- Multiple-question surveys.
- Survey targeting/segmentation.
- Multilingual surveys.
- Survey analytics/results export.

**Support platform (Inbox + Messenger + AI)**

- Messenger setup/customization, multi-language support, multi-brand styling.
- Team inboxes and assignment logic.
- Inbox operations: search/filter/sort/snooze/close/loop teammates.
- SLAs and office-hours/response-time settings.
- Conversation attributes and lead qualification.
- Workflow engine:
  - trigger library (page visit, new message, etc.)
  - branches
  - ordering/prioritization
  - auto-close/auto-reassign
  - fully automated flow controls
- Fibi AI agent:
  - answer-first support
  - custom training content
  - custom actions
  - AI replies/macros
  - AI translations in inbox

**Help center**

- Full help center setup and configuration.
- Manage articles/collections and redirects.
- Import/migrate from other help centers.
- Multiple help centers.
- Custom domains and privacy controls.
- Search-engine indexing controls.
- Article reactions and help center analytics.
- Multilingual help center support.

**Identity, users, and auth**

- Visitors/leads/users model.
- Company grouping and user tags.
- User segmentation and analytics.
- Lead/user merge.
- Web portal SSO and JWT-based auth flows.
- Secure installation and identity verification troubleshooting.

**Developer and extensibility**

- Feedback/changelog/survey widget installs.
- Embedded web portal/mobile embedding.
- Messenger JavaScript API methods.
- SDK auto-authentication and data sync.
- Webhooks.
- Featurebase API.

**Integrations**

- Jira, Linear, ClickUp, Azure DevOps.
- Slack, Discord, GitHub.
- Intercom, Zendesk, HubSpot.
- Segment, Zapier.

**Security/compliance/governance**

- Security FAQ, privacy policy, DPA, subprocessors, cookie/AI policy.
- CSP usage guidance.

---

### 2) Gleap

#### Core modules documented

- Cross-platform SDK suite (web + mobile + hybrid)
- Ticketing and session/visitor management APIs
- Engagement orchestration APIs (multichannel)
- Help center management APIs
- AI content and AI-assisted ticket flows
- Team/project/user/invitation APIs
- Statistics/reporting APIs

#### Deep feature map

**SDK/platform coverage**

Documented SDKs/docs for:

- JavaScript
- React Native
- Flutter
- FlutterFlow
- iOS
- Android
- Ionic Capacitor
- Cordova
- Server/REST API samples

**In-app support and feedback primitives (SDK docs)**

- Feedback button and feedback flows.
- Feature requests.
- Conversations.
- Surveys.
- Checklists.
- Help center embedding.
- Release notes/news.
- Push notifications and in-app push.
- Product tours.
- Widget control/workflow controls.
- User identity and translations/localization.
- Event/page tracking.
- Ticket attributes.
- Tags.
- Custom data and custom actions.
- Console/network logs and session diagnostics.
- Audio recording.
- Replays (web docs).
- CSP/cookies/privacy-oriented implementation docs.
- AI tools and AI chat bar docs.

**Engagement orchestration (API)**

Programmable CRUD and activity/stat surfaces for:

- Banners
- Chat messages
- Checklists
- Cobrowse product tours
- Emails
- Modals
- News articles
- Product tours
- Push notifications
- Surveys (including response export and summarization)
- Tooltips
- WhatsApp messages
- Audience/recipient discovery + engagement stats
- Engagement cloning

**Ticketing/support operations (API)**

- Ticket CRUD + export.
- Tracker tickets.
- Duplicate feature request detection.
- Ticket link/unlink/merge flows.
- Snooze/archive/unarchive.
- Run workflows on tickets.
- Send tickets to integrations.
- Conversation transcript sending.
- Typing/viewing indicators.
- AI draft replies and AI-generated tracker metadata.
- Ticket activity logs + console/network logs retrieval.

**Session/contact intelligence (API)**

- Session CRUD/search/import/export.
- Import sessions from Intercom.
- Session activities/events/checklists.
- Session enrichment connectors (Chargebee/LemonSqueezy/Shopify/Stripe).
- Subscribe/unsubscribe session messaging state.

**Help center and knowledge APIs**

- Help center collections/articles/redirects CRUD.
- Nested collections and publish toggles.
- Search help center articles.
- “Answer help center question” endpoint.
- Source retrieval endpoints for help center content.

**Workspace/team controls (API)**

- Team CRUD.
- Project membership updates.
- Invitation management (project/org/user scopes).
- User role-permission retrieval.
- Unified inbox ticket endpoints.

**Analytics/statistics APIs**

- Statistics charts, heatmaps, lists/raw exports.
- Email client usage/bounce/overview metrics endpoints.

---

### 3) Crisp

#### Core modules documented

- Inbox
- Campaigns
- Automate
- Hugo AI Agent & chatbot
- Knowledge base
- Analytics
- Contacts
- Integrations
- Developers (SDK/API)
- Customization/security/account

#### Deep feature map

**Inbox and team operations**

- Conversation ordering, filtering, custom filters.
- Sub-inboxes and workspace structuring.
- Routing/assignment logic and department routing patterns.
- Keyboard shortcuts and teammate collaboration patterns.
- Conversation participants/CC support patterns.
- Email in inbox, notifications, inbox operational controls.

**AI agent and chatbot (Hugo + bot flows)**

- Hugo AI agent onboarding and migration paths.
- AI routing, escalation, and workflow integration patterns.
- AI topic controls and prompt/instruction tuning.
- AI training on company data.
- Automated inbox handling via AI.
- AI analytics and ROI measurement guidance.
- MCP integration guidance for Hugo.
- Legacy chatbot + new agent migration pathways.

**Campaigns and outbound messaging**

- Automated campaigns and drip-like chatbot/campaign flows.
- Campaign message formatting.
- Recipient limits and deliverability guidance.
- Custom sending domains and SMTP setup.
- Email reputation pool concepts.

**Knowledge base**

- Knowledge base domain and branding controls.
- Reverse proxy and iframe guidance.
- Password protection options.
- Multi-language knowledge base support.
- SEO guidance.
- Rich content embedding (Google Docs/PDF/video).
- Article formatting/custom code controls.
- Migration/import from prior providers.

**Channels and integrations**

- WhatsApp Business integration.
- Facebook Messenger integration.
- Slack/Discord/Trello integrations.
- Salesforce, Shopify, Segment, Zapier integration docs.
- Zendesk migration/integration references (including deprecated guidance).
- Twilio plugin docs.

**Developers and APIs**

- REST API and RTM API docs.
- Chatbox SDK docs.
- Mobile SDK docs (Android, iOS, React Native).
- Plugin development and permission model docs.

**Analytics and instrumentation**

- Crisp Analytics and custom dashboard building.
- Dashboard template import/export.
- GA4/Tag Manager instrumentation docs.
- Facebook Pixel and product analytics pipeline docs (Mixpanel/PostHog/Amplitude patterns).

**Security/compliance and governance**

- SOC 2 and GDPR references.
- Service security overview docs.
- Account/workspace governance and 2FA docs.

---

### 4) Chatbase

#### Core modules documented

- AI agent builder (data + behavior + deployment)
- Chatbot actions framework
- Integrations and channel deployment
- Analytics/activity/contacts
- Developer embedding + control APIs
- API v1/v2 surfaces
- Workspace administration/security

#### Deep feature map

**AI agent setup and quality controls**

- Quick start and best-practices flow.
- Data source ingestion and grounding controls.
- Model comparison and response quality guidance.
- Playground and deployment controls.
- Settings + email settings.

**Action system (core differentiator)**

- Collect leads.
- Escalate to human.
- Web search.
- Slack action.
- Stripe action.
- Salesforce actions.
- Shopify actions.
- Calendly/CAL actions.
- Custom action and custom button primitives.

**Contact and lead operations**

- Contacts API + custom attributes schema.
- Lead retrieval APIs.
- Conversation retrieval APIs.
- Analytics and activity pages for bot performance.

**Distribution and integrations**

Documented integrations include:

- Zendesk, Freshdesk, Zoho Desk
- Intercom, HubSpot, Salesforce
- Slack, WhatsApp, Instagram, Messenger
- Shopify, Stripe
- WordPress, Wix, Webflow, Framer, Bubble, Weebly
- Zapier, Vercel, Viasocket, Sunshine

**Developer controls**

- JavaScript embed and widget control.
- Identity verification.
- Custom domains.
- Custom initial/floating initial messages.
- Client-side custom actions/forms.
- Chatbot event listeners.
- Webhooks.
- API integration guide.

**API surface**

- v1: chatbot CRUD, chat endpoint, conversations/leads/contacts, assets.
- v2: authentication, streaming, pagination, health checks.
- v2 conversation operations + user-conversation endpoints.
- Message feedback update endpoints.

**Workspace administration**

- Workspace settings/usage management.
- Two-factor authentication docs.

---

### 5) Intercom

#### Core modules documented

- Fin AI Agent
- Channels
- Inbox
- Workflows
- Knowledge
- Reports
- Outbound
- Contacts
- Apps & Integrations
- Mobile SDKs
- Security & Privacy

#### Deep feature map

**Fin AI Agent (very broad + deep)**

- Deploy Fin over chat, email, phone/voice.
- Fin procedures/tasks and procedural orchestration.
- Guidance/escalation rules and instruction tuning.
- Fin attributes for downstream workflows/reports/inbox.
- Fin identities/branding and tone controls.
- Fin multilingual support.
- Batch testing/live testing/simulations/previews.
- Fin unresolved question/debug toolchains.
- Fin CSAT/CX score, automation rate, and procedure reporting.
- Data connector + MCP connector support patterns.
- Hand-off to external support tools.

**Channels (omnichannel)**

- Messenger (web/mobile), JS API, custom launcher, language controls.
- Email support channel (including multi-brand email configuration).
- WhatsApp, SMS, phone, Slack, Facebook, Instagram.
- Call recordings/transcripts/call listening.
- Twilio/call-forwarding and phone integration patterns.
- File/image sharing and voice transcription in messenger.

**Inbox and ticketing**

- Unified inbox for conversations + tickets.
- Ticket types: customer, back-office, tracker.
- Assignment models: round-robin, balanced, team/capacity-based.
- SLAs and workload management.
- Search/filter/custom views/folders.
- Macros and automation hooks.
- Snooze/close/reply controls, email threading/forwarding.
- AI inbox translations and language detection.
- Ticket portal + ticket form options + state management.

**Workflows (automation platform)**

- Visual builder, reusable workflows, templates.
- Trigger coverage: page visits, conversation events, calls, messages, state changes.
- Branch logic, order controls, trigger configuration.
- A/B tests and control groups.
- Wait-for-webhook and webhook-aware automation.
- Team/timezone/capacity routing.
- Slack notifications + operational automation recipes.
- OTP identity verification step.
- Fin integration in workflows (answer-first, follow-up, handoff patterns).

**Knowledge and content ops**

- Help center setup/customization (domain, fonts, footer, structure).
- Multiple help centers.
- Public/internal article types and content organization.
- Snippets/documents/folder management.
- Content tagging and bulk actions.
- Related articles/search optimization/reactions.
- External sync/import (Zendesk, Box, Salesforce Knowledge, Freshdesk).
- Fine-grained Fin/Copilot content enablement.

**Reports and analytics**

- Custom reports, datasets, chart drill-in.
- Team/teammate/ticket/workflow/Fin-specific reporting.
- CSAT/SLA/conversation topic/effectiveness reporting.
- Cloud export destinations + scheduled external sharing.
- Dataset and metric governance docs.

**Outbound and lifecycle messaging**

- Outbound email/chat/post messaging.
- Product tours (design/targeting/multi-page/share/performance/goals).
- Audience segmentation (fixed/dynamic).
- Message goals and control groups.
- Email template/html personalization and deliverability guidance.

**Contacts and data model**

- Users/leads/companies model and lifecycle.
- Event tracking and custom data attributes.
- Qualification data and company grouping.
- Advanced segmentation logic (AND/OR).
- Import/export/archive/merge operations.
- Owner assignment and UTM tracking.

**Apps/integrations/platform**

- Marketplace (first-party + third-party apps).
- Native docs across Salesforce, Zendesk, Shopify, Stripe, HubSpot, Segment, Zapier, GitHub, etc.
- Data connectors/custom objects and response mapping.
- Webhooks and developer workspace pathways.

**Security and governance**

- Security/privacy collection with compliance posture and workspace controls.
- Roles/permissions and teammate/team visibility controls.
- Multi-brand and multi-workspace operation patterns.

## Cross-product module matrix

Legend: `✅` strong documented module, `◑` partial or narrower implementation.

| Module | Featurebase | Gleap | Crisp | Chatbase | Intercom |
|---|---|---|---|---|---|
| Feedback portal / idea boards | ✅ | ✅ | ◑ | ◑ | ◑ |
| Roadmaps | ✅ | ◑ | ◑ | ◑ | ◑ |
| Changelog / release notes | ✅ | ✅ | ◑ | ◑ | ◑ |
| In-app surveys | ✅ | ✅ | ◑ | ◑ | ◑ |
| Help center / knowledge base | ✅ | ✅ | ✅ | ◑ | ✅ |
| Live chat / messenger | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ticketing / case operations | ◑ | ✅ | ◑ | ◑ | ✅ |
| AI support agent / copilot | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workflow automation | ✅ | ✅ | ✅ | ◑ | ✅ |
| Outbound campaigns / lifecycle messaging | ◑ | ✅ | ✅ | ◑ | ✅ |
| Omnichannel messaging (WhatsApp/SMS/social/phone) | ◑ | ✅ | ✅ | ✅ | ✅ |
| Analytics / reporting | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contact/CRM segmentation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Developer SDK/API depth | ✅ | ✅ | ✅ | ✅ | ✅ |
| Integration ecosystem | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-language / localization | ✅ | ✅ | ✅ | ◑ | ✅ |
| Multi-brand / multi-workspace controls | ✅ | ◑ | ◑ | ◑ | ✅ |
| Security/compliance controls/docs | ✅ | ◑ | ✅ | ◑ | ✅ |

## Consolidated feature universe (deduplicated)

This is the merged “what exists in-market” list across the five products.

### A) Feedback and product planning

- Feedback boards and public portals.
- Idea submission, voting, commenting.
- Duplicate detection and post merge.
- Post moderation and anti-spam controls.
- Custom fields/metadata and tags.
- AI tagging, topic grouping, feedback summarization.
- Multiple board privacy models (public/private/internal/company/author/read-only/segmented).
- Roadmap publishing and privacy controls.
- Prioritization framework support.

### B) Release communication

- Changelog authoring and backdating.
- Changelog widgets/embeds.
- Release notification emails.
- Multilingual changelog publishing.
- Changelog analytics.

### C) Help center and content ops

- Multi-help-center support.
- Public and internal content types.
- Collections/folders/snippets/documents.
- Article reactions/feedback loops.
- Search tuning and related articles.
- Import/sync from external KBs (eg, Zendesk/Freshdesk/Box/Salesforce sources).
- Redirect management.
- SEO/indexing controls.
- Custom domains/fonts/footer/branding.
- Content permissions and privacy controls.
- AI-optimized content controls for agent usage.

### D) Inbox and ticketing operations

- Unified inbox for chat/email/social/voice.
- Conversation assignment and balancing.
- Team inboxes/sub-inboxes/custom views.
- SLA definitions and SLA reporting.
- Ticket types and lifecycle states.
- Snooze/close/reopen and threaded replies.
- Macros/canned responses.
- Internal notes/mentions/collaboration.
- Ticket portal for customers.

### E) Workflow and automation engine

- Visual/no-code workflow builders.
- Trigger libraries (message/page/call/event-based).
- Branching and conditions.
- Ordering and precedence control.
- Reusable workflow templates.
- A/B tests and control groups.
- Wait-for-webhook and integration-driven steps.
- Auto-routing by team/timezone/capacity.
- Auto-close/reassign/follow-up automations.
- Fully automated no-reply conversation modes.

### F) AI support and copilots

- AI answer-first support.
- Agent/coplaybook/procedure/task orchestration.
- AI escalation and handoff rules.
- AI tone/brand/identity controls.
- AI multilingual handling.
- AI simulation, preview, and batch test tooling.
- AI debugging and unresolved query analysis.
- AI-based suggestion generation (content, summaries, replies, tags).
- AI automation metrics (automation rate, CSAT, CX score).

### G) Channel and delivery layer

- Website messenger and mobile in-app chat.
- Email channel (inbound/outbound + deliverability controls).
- WhatsApp channel.
- SMS channel.
- Social channels (Facebook/Instagram).
- Slack-connected operations.
- Phone/voice channels with transcripts/recordings.
- Channel-specific templates and compliance controls.

### H) Outbound and lifecycle marketing/support

- Outbound chats/posts/emails.
- Product tours and in-app announcements.
- Banners/modals/tooltips.
- Drip/series and onboarding campaigns.
- Audience targeting and segmentation.
- Message goals and impact controls.
- Deliverability tooling (domain auth, bounce/spam handling).

### I) Surveys, CSAT, NPS, and qualitative signals

- In-app surveys and response export.
- CSAT workflows and reporting.
- Conversation ratings and article reactions.
- AI summarization of survey results.

### J) Contacts, identity, and customer data model

- Visitor/lead/user/company models.
- Lead qualification and enrichment.
- Merge/archive/delete lifecycle controls.
- Custom attributes and events.
- Tagging and segmentation logic.
- Ownership assignment and routing metadata.
- UTM and behavioral tracking.
- Identity verification and secure auth patterns.

### K) Analytics, reporting, and observability

- Operational dashboards (team, inbox, channels, SLA).
- Custom report builders/datasets.
- Conversation/topic/ticket/workflow reporting.
- AI-specific reporting (quality, CSAT, automation, unresolved). 
- Export to CSV/cloud/object storage.
- External report sharing and scheduling.
- Session replay/logs (console/network/audio) in SDK-first stacks.

### L) Developer platform and extensibility

- JavaScript embed and control APIs.
- Mobile SDKs (iOS/Android/RN/Flutter etc.).
- Webhooks and event listeners.
- REST and streaming APIs.
- Custom actions/tools/functions.
- Custom forms/buttons/UI widgets.
- Plugin/app marketplaces and app frameworks.
- Data connectors/custom objects/MCP-style connectors.

### M) Integration ecosystem

- CRM: Salesforce, HubSpot, Pipedrive.
- Support: Zendesk, Freshdesk, Zoho Desk, Intercom.
- Product/dev: Jira, Linear, ClickUp, GitHub, Azure DevOps, Trello.
- Messaging/collab: Slack, Discord.
- Commerce/payments: Shopify, Stripe.
- Automation/middleware: Zapier, Segment, Viasocket.
- CMS/site builders: WordPress, Webflow, Wix, Framer, Bubble, Weebly.

### N) Security, privacy, and governance

- SOC 2/GDPR and security policy references.
- Cookie and privacy policy controls.
- Data processing and subprocessor docs.
- CSP and installation hardening.
- Roles and permission granularity.
- Team visibility and workspace governance.
- Multi-brand and multi-workspace governance patterns.

### O) Migration and operational lifecycle

- Migration playbooks (from Zendesk/Intercom/Drift/Canny/etc.).
- Import/export tools for tickets/content/feedback/contacts.
- Change-management support (changelog/academy/docs workflows).

## Sources (primary docs)

### Featurebase

- https://help.featurebase.app
- https://help.featurebase.app/sitemap.xml
- https://help.featurebase.app/collections/6613070-feedback-and-roadmaps
- https://help.featurebase.app/collections/6830126-support-platform
- https://help.featurebase.app/collections/2964284-help-center
- https://help.featurebase.app/collections/7563376-changelog
- https://help.featurebase.app/collections/8270391-developers
- https://help.featurebase.app/collections/8497651-integrations

### Gleap

- https://docs.gleap.io
- https://docs.gleap.io/sitemap.xml

### Crisp

- https://help.crisp.chat/en
- https://help.crisp.chat/sitemap.xml
- https://help.crisp.chat/en/category/crisp-inbox-15ctwet/
- https://help.crisp.chat/en/category/hugo-ai-agent-chatbot-1yxt4vb/
- https://help.crisp.chat/en/category/crisp-knowledge-base-du6vi0/
- https://help.crisp.chat/en/category/crisp-analytics-16fh1ni/
- https://help.crisp.chat/en/category/automate-h00hj9/

### Chatbase

- https://chatbase.co/docs/user-guides/quick-start/introduction
- https://chatbase.co/docs/sitemap.xml

### Intercom

- https://www.intercom.com/help/en/
- https://www.intercom.com/help/en/collections/6485365-fin-ai-agent
- https://www.intercom.com/help/en/collections/10723236-channels
- https://www.intercom.com/help/en/collections/3497068-inbox
- https://www.intercom.com/help/en/collections/2094721-workflows
- https://www.intercom.com/help/en/collections/9615439-knowledge
- https://www.intercom.com/help/en/collections/2094752-reports
- https://www.intercom.com/help/en/collections/2091449-outbound
- https://www.intercom.com/help/en/collections/2094808-contacts
- https://www.intercom.com/help/en/collections/2094744-apps-integrations
- https://www.intercom.com/help/en/collections/384-security-privacy

