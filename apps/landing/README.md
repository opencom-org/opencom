# Opencom Landing Page

Marketing and product landing site for Opencom. Built with Next.js.

## Setup

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_WORKSPACE_ID (NEXT_PUBLIC_WIDGET_URL is optional)
pnpm dev:landing
```

## Widget Embed Behavior

`src/components/widget-script.tsx` uses a declarative script tag with `data-opencom-*` attributes.
The widget loader/runtime reads these attributes and auto-initializes, so the landing app does not need imperative `window.OpencomWidget.init(...)` logic.

## Seeding Demo Data

The landing page embeds the Opencom widget. To populate the widget with demo content (product tour, checklist, knowledge base articles, outbound messages, survey, tooltips, and branded messenger settings):

```bash
# From the repo root — requires ALLOW_TEST_DATA=true and TEST_ADMIN_SECRET on the Convex deployment
CONVEX_URL=<your-convex-url> WORKSPACE_ID=<your-workspace-id> TEST_ADMIN_SECRET=<your-secret> pnpm seed:landing
```

> **Note:** `TEST_ADMIN_SECRET` must match the `TEST_ADMIN_SECRET` environment variable set on your Convex deployment. Test data mutations are internal and can only be called through the admin gateway action.

The seed script is **idempotent** — running it again cleans up previous demo data before re-seeding.

To remove all seeded data without re-seeding:

```bash
CONVEX_URL=<your-convex-url> WORKSPACE_ID=<your-workspace-id> TEST_ADMIN_SECRET=<your-secret> pnpm seed:landing:cleanup
```

### What gets seeded

| Feature            | Details                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product Tour       | 5-step tour targeting current landing hooks (hero CTA, features section, product-tour showcase, final CTA) |
| Checklist          | "Explore Opencom" with 5 tasks                                                                             |
| Knowledge Base     | 2 collections, 6 published articles                                                                        |
| Outbound Messages  | Welcome post (click → new conversation) + docs banner (click → URL)                                        |
| Survey             | NPS survey after 60s on page                                                                               |
| Tooltips           | 3 contextual hints on hero CTA, product-tour showcase, and GitHub nav link                                 |
| Messenger Settings | Purple brand colour, custom welcome message                                                                |

All seeded items use the `LANDING_DEMO_` name prefix for easy identification and cleanup.

## Tour Targets

Key landing page elements have `data-tour-target` attributes so product tour pointer steps can attach to them:

- `hero-section` — Hero section wrapper
- `hero-primary-cta` — Hero "Start Hosted Demo" button
- `hero-github-docs` — Hero "GitHub Docs" button
- `features-section` — Feature overview section
- `showcase-section` — Showcase section wrapper
- `showcase-inbox` — Inbox showcase block
- `showcase-product-tour` — Product tour showcase block
- `final-cta-section` — Final CTA section wrapper
- `final-cta-primary` — Final CTA primary button
- `nav-docs`, `nav-features`, `nav-roadmap`, `nav-contributing` — Navbar links
- `nav-github` — GitHub nav button

## Production Security Headers (Static Export)

`apps/landing` uses `output: "export"`, so runtime security headers must be configured at the deployment layer (CDN/edge/web server).

Required header policy is versioned in:

- `apps/landing/security-headers.requirements.json`

At minimum, production hosting for the landing export must enforce:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Strict-Transport-Security`
