import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { formatReadableVisitorId } from "../visitorReadableId";

const E2E_TEST_PREFIX = "e2e_test_";

function requireTestDataEnabled() {
  if (process.env.ALLOW_TEST_DATA !== "true") {
    throw new Error("Test data mutations are disabled");
  }
}

const seedDemoData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const now = Date.now();
    const DAY = 86400000;

    // ── Clean up stale e2e_test segments from previous runs ────────
    const oldSegments = await ctx.db
      .query("segments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const seg of oldSegments) {
      if (seg.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(seg._id);
      }
    }

    // ── Visitors ────────────────────────────────────────────────────
    const visitors: Id<"visitors">[] = [];
    const visitorProfiles = [
      {
        name: "Sarah Chen",
        email: "sarah.chen@acme.io",
        city: "San Francisco",
        country: "United States",
        countryCode: "US",
        browser: "Chrome",
        os: "macOS",
        plan: "pro",
        company: "Acme Inc",
      },
      {
        name: "Marcus Johnson",
        email: "marcus@techstart.co",
        city: "Austin",
        country: "United States",
        countryCode: "US",
        browser: "Firefox",
        os: "Windows",
        plan: "free",
        company: "TechStart",
      },
      {
        name: "Priya Sharma",
        email: "priya@globalcorp.com",
        city: "London",
        country: "United Kingdom",
        countryCode: "GB",
        browser: "Safari",
        os: "macOS",
        plan: "enterprise",
        company: "GlobalCorp",
      },
      {
        name: "Alex Rivera",
        email: "alex@designhub.io",
        city: "New York",
        country: "United States",
        countryCode: "US",
        browser: "Chrome",
        os: "Windows",
        plan: "pro",
        company: "DesignHub",
      },
      {
        name: "Emma Wilson",
        email: "emma@retailplus.com",
        city: "Toronto",
        country: "Canada",
        countryCode: "CA",
        browser: "Edge",
        os: "Windows",
        plan: "free",
        company: "RetailPlus",
      },
      {
        name: "Kenji Tanaka",
        email: "kenji@appsol.jp",
        city: "Tokyo",
        country: "Japan",
        countryCode: "JP",
        browser: "Chrome",
        os: "macOS",
        plan: "pro",
        company: "AppSolutions",
      },
    ];

    for (let i = 0; i < visitorProfiles.length; i++) {
      const p = visitorProfiles[i];
      const vid = await ctx.db.insert("visitors", {
        sessionId: `${E2E_TEST_PREFIX}demo_session_${i}`,
        workspaceId,
        email: p.email,
        name: p.name,
        customAttributes: {
          plan: p.plan,
          company: p.company,
          signupDate: new Date(now - (i + 1) * 7 * DAY).toISOString(),
        },
        location: { city: p.city, country: p.country, countryCode: p.countryCode },
        device: { browser: p.browser, os: p.os, deviceType: "desktop" },
        firstSeenAt: now - (i + 1) * 7 * DAY,
        lastSeenAt: now - i * DAY,
        createdAt: now - (i + 1) * 7 * DAY,
      });
      await ctx.db.patch(vid, {
        readableId: formatReadableVisitorId(vid),
      });
      visitors.push(vid);
    }

    // ── Conversations + Messages ────────────────────────────────────
    const conversationData = [
      {
        visitorIdx: 0,
        status: "open" as const,
        msgs: [
          {
            sender: "visitor",
            content: "Hi! I'm having trouble setting up the API integration. Can you help?",
          },
          {
            sender: "bot",
            content:
              "Of course! I'd be happy to help with API integration. Could you tell me which endpoint you're working with?",
          },
          { sender: "visitor", content: "The webhooks endpoint — I keep getting 401 errors." },
        ],
      },
      {
        visitorIdx: 1,
        status: "open" as const,
        msgs: [
          { sender: "visitor", content: "Is there a way to export my analytics data as CSV?" },
          {
            sender: "bot",
            content:
              "Yes! You can export analytics from the Reports page. Click the export icon in the top right corner.",
          },
        ],
      },
      {
        visitorIdx: 2,
        status: "closed" as const,
        msgs: [
          {
            sender: "visitor",
            content: "We need to upgrade our plan to Enterprise. Who should I contact?",
          },
          {
            sender: "bot",
            content:
              "I'll connect you with our sales team right away. They typically respond within an hour.",
          },
          { sender: "visitor", content: "Great, thank you!" },
        ],
      },
      {
        visitorIdx: 3,
        status: "open" as const,
        msgs: [
          {
            sender: "visitor",
            content: "The tooltip builder is not loading on our staging environment.",
          },
        ],
      },
      {
        visitorIdx: 4,
        status: "snoozed" as const,
        msgs: [
          { sender: "visitor", content: "Can we customise the widget colours to match our brand?" },
          {
            sender: "bot",
            content:
              "Absolutely! Go to Settings → Messenger and update the primary colour. Changes apply instantly.",
          },
          { sender: "visitor", content: "Perfect, I'll try that after our deploy on Monday." },
        ],
      },
    ];

    const conversationIds: Id<"conversations">[] = [];
    for (const conv of conversationData) {
      const createdAt = now - (5 - conv.visitorIdx) * DAY;
      const cid = await ctx.db.insert("conversations", {
        workspaceId,
        visitorId: visitors[conv.visitorIdx],
        status: conv.status,
        createdAt,
        updatedAt: createdAt + conv.msgs.length * 60000,
        lastMessageAt: createdAt + conv.msgs.length * 60000,
        unreadByAgent: conv.status === "open" ? 1 : 0,
      });
      conversationIds.push(cid);

      for (let j = 0; j < conv.msgs.length; j++) {
        const m = conv.msgs[j];
        await ctx.db.insert("messages", {
          conversationId: cid,
          senderId:
            m.sender === "visitor" ? (visitors[conv.visitorIdx] as unknown as string) : "system",
          senderType: m.sender === "visitor" ? "visitor" : "bot",
          content: m.content,
          createdAt: createdAt + j * 60000,
        });
      }
    }

    // ── Tickets ──────────────────────────────────────────────────────
    const ticketData = [
      {
        visitorIdx: 0,
        subject: "API webhook returns 401 Unauthorized",
        priority: "high" as const,
        status: "in_progress" as const,
      },
      {
        visitorIdx: 1,
        subject: "CSV export missing date column",
        priority: "normal" as const,
        status: "submitted" as const,
      },
      {
        visitorIdx: 2,
        subject: "Enterprise plan upgrade request",
        priority: "normal" as const,
        status: "resolved" as const,
      },
      {
        visitorIdx: 3,
        subject: "Tooltip builder blank on staging",
        priority: "high" as const,
        status: "submitted" as const,
      },
      {
        visitorIdx: 4,
        subject: "Widget colour customisation help",
        priority: "low" as const,
        status: "waiting_on_customer" as const,
      },
      {
        visitorIdx: 5,
        subject: "SDK initialisation error on iOS 17",
        priority: "urgent" as const,
        status: "in_progress" as const,
      },
    ];

    for (let i = 0; i < ticketData.length; i++) {
      const t = ticketData[i];
      await ctx.db.insert("tickets", {
        workspaceId,
        visitorId: visitors[t.visitorIdx],
        subject: `${E2E_TEST_PREFIX}${t.subject}`,
        description: `Customer reported: ${t.subject}`,
        status: t.status,
        priority: t.priority,
        createdAt: now - (6 - i) * DAY,
        updatedAt: now - i * DAY,
        resolvedAt: t.status === "resolved" ? now - i * DAY : undefined,
      });
    }

    // ── Articles + Collections ───────────────────────────────────────
    const collections = [
      {
        name: "Getting Started",
        desc: "Everything you need to begin",
        articles: [
          {
            title: "Quick Start Guide",
            content:
              "# Quick Start Guide\n\nWelcome to Opencom! Follow these steps to get started in under 5 minutes.\n\n## Step 1: Install the Widget\n\nAdd the JavaScript snippet to your website's `<head>` tag.\n\n## Step 2: Configure Your Messenger\n\nCustomise colours, welcome message, and team availability.\n\n## Step 3: Start Conversations\n\nYour visitors can now reach you through the widget!",
          },
          {
            title: "Installing the Widget",
            content:
              '# Installing the Widget\n\nThe Opencom widget can be installed on any website.\n\n## HTML Installation\n\n```html\n<script src="https://widget.opencom.dev/v1.js"></script>\n```\n\n## React Installation\n\n```bash\nnpm install @opencom/react\n```\n\nSee the SDK documentation for framework-specific guides.',
          },
          {
            title: "Setting Up Your Team",
            content:
              "# Setting Up Your Team\n\nInvite your team members and assign roles.\n\n## Roles\n\n- **Owner**: Full access\n- **Admin**: Manage settings and team\n- **Agent**: Handle conversations and tickets",
          },
        ],
      },
      {
        name: "Messaging & Inbox",
        desc: "Managing conversations and messages",
        articles: [
          {
            title: "Using the Inbox",
            content:
              "# Using the Inbox\n\nThe inbox is your central hub for all customer conversations.\n\n## Filtering Conversations\n\nUse the sidebar filters to view open, closed, or snoozed conversations.\n\n## Assigning Conversations\n\nClick the assignee dropdown to route conversations to specific agents.",
          },
          {
            title: "Outbound Messages",
            content:
              "# Outbound Messages\n\nSend targeted messages to your users based on behaviour and attributes.\n\n## Message Types\n\n- **Chat**: Appears as a chat bubble\n- **Post**: Rich content card\n- **Banner**: Top or bottom bar\n\n## Targeting\n\nUse audience rules to show messages to specific segments.",
          },
        ],
      },
      {
        name: "Help Center",
        desc: "Build a self-service knowledge base",
        articles: [
          {
            title: "Creating Articles",
            content:
              "# Creating Articles\n\nWrite help articles with our rich text editor.\n\n## Markdown Support\n\nArticles support full Markdown including code blocks, tables, and images.\n\n## Publishing\n\nSave as draft or publish immediately. Published articles appear in the widget.",
          },
          {
            title: "Organising Collections",
            content:
              "# Organising Collections\n\nGroup related articles into collections for easy browsing.\n\n## Collection Icons\n\nChoose an icon for each collection to make navigation intuitive.\n\n## Ordering\n\nDrag and drop to reorder collections and articles.",
          },
        ],
      },
    ];

    for (let ci = 0; ci < collections.length; ci++) {
      const c = collections[ci];
      const slug = `${E2E_TEST_PREFIX}${c.name.toLowerCase().replace(/\s+/g, "-")}`;
      const collectionId = await ctx.db.insert("collections", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${c.name}`,
        slug,
        description: c.desc,
        order: ci,
        createdAt: now - 30 * DAY,
        updatedAt: now,
      });

      for (let ai = 0; ai < c.articles.length; ai++) {
        const a = c.articles[ai];
        await ctx.db.insert("articles", {
          workspaceId,
          collectionId,
          title: `${E2E_TEST_PREFIX}${a.title}`,
          slug: `${E2E_TEST_PREFIX}${a.title.toLowerCase().replace(/\s+/g, "-")}-${ci}-${ai}`,
          content: a.content,
          status: "published",
          order: ai,
          createdAt: now - 30 * DAY + ai * DAY,
          updatedAt: now,
          publishedAt: now - 30 * DAY + ai * DAY,
        });
      }
    }

    // ── Snippets ─────────────────────────────────────────────────────
    const snippetData = [
      {
        name: "Greeting",
        shortcut: "hi",
        content: "Hi there! Thanks for reaching out. How can I help you today?",
      },
      {
        name: "Escalation",
        shortcut: "esc",
        content:
          "I'm going to loop in a specialist who can help with this. They'll follow up shortly.",
      },
      {
        name: "Follow Up",
        shortcut: "fu",
        content:
          "Just checking in — were you able to resolve the issue? Let me know if you need any further help.",
      },
      {
        name: "Closing",
        shortcut: "close",
        content: "Glad I could help! Feel free to reach out any time. Have a great day!",
      },
      {
        name: "Bug Report Ack",
        shortcut: "bug",
        content:
          "Thanks for reporting this. I've created a ticket and our engineering team will investigate. I'll keep you posted on progress.",
      },
    ];

    for (const s of snippetData) {
      await ctx.db.insert("snippets", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        shortcut: s.shortcut,
        content: s.content,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
    }

    // ── Outbound Messages ────────────────────────────────────────────
    const outboundData = [
      {
        name: "Welcome Chat",
        type: "chat" as const,
        status: "active" as const,
        text: "Welcome! Let us know if you need help getting started.",
      },
      {
        name: "Feature Announcement",
        type: "post" as const,
        status: "active" as const,
        title: "New: AI-Powered Suggestions",
        body: "Our AI agent can now suggest help articles to your visitors automatically.",
      },
      {
        name: "Upgrade Banner",
        type: "banner" as const,
        status: "active" as const,
        text: "Unlock advanced analytics — upgrade to Pro today.",
      },
      {
        name: "Feedback Request",
        type: "chat" as const,
        status: "draft" as const,
        text: "We'd love to hear your feedback! How has your experience been so far?",
      },
    ];

    for (let i = 0; i < outboundData.length; i++) {
      const o = outboundData[i];
      const content: Record<string, unknown> = {};
      if (o.type === "chat") {
        content.text = o.text;
      } else if (o.type === "post") {
        content.title = o.title;
        content.body = o.body;
      } else {
        content.text = o.text;
        content.style = "floating";
        content.dismissible = true;
      }

      await ctx.db.insert("outboundMessages", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${o.name}`,
        type: o.type,
        content: content as any,
        status: o.status,
        triggers: { type: "immediate" },
        frequency: "once",
        priority: 100 - i * 10,
        createdAt: now - (10 - i) * DAY,
        updatedAt: now,
      });
    }

    // ── Tours ────────────────────────────────────────────────────────
    const tourData = [
      {
        name: "Product Walkthrough",
        status: "active" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Welcome to Opencom!",
            content: "Let us show you around the key features.",
          },
          {
            type: "pointer" as const,
            title: "Your Inbox",
            content: "All customer conversations land here.",
            elementSelector: "[data-testid='nav-inbox']",
          },
          {
            type: "pointer" as const,
            title: "Knowledge Base",
            content: "Create help articles for self-service.",
            elementSelector: "[data-testid='nav-knowledge']",
          },
        ],
      },
      {
        name: "Widget Demo Tour",
        status: "active" as const,
        targetPageUrl: "*widget-demo*",
        steps: [
          {
            type: "post" as const,
            title: "Welcome to Opencom!",
            content: "Let us give you a quick tour of our platform and show you the key features.",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 1",
            content: "This is the first interactive element you can explore.",
            elementSelector: "#tour-target-1",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 2",
            content: "Here's another feature worth checking out.",
            elementSelector: "#tour-target-2",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 3",
            content: "And one more thing to discover!",
            elementSelector: "#tour-target-3",
          },
        ],
      },
      {
        name: "Inbox Tour",
        status: "active" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Master Your Inbox",
            content: "Learn how to manage conversations efficiently.",
          },
          {
            type: "pointer" as const,
            title: "Filters",
            content: "Filter by status, assignee, or channel.",
            elementSelector: "[data-testid='inbox-filters']",
          },
        ],
      },
      {
        name: "Settings Tour",
        status: "draft" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Customise Your Workspace",
            content: "Adjust settings to match your workflow.",
          },
        ],
      },
    ];

    for (let i = 0; i < tourData.length; i++) {
      const t = tourData[i];
      const tourId = await ctx.db.insert("tours", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${t.name}`,
        description: `Demo tour: ${t.name}`,
        status: t.status,
        targetingRules: t.targetPageUrl ? { pageUrl: t.targetPageUrl } : undefined,
        displayMode: "first_time_only",
        priority: 100 - i * 10,
        createdAt: now - 20 * DAY,
        updatedAt: now,
      });

      for (let si = 0; si < t.steps.length; si++) {
        const s = t.steps[si];
        await ctx.db.insert("tourSteps", {
          workspaceId: args.workspaceId,
          tourId,
          type: s.type,
          order: si,
          title: s.title,
          content: s.content,
          elementSelector: "elementSelector" in s ? s.elementSelector : undefined,
          position: "auto",
          advanceOn: "click",
          createdAt: now - 20 * DAY,
          updatedAt: now,
        });
      }
    }

    // ── Surveys ──────────────────────────────────────────────────────
    const surveyData = [
      {
        name: "NPS Survey",
        format: "small" as const,
        status: "active" as const,
        qType: "nps" as const,
        qTitle: "How likely are you to recommend Opencom?",
      },
      {
        name: "Feature Satisfaction",
        format: "large" as const,
        status: "active" as const,
        qType: "star_rating" as const,
        qTitle: "How would you rate our product tours feature?",
      },
      {
        name: "Onboarding Feedback",
        format: "small" as const,
        status: "draft" as const,
        qType: "multiple_choice" as const,
        qTitle: "How did you hear about us?",
      },
    ];

    for (const s of surveyData) {
      await ctx.db.insert("surveys", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        description: `Demo survey: ${s.name}`,
        format: s.format,
        status: s.status,
        questions: [
          {
            id: `q_demo_${s.name.toLowerCase().replace(/\s+/g, "_")}`,
            type: s.qType as
              | "nps"
              | "numeric_scale"
              | "star_rating"
              | "emoji_rating"
              | "dropdown"
              | "short_text"
              | "long_text"
              | "multiple_choice",
            title: s.qTitle,
            required: true,
            ...(s.qType === "multiple_choice"
              ? {
                  options: {
                    choices: [
                      "Google Search",
                      "Friend or Colleague",
                      "Social Media",
                      "Blog Post",
                      "Other",
                    ],
                  },
                }
              : {}),
          },
        ],
        introStep:
          s.format === "large"
            ? {
                title: s.name,
                description: "Help us improve by sharing your feedback",
                buttonText: "Start",
              }
            : undefined,
        thankYouStep: { title: "Thank you!", description: "Your feedback helps us improve." },
        triggers: { type: "immediate" },
        frequency: "once",
        createdAt: now - 15 * DAY,
        updatedAt: now,
      });
    }

    // ── Checklists ───────────────────────────────────────────────────
    await ctx.db.insert("checklists", {
      workspaceId,
      name: `${E2E_TEST_PREFIX}Onboarding Checklist`,
      description: "Get started with Opencom in 5 easy steps",
      tasks: [
        {
          id: "task_1",
          title: "Install the widget",
          description: "Add the snippet to your site",
          completionType: "manual",
        },
        {
          id: "task_2",
          title: "Customise your messenger",
          description: "Set brand colours and welcome message",
          completionType: "manual",
        },
        {
          id: "task_3",
          title: "Create your first article",
          description: "Write a help article for your users",
          completionType: "manual",
        },
        {
          id: "task_4",
          title: "Invite a teammate",
          description: "Add a colleague to your workspace",
          completionType: "manual",
        },
        {
          id: "task_5",
          title: "Send your first message",
          description: "Create an outbound message",
          completionType: "manual",
        },
      ],
      status: "active",
      createdAt: now - 14 * DAY,
      updatedAt: now,
    });

    await ctx.db.insert("checklists", {
      workspaceId,
      name: `${E2E_TEST_PREFIX}Advanced Setup`,
      description: "Unlock the full power of Opencom",
      tasks: [
        {
          id: "task_a1",
          title: "Set up audience segments",
          description: "Target users by attributes",
          completionType: "manual",
        },
        {
          id: "task_a2",
          title: "Create a product tour",
          description: "Guide users through features",
          completionType: "manual",
        },
        {
          id: "task_a3",
          title: "Configure AI agent",
          description: "Enable AI-powered responses",
          completionType: "manual",
        },
      ],
      status: "draft",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Tooltips ─────────────────────────────────────────────────────
    const tooltipData = [
      {
        name: "Inbox Filter Tip",
        selector: "[data-testid='inbox-filters']",
        content: "Use filters to quickly find conversations by status or assignee.",
        trigger: "hover" as const,
      },
      {
        name: "New Article Tip",
        selector: "[data-testid='new-article-btn']",
        content: "Click here to create a new help article for your knowledge base.",
        trigger: "hover" as const,
      },
      {
        name: "Export Data Tip",
        selector: "[data-testid='export-btn']",
        content: "Export your data as CSV or JSON for reporting.",
        trigger: "click" as const,
      },
    ];

    for (const t of tooltipData) {
      await ctx.db.insert("tooltips", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${t.name}`,
        elementSelector: t.selector,
        content: t.content,
        triggerType: t.trigger,
        createdAt: now - 10 * DAY,
        updatedAt: now,
      });
    }

    // ── Segments ─────────────────────────────────────────────────────
    const segmentData = [
      {
        name: "Active Users",
        desc: "Users seen in the last 7 days",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "system" as const, key: "lastSeenAt" },
              operator: "greater_than" as const,
              value: now - 7 * DAY,
            },
          ],
        },
      },
      {
        name: "Pro Plan Users",
        desc: "Users on the Pro plan",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "custom" as const, key: "plan" },
              operator: "equals" as const,
              value: "pro",
            },
          ],
        },
      },
      {
        name: "Enterprise Leads",
        desc: "Enterprise plan users",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "custom" as const, key: "plan" },
              operator: "equals" as const,
              value: "enterprise",
            },
          ],
        },
      },
    ];

    for (const s of segmentData) {
      await ctx.db.insert("segments", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        description: s.desc,
        audienceRules: s.rules,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
    }

    // ── Email Campaigns ──────────────────────────────────────────────
    const campaignData = [
      {
        name: "Welcome Email",
        subject: "Welcome to Opencom!",
        status: "sent" as const,
        content: "<h1>Welcome!</h1><p>Thanks for signing up. Here's how to get started...</p>",
        stats: {
          pending: 0,
          sent: 1240,
          delivered: 1210,
          opened: 845,
          clicked: 320,
          bounced: 12,
          unsubscribed: 3,
        },
      },
      {
        name: "Feature Update",
        subject: "New: AI Agent is here",
        status: "sent" as const,
        content: "<h1>AI Agent</h1><p>Your visitors can now get instant answers powered by AI.</p>",
        stats: {
          pending: 0,
          sent: 980,
          delivered: 965,
          opened: 612,
          clicked: 198,
          bounced: 5,
          unsubscribed: 1,
        },
      },
      {
        name: "Re-engagement",
        subject: "We miss you!",
        status: "draft" as const,
        content: "<h1>Come back!</h1><p>It's been a while. See what's new...</p>",
        stats: undefined,
      },
    ];

    for (const c of campaignData) {
      await ctx.db.insert("emailCampaigns", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${c.name}`,
        subject: c.subject,
        content: c.content,
        status: c.status,
        stats: c.stats,
        sentAt: c.status === "sent" ? now - 3 * DAY : undefined,
        createdAt: now - 10 * DAY,
        updatedAt: now,
      });
    }

    // ── Messenger Settings ───────────────────────────────────────────
    const existingSettings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        welcomeMessage: "Hi there! How can we help you today?",
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
        welcomeMessage: "Hi there! How can we help you today?",
        showTeammateAvatars: true,
        supportedLanguages: ["en"],
        defaultLanguage: "en",
        mobileEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── AI Agent Settings ────────────────────────────────────────────
    const existingAI = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!existingAI) {
      await ctx.db.insert("aiAgentSettings", {
        workspaceId,
        enabled: true,
        knowledgeSources: ["articles"],
        confidenceThreshold: 0.7,
        personality: "helpful and friendly",
        handoffMessage: "Let me connect you with a human agent.",
        model: "gpt-5-nano",
        suggestionsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      visitors: visitors.length,
      conversations: conversationIds.length,
      tickets: ticketData.length,
      articles: collections.reduce((sum, c) => sum + c.articles.length, 0),
      collections: collections.length,
      snippets: snippetData.length,
      outboundMessages: outboundData.length,
      tours: tourData.length,
      surveys: surveyData.length,
      checklists: 2,
      tooltips: tooltipData.length,
      segments: segmentData.length,
      emailCampaigns: campaignData.length,
    };
  },
});

/**
 * Gets the count of tours for a workspace. Used for testing.
 */

export const demoWorkspaceMutations: Record<string, ReturnType<typeof internalMutation>> = {
  seedDemoData,
} as const;
