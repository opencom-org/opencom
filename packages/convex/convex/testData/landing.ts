import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

function requireTestDataEnabled() {
  if (process.env.ALLOW_TEST_DATA !== "true") {
    throw new Error("Test data mutations are disabled");
  }
}
const LANDING_DEMO_PREFIX = "LANDING_DEMO_";
const LANDING_DEMO_ARTICLE_MARKER = `<!-- ${LANDING_DEMO_PREFIX} -->`;
const LANDING_DEMO_ARTICLE_CONTENT_SUFFIX = `\n\n${LANDING_DEMO_ARTICLE_MARKER}`;
const LANDING_DEMO_SLUG_SUFFIX = "landing-demo";

function isLandingDemoArticle(article: { title: string; content: string }): boolean {
  return (
    article.title.startsWith(LANDING_DEMO_PREFIX) ||
    article.content.trimEnd().endsWith(LANDING_DEMO_ARTICLE_MARKER)
  );
}

/**
 * Cleans up all landing demo data from a workspace.
 */

const cleanupLandingDemo = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const cleaned = {
      tours: 0,
      tourSteps: 0,
      checklists: 0,
      articles: 0,
      collections: 0,
      outboundMessages: 0,
      surveys: 0,
      tooltips: 0,
    };

    // Clean up tours and steps
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tour of tours) {
      if (tour.name.startsWith(LANDING_DEMO_PREFIX)) {
        const steps = await ctx.db
          .query("tourSteps")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const step of steps) {
          await ctx.db.delete(step._id);
          cleaned.tourSteps++;
        }
        const progress = await ctx.db
          .query("tourProgress")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
        }
        await ctx.db.delete(tour._id);
        cleaned.tours++;
      }
    }

    // Clean up checklists
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const checklist of checklists) {
      if (checklist.name.startsWith(LANDING_DEMO_PREFIX)) {
        const progress = await ctx.db
          .query("checklistProgress")
          .withIndex("by_checklist", (q) => q.eq("checklistId", checklist._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
        }
        await ctx.db.delete(checklist._id);
        cleaned.checklists++;
      }
    }

    // Clean up articles
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const demoCollectionIds = new Set<Id<"collections">>();
    for (const article of articles) {
      if (isLandingDemoArticle(article)) {
        if (article.collectionId) {
          demoCollectionIds.add(article.collectionId);
        }
        await ctx.db.delete(article._id);
        cleaned.articles++;
      }
    }

    // Clean up collections
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const collection of collections) {
      if (
        collection.name.startsWith(LANDING_DEMO_PREFIX) ||
        collection.slug.endsWith(`-${LANDING_DEMO_SLUG_SUFFIX}`) ||
        demoCollectionIds.has(collection._id)
      ) {
        await ctx.db.delete(collection._id);
        cleaned.collections++;
      }
    }

    // Clean up outbound messages
    const outboundMessages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const message of outboundMessages) {
      if (message.name.startsWith(LANDING_DEMO_PREFIX)) {
        const impressions = await ctx.db
          .query("outboundMessageImpressions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();
        for (const imp of impressions) {
          await ctx.db.delete(imp._id);
        }
        await ctx.db.delete(message._id);
        cleaned.outboundMessages++;
      }
    }

    // Clean up surveys
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const survey of surveys) {
      if (survey.name.startsWith(LANDING_DEMO_PREFIX)) {
        const responses = await ctx.db
          .query("surveyResponses")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const r of responses) {
          await ctx.db.delete(r._id);
        }
        const impressions = await ctx.db
          .query("surveyImpressions")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const imp of impressions) {
          await ctx.db.delete(imp._id);
        }
        await ctx.db.delete(survey._id);
        cleaned.surveys++;
      }
    }

    // Clean up tooltips
    const tooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tooltip of tooltips) {
      if (tooltip.name.startsWith(LANDING_DEMO_PREFIX)) {
        await ctx.db.delete(tooltip._id);
        cleaned.tooltips++;
      }
    }

    return { success: true, cleaned };
  },
});

/**
 * Seeds curated demo content for the landing page workspace.
 * Idempotent — cleans up previous landing demo data before re-seeding.
 */
const seedLandingDemo = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const now = Date.now();
    const DAY = 86400000;

    // ── Idempotent: clean up previous landing demo data ──────────
    const oldTours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tour of oldTours) {
      if (tour.name.startsWith(LANDING_DEMO_PREFIX)) {
        const steps = await ctx.db
          .query("tourSteps")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const s of steps) await ctx.db.delete(s._id);
        const prog = await ctx.db
          .query("tourProgress")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const p of prog) await ctx.db.delete(p._id);
        await ctx.db.delete(tour._id);
      }
    }
    const oldChecklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const c of oldChecklists) {
      if (c.name.startsWith(LANDING_DEMO_PREFIX)) {
        const prog = await ctx.db
          .query("checklistProgress")
          .withIndex("by_checklist", (q) => q.eq("checklistId", c._id))
          .collect();
        for (const p of prog) await ctx.db.delete(p._id);
        await ctx.db.delete(c._id);
      }
    }
    const oldArticles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const oldDemoCollectionIds = new Set<Id<"collections">>();
    for (const a of oldArticles) {
      if (isLandingDemoArticle(a)) {
        if (a.collectionId) {
          oldDemoCollectionIds.add(a.collectionId);
        }
        await ctx.db.delete(a._id);
      }
    }
    const oldCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const c of oldCollections) {
      if (
        c.name.startsWith(LANDING_DEMO_PREFIX) ||
        c.slug.endsWith(`-${LANDING_DEMO_SLUG_SUFFIX}`) ||
        oldDemoCollectionIds.has(c._id)
      ) {
        await ctx.db.delete(c._id);
      }
    }
    const oldOutbound = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const m of oldOutbound) {
      if (m.name.startsWith(LANDING_DEMO_PREFIX)) {
        const imps = await ctx.db
          .query("outboundMessageImpressions")
          .withIndex("by_message", (q) => q.eq("messageId", m._id))
          .collect();
        for (const i of imps) await ctx.db.delete(i._id);
        await ctx.db.delete(m._id);
      }
    }
    const oldSurveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const s of oldSurveys) {
      if (s.name.startsWith(LANDING_DEMO_PREFIX)) {
        const resp = await ctx.db
          .query("surveyResponses")
          .withIndex("by_survey", (q) => q.eq("surveyId", s._id))
          .collect();
        for (const r of resp) await ctx.db.delete(r._id);
        const imps = await ctx.db
          .query("surveyImpressions")
          .withIndex("by_survey", (q) => q.eq("surveyId", s._id))
          .collect();
        for (const i of imps) await ctx.db.delete(i._id);
        await ctx.db.delete(s._id);
      }
    }
    const oldTooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const t of oldTooltips) {
      if (t.name.startsWith(LANDING_DEMO_PREFIX)) await ctx.db.delete(t._id);
    }

    // ── Product Tour ─────────────────────────────────────────────
    const tourId = await ctx.db.insert("tours", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Landing Page Tour`,
      description: "Interactive tour of the Opencom landing page",
      status: "active",
      targetingRules: undefined,
      displayMode: "first_time_only",
      priority: 100,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    const tourSteps = [
      {
        type: "post" as const,
        title: "Welcome to Opencom!",
        content: "Let us give you a quick tour of the open-source customer messaging platform.",
      },
      {
        type: "pointer" as const,
        title: "Launch the Hosted Demo",
        content: "Start here to open a live Opencom workspace and explore the product in minutes.",
        elementSelector: "[data-tour-target='hero-primary-cta']",
      },
      {
        type: "pointer" as const,
        title: "Explore the Platform",
        content:
          "Shared inbox, product tours, tickets, outbound messages, and AI agent workflows run on one real-time stack.",
        elementSelector: "[data-tour-target='features-section']",
      },
      {
        type: "pointer" as const,
        title: "Native Product Tours",
        content:
          "Opencom tours attach to real UI elements, so onboarding remains fast and resilient as your app evolves.",
        elementSelector: "[data-tour-target='showcase-product-tour']",
      },
      {
        type: "pointer" as const,
        title: "Ready to Build",
        content:
          "Jump into the hosted onboarding flow and start shipping your own customer messaging stack.",
        elementSelector: "[data-tour-target='final-cta-primary']",
      },
    ];

    const stepIds: Id<"tourSteps">[] = [];
    for (let i = 0; i < tourSteps.length; i++) {
      const s = tourSteps[i];
      const stepId = await ctx.db.insert("tourSteps", {
        workspaceId: workspaceId,
        tourId,
        type: s.type,
        order: i,
        title: s.title,
        content: s.content,
        elementSelector: s.elementSelector,
        position: "auto",
        advanceOn: "click",
        createdAt: now - 7 * DAY,
        updatedAt: now,
      });
      stepIds.push(stepId);
    }

    // ── Checklist ────────────────────────────────────────────────
    const checklistId = await ctx.db.insert("checklists", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Explore Opencom`,
      description: "Discover the key features of the open-source customer messaging platform",
      tasks: [
        {
          id: "task_1",
          title: "Take the guided tour",
          description: "Walk through the landing page highlights",
          completionType: "manual",
        },
        {
          id: "task_2",
          title: "Browse the knowledge base",
          description: "Read help articles in the widget Help tab",
          completionType: "manual",
        },
        {
          id: "task_3",
          title: "Start a conversation",
          description: "Send a message through the chat widget",
          completionType: "manual",
        },
        {
          id: "task_4",
          title: "Check out the docs",
          description: "Visit the documentation to learn about deployment",
          completionType: "manual",
        },
        {
          id: "task_5",
          title: "Star us on GitHub",
          description: "Show your support by starring the repository",
          completionType: "manual",
        },
      ],
      status: "active",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Knowledge Base ───────────────────────────────────────────
    const repoDocsBase = "https://github.com/opencom-org/opencom/blob/main";
    const docsBase = `${repoDocsBase}/docs`;
    const ossDocsBase = `${docsBase}/open-source`;
    const collectionsData = [
      {
        name: "Hosted Onboarding",
        desc: "Fastest path to evaluate Opencom before running your own backend",
        articles: [
          {
            title: "Hosted Quick Start",
            content: `# Hosted Quick Start

Hosted mode is the fastest way to evaluate Opencom without managing infrastructure first.

## Recommended path
1. Sign up at https://app.opencom.dev and create a workspace.
2. Invite teammates and verify inbox access.
3. Copy the widget snippet from Settings -> Widget Installation.
4. Add the snippet to your site and confirm the launcher opens.
5. Validate core flows: conversations, help center, tours, outbound, and surveys.

## When to move off hosted
Switch to your own backend when you need stricter data controls, custom deployment workflows, or isolated environments.

## Canonical docs
- [Setup and deployment guide](${ossDocsBase}/setup-self-host-and-deploy.md)
- [README deployment options](${repoDocsBase}/README.md#deployment-options)`,
          },
          {
            title: "Hosted Workspace Setup Checklist",
            content: `# Hosted Workspace Setup Checklist

Use this checklist after creating your workspace:

1. Configure workspace profile and teammate access.
2. Review Signup Settings and authentication methods.
3. Configure Security settings: allowed origins and identity verification mode.
4. Install the widget and run a test conversation.
5. Publish at least one help center collection for self service support.

## Canonical docs
- [Root README workspace and auth settings](${repoDocsBase}/README.md#workspace-settings)
- [Security reference](${docsBase}/security.md)
- [Widget SDK reference](${docsBase}/widget-sdk.md)`,
          },
          {
            title: "Move from Hosted to Custom Backend",
            content: `# Move from Hosted to Custom Backend

You can start hosted and then migrate to your own Convex backend.

## Migration outline
1. Deploy packages/convex to your Convex project.
2. Configure required backend environment variables.
3. Connect web and mobile apps to your backend URL.
4. Reinstall your site widget with your backend URL and workspace ID.
5. Re-test identity verification, events, and messaging workflows.

## Canonical docs
- [Setup and self host guide](${ossDocsBase}/setup-self-host-and-deploy.md)
- [Connecting to a self hosted backend](${repoDocsBase}/README.md#connecting-to-a-self-hosted-backend)
- [Security and operations](${ossDocsBase}/security-and-operations.md)`,
          },
          {
            title: "Hosted FAQs and Next Steps",
            content: `# Hosted FAQs and Next Steps

## Common questions
- Where should I start? Hosted onboarding is best for fast evaluation.
- Can I self host later? Yes. Deployment profiles support gradual migration.
- Where do I find implementation docs? GitHub docs are the source of truth.
- Where can I ask product and setup questions? Use GitHub Discussions.

## Next steps
1. Choose a deployment profile.
2. Complete security setup before production traffic.
3. Run the verification checklist before launch.

## Canonical docs
- [OSS docs hub](${ossDocsBase}/README.md)
- [Testing and verification](${ossDocsBase}/testing-and-verification.md)
- [GitHub discussions](https://github.com/opencom-org/opencom/discussions)`,
          },
        ],
      },
      {
        name: "Self Hosting and Deployment",
        desc: "Canonical setup and deployment paths for custom infrastructure",
        articles: [
          {
            title: "Self Host Fast Path",
            content: `# Self Host Fast Path

The quickest self hosted setup uses scripts/setup.sh.

## Prerequisites
- Node.js 18+
- PNPM 9+
- Convex account

## Fast path flow
1. Clone the repo.
2. Run scripts/setup.sh.
3. Complete prompts for auth and workspace setup.
4. Start local apps and verify widget connectivity.

## Canonical docs
- [Setup and self host guide](${ossDocsBase}/setup-self-host-and-deploy.md)
- [Root README quick start](${repoDocsBase}/README.md#quick-start-self-hosters)
- [Scripts reference](${docsBase}/scripts-reference.md)`,
          },
          {
            title: "Manual Setup and Local Development",
            content: `# Manual Setup and Local Development

Use the manual path if you want full control over each setup step.

## Typical sequence
1. Install dependencies at repo root.
2. Start Convex from packages/convex.
3. Start web and widget apps.
4. Optionally run landing and mobile apps.

## Why use manual setup
- Better visibility into environment wiring.
- Easier to debug auth and configuration issues.
- Useful for advanced CI or custom deployment pipelines.

## Canonical docs
- [Manual setup flow](${ossDocsBase}/setup-self-host-and-deploy.md#manual-setup-step-by-step)
- [Architecture and repo map](${ossDocsBase}/architecture-and-repo-map.md)
- [Testing guide](${docsBase}/testing.md)`,
          },
          {
            title: "Deployment Profiles Explained",
            content: `# Deployment Profiles Explained

Opencom supports multiple deployment profiles:

1. Hosted apps plus custom backend.
2. Self hosted web plus custom backend.
3. Full self host of apps plus backend.
4. Optional widget CDN publishing workflow.

Choose based on infrastructure ownership, compliance needs, and release control.

## Canonical docs
- [Deployment profiles](${ossDocsBase}/setup-self-host-and-deploy.md#deployment-profiles)
- [Architecture deployment topology](${docsBase}/architecture.md#deployment-topology)
- [Root README deployment options](${repoDocsBase}/README.md#deployment-options)`,
          },
          {
            title: "Environment Variables by Surface",
            content: `# Environment Variables by Surface

The most important variables are grouped by runtime surface:

- Convex backend: auth, email, security, CORS, AI, and test-data gates.
- Web app: default backend URL and widget demo overrides.
- Mobile app: default backend URL for operator workflows.
- Landing app: widget URL and workspace-specific demo wiring.
- Widget app: local development convex URL and workspace ID.

Set secrets in deployment environments and never commit them to source control.

## Canonical docs
- [Environment variable matrix](${ossDocsBase}/setup-self-host-and-deploy.md#environment-variables)
- [Security critical variables](${docsBase}/security.md#security-critical-env-vars)
- [Root README env reference](${repoDocsBase}/README.md#environment-variables-reference)`,
          },
        ],
      },
      {
        name: "Widget Integration",
        desc: "Install, configure, and harden the website widget and help center",
        articles: [
          {
            title: "Widget Installation Patterns",
            content: `# Widget Installation Patterns

Opencom supports declarative script-tag install and manual SDK initialization.

## Common patterns
1. Static or multi page websites.
2. SPA frameworks that load script once at app boot.
3. Next.js App Router integration using runtime environment variables.
4. Consent managed script injection after user opt-in.
5. Self hosted widget loader URL for infrastructure ownership.

## Canonical docs
- [Widget SDK installation and scenarios](${docsBase}/widget-sdk.md)
- [README widget installation](${repoDocsBase}/README.md#widget-installation)`,
          },
          {
            title: "Identify Users and Track Events",
            content: `# Identify Users and Track Events

Call identify after login so conversations and history map to known users.

Track product events to power targeting, automation, and reporting.

Recommended event model:
- stable event names
- consistent property shapes
- clear ownership between frontend and backend teams

## Canonical docs
- [Widget identify and track APIs](${docsBase}/widget-sdk.md#api-reference)
- [Backend events and analytics API](${docsBase}/api-reference.md)
- [Data model events table](${docsBase}/data-model.md)`,
          },
          {
            title: "Identity Verification with HMAC",
            content: `# Identity Verification with HMAC

Identity verification prevents impersonation by requiring a server generated hash for identified users.

## Implementation outline
1. Enable identity verification in workspace security settings.
2. Generate user hash on your server using the shared secret.
3. Pass userHash when identifying users in the widget or SDK.
4. Choose optional vs required verification mode.

## Canonical docs
- [Security identity verification guide](${docsBase}/security.md#identity-verification-hmac)
- [Widget identity verification section](${docsBase}/widget-sdk.md#identity-verification)
- [Mobile SDK identity verification](${docsBase}/mobile-sdks.md#identity-verification)`,
          },
          {
            title: "Widget Troubleshooting Checklist",
            content: `# Widget Troubleshooting Checklist

If the widget is not behaving as expected, check:

1. convexUrl and workspaceId values.
2. Allowed origins and CSP directives.
3. Session and identity verification state.
4. Script load timing in your framework lifecycle.
5. Network access to your Convex deployment.

## Canonical docs
- [Widget troubleshooting](${docsBase}/widget-sdk.md#troubleshooting)
- [Security CORS guidance](${docsBase}/security.md#cors-configuration)
- [Setup common failures](${ossDocsBase}/setup-self-host-and-deploy.md#common-setup-failures)`,
          },
        ],
      },
      {
        name: "Product and Engagement Guides",
        desc: "Practical guidance for inbox, help center, campaigns, and automation",
        articles: [
          {
            title: "Conversation and Inbox Workflow",
            content: `# Conversation and Inbox Workflow

Opencom inbox operations center on conversation ownership, response speed, and clean routing.

## Core practices
1. Assign and triage quickly.
2. Use snippets and tags for repeatable responses.
3. Monitor unread and SLA indicators.
4. Apply role based permissions for team safety.

## Canonical docs
- [Backend API conversations and messages](${docsBase}/api-reference.md)
- [Architecture visitor interaction flow](${docsBase}/architecture.md#data-flow)
- [Security authorization model](${docsBase}/security.md#authorization-model)`,
          },
          {
            title: "Help Center and Article Strategy",
            content: `# Help Center and Article Strategy

A useful help center balances findability and depth.

## Recommended structure
1. Separate hosted onboarding from self hosting.
2. Group articles by implementation phase, not internal teams.
3. Keep short operational checklists in each article.
4. Link each article to canonical source documents.
5. Publish only reviewed content and keep drafts private.

## Canonical docs
- [API reference for articles and collections](${docsBase}/api-reference.md)
- [Data model help center tables](${docsBase}/data-model.md#help-center-tables)
- [Documentation source of truth contract](${ossDocsBase}/source-of-truth.md)`,
          },
          {
            title: "Tours Surveys Outbound and Checklists",
            content: `# Tours Surveys Outbound and Checklists

Use engagement features together, not in isolation.

## Suggested lifecycle
1. Product tour to onboard first time users.
2. Outbound message for contextual prompts.
3. Survey for product or support feedback.
4. Checklist for adoption milestones.

Use targeting rules and frequency controls to avoid fatigue.

## Canonical docs
- [API reference for tours surveys outbound and checklists](${docsBase}/api-reference.md)
- [Data model engagement tables](${docsBase}/data-model.md)
- [Architecture campaign delivery flow](${docsBase}/architecture.md#data-flow)`,
          },
          {
            title: "Tickets Segments and Automation Basics",
            content: `# Tickets Segments and Automation Basics

Ticket workflows pair well with segmentation and automation settings.

## Foundations
1. Define ticket forms for consistent intake.
2. Build segments from visitor and event attributes.
3. Use assignment and notification rules for routing.
4. Track outcomes in reporting snapshots.

## Canonical docs
- [API reference tickets segments automation](${docsBase}/api-reference.md)
- [Data model ticket and automation tables](${docsBase}/data-model.md)
- [Architecture integration boundaries](${ossDocsBase}/architecture-and-repo-map.md)`,
          },
        ],
      },
      {
        name: "SDKs and API",
        desc: "Implementation paths for backend APIs and mobile SDK surfaces",
        articles: [
          {
            title: "Backend API Surface Overview",
            content: `# Backend API Surface Overview

The backend exposes modules for conversations, content, campaigns, automation, reporting, and AI features.

## Start here
1. Identify the table or workflow you need.
2. Map it to the corresponding API module.
3. Validate permissions and workspace boundaries before integrating.

## Canonical docs
- [Backend API reference](${docsBase}/api-reference.md)
- [Architecture and repository map](${ossDocsBase}/architecture-and-repo-map.md)
- [Data model reference](${docsBase}/data-model.md)`,
          },
          {
            title: "React Native SDK Quick Start",
            content: `# React Native SDK Quick Start

The React Native SDK provides a full messaging surface with hooks and components.

## Typical flow
1. Install the package.
2. Wrap app with OpencomProvider.
3. Initialize SDK with workspaceId and convexUrl.
4. Identify logged in users.
5. Register push tokens when needed.

## Canonical docs
- [Mobile SDK reference React Native section](${docsBase}/mobile-sdks.md#react-native-sdk)
- [React Native SDK package README](${repoDocsBase}/packages/react-native-sdk/README.md)
- [Push architecture](${docsBase}/mobile-sdks.md#push-notification-architecture)`,
          },
          {
            title: "iOS and Android SDK Quick Start",
            content: `# iOS and Android SDK Quick Start

Opencom ships native SDKs for Swift and Kotlin.

## Shared flow
1. Initialize with workspaceId and convexUrl.
2. Identify users after login.
3. Track events for analytics and targeting.
4. Present messenger or help center UI.
5. Register push tokens with platform transport credentials.

## Canonical docs
- [Mobile SDK reference iOS and Android](${docsBase}/mobile-sdks.md)
- [iOS SDK README](${repoDocsBase}/packages/ios-sdk/README.md)
- [Android SDK README](${repoDocsBase}/packages/android-sdk/README.md)`,
          },
          {
            title: "Data Model for Integrations",
            content: `# Data Model for Integrations

Use the data model reference when designing analytics exports, integrations, or migration tooling.

## Priority tables to understand
1. visitors and widgetSessions
2. conversations and messages
3. collections and articles
4. campaigns and notification delivery
5. automation and audit logs

## Canonical docs
- [Data model reference](${docsBase}/data-model.md)
- [API module map](${docsBase}/api-reference.md)
- [Architecture overview](${docsBase}/architecture.md)`,
          },
        ],
      },
      {
        name: "Security Testing and Operations",
        desc: "Production hardening, verification workflows, and operational readiness",
        articles: [
          {
            title: "Security Boundaries and Authorization",
            content: `# Security Boundaries and Authorization

Opencom enforces separate trust boundaries for agents and visitors.

## Key controls
1. Role and permission checks for agent actions.
2. Signed visitor sessions for visitor facing APIs.
3. Workspace isolation across all core resources.
4. Audit log coverage for high risk actions.

## Canonical docs
- [Platform security guide](${docsBase}/security.md)
- [Security and operations guide](${ossDocsBase}/security-and-operations.md)
- [Architecture authorization model](${docsBase}/architecture.md#authorization-model)`,
          },
          {
            title: "Webhook CORS and Discovery Route Security",
            content: `# Webhook CORS and Discovery Route Security

Production deployments should harden both inbound webhooks and public metadata routes.

## Must-have controls
1. Verify webhook signatures.
2. Keep signature enforcement fail closed.
3. Configure explicit CORS origins for public discovery.
4. Keep test data gateways disabled outside test deployments.

## Canonical docs
- [Webhook security details](${docsBase}/security.md#webhook-security)
- [CORS and discovery guidance](${ossDocsBase}/security-and-operations.md#cors-and-public-discovery-route)
- [Setup env variable requirements](${ossDocsBase}/setup-self-host-and-deploy.md#environment-variables)`,
          },
          {
            title: "Testing Workflow from Local to CI",
            content: `# Testing Workflow from Local to CI

Use focused checks first, then run broader verification before merge or release.

## Practical sequence
1. Run package-level typecheck and tests for touched areas.
2. Run targeted E2E specs when behavior spans app boundaries.
3. Run CI-equivalent lint, typecheck, security gates, convex tests, and web E2E.
4. Capture failures with reliability tooling before retries.

## Canonical docs
- [Testing and verification guide](${ossDocsBase}/testing-and-verification.md)
- [Detailed testing guide](${docsBase}/testing.md)
- [Scripts reference for test utilities](${docsBase}/scripts-reference.md)`,
          },
          {
            title: "Release Verification and Incident Readiness",
            content: `# Release Verification and Incident Readiness

Release readiness combines functional quality checks with security and operational validation.

## Release baseline
1. Lint and typecheck.
2. Security gate scripts.
3. Convex package tests and web E2E.
4. Review incident and vulnerability reporting workflow.

## Incident readiness
- Ensure auditability for critical events.
- Keep rollback and communication paths documented.

## Canonical docs
- [Security and operations release baseline](${ossDocsBase}/security-and-operations.md)
- [Source of truth contract](${ossDocsBase}/source-of-truth.md)
- [Repository security policy](${repoDocsBase}/SECURITY.md)`,
          },
        ],
      },
    ];

    const collectionIds: Id<"collections">[] = [];
    const articleIds: Id<"articles">[] = [];
    for (let ci = 0; ci < collectionsData.length; ci++) {
      const c = collectionsData[ci];
      const slug = `${c.name.toLowerCase().replace(/\s+/g, "-")}-${LANDING_DEMO_SLUG_SUFFIX}`;
      const collectionId = await ctx.db.insert("collections", {
        workspaceId,
        name: c.name,
        slug,
        description: c.desc,
        order: ci,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
      collectionIds.push(collectionId);

      for (let ai = 0; ai < c.articles.length; ai++) {
        const a = c.articles[ai];
        const articleId = await ctx.db.insert("articles", {
          workspaceId,
          collectionId,
          title: a.title,
          slug: `${a.title.toLowerCase().replace(/\s+/g, "-")}-${ci}-${ai}-${LANDING_DEMO_SLUG_SUFFIX}`.toLowerCase(),
          content: `${a.content}${LANDING_DEMO_ARTICLE_CONTENT_SUFFIX}`,
          status: "published",
          order: ai,
          createdAt: now - 14 * DAY + ai * DAY,
          updatedAt: now,
          publishedAt: now - 14 * DAY + ai * DAY,
        });
        articleIds.push(articleId);
      }
    }

    // ── Outbound Messages ────────────────────────────────────────
    const postMessageId = await ctx.db.insert("outboundMessages", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Welcome Post`,
      type: "post",
      content: {
        title: "Welcome to Opencom!",
        body: "The open-source customer messaging platform. Explore live chat, product tours, surveys, and a full knowledge base — all self-hosted.",
        buttons: [
          { text: "Start a Conversation", action: "open_new_conversation" as const },
          { text: "Dismiss", action: "dismiss" as const },
        ],
        clickAction: {
          type: "open_new_conversation" as const,
        },
      },
      status: "active",
      triggers: { type: "time_on_page", delaySeconds: 10 },
      frequency: "once",
      priority: 100,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    const bannerMessageId = await ctx.db.insert("outboundMessages", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Docs Banner`,
      type: "banner",
      content: {
        text: "Read the docs to deploy Opencom on your own infrastructure in minutes.",
        style: "floating" as const,
        dismissible: true,
        buttons: [{ text: "View Docs", action: "url" as const, url: "https://opencom.dev/docs" }],
        clickAction: {
          type: "open_url" as const,
          url: "https://opencom.dev/docs",
        },
      },
      status: "active",
      triggers: { type: "time_on_page", delaySeconds: 30 },
      frequency: "once",
      priority: 90,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Survey ───────────────────────────────────────────────────
    const surveyId = await ctx.db.insert("surveys", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Landing NPS`,
      description: "Quick NPS survey for landing page visitors",
      format: "small",
      status: "active",
      questions: [
        {
          id: "q_landing_nps",
          type: "nps",
          title: "How likely are you to recommend Opencom to a colleague?",
          required: true,
        },
      ],
      thankYouStep: {
        title: "Thank you!",
        description: "Your feedback helps us improve Opencom.",
      },
      triggers: { type: "time_on_page", delaySeconds: 60 },
      frequency: "once",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Tooltips ─────────────────────────────────────────────────
    const tooltipData = [
      {
        name: "Hero CTA Tooltip",
        selector: "[data-tour-target='hero-primary-cta']",
        content: "Open the hosted onboarding flow to get a live Opencom workspace running quickly.",
      },
      {
        name: "Tour Showcase Tooltip",
        selector: "[data-tour-target='showcase-product-tour']",
        content:
          "Preview how native product tours look when attached directly to your app interface.",
      },
      {
        name: "GitHub Nav Tooltip",
        selector: "[data-tour-target='nav-github']",
        content: "Star us on GitHub to show your support and stay updated on new releases.",
      },
    ];

    const tooltipIds: Id<"tooltips">[] = [];
    for (const t of tooltipData) {
      const tooltipId = await ctx.db.insert("tooltips", {
        workspaceId,
        name: `${LANDING_DEMO_PREFIX}${t.name}`,
        elementSelector: t.selector,
        content: t.content,
        triggerType: "hover",
        createdAt: now - 7 * DAY,
        updatedAt: now,
      });
      tooltipIds.push(tooltipId);
    }

    // ── Messenger Settings ───────────────────────────────────────
    const existingSettings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        welcomeMessage:
          "Hey there! Welcome to Opencom — the open-source customer messaging platform. Ask us anything or explore the widget features.",
        launcherPosition: "right",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("messengerSettings", {
        workspaceId,
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        themeMode: "light",
        launcherPosition: "right",
        launcherSideSpacing: 20,
        launcherBottomSpacing: 20,
        showLauncher: true,
        welcomeMessage:
          "Hey there! Welcome to Opencom — the open-source customer messaging platform. Ask us anything or explore the widget features.",
        showTeammateAvatars: true,
        supportedLanguages: ["en"],
        defaultLanguage: "en",
        mobileEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      tourId,
      tourSteps: stepIds.length,
      checklistId,
      collections: collectionIds.length,
      articles: articleIds.length,
      outboundMessages: { postMessageId, bannerMessageId },
      surveyId,
      tooltips: tooltipIds.length,
    };
  },
});

export const landingDemoMutations: Record<string, ReturnType<typeof internalMutation>> = {
  cleanupLandingDemo,
  seedLandingDemo,
} as const;
