# Widget SDK Reference

The Opencom widget is an embeddable chat and engagement layer for websites. It is built as a Vite IIFE bundle (`apps/widget/`) and exposes the `window.OpencomWidget` global object.

## Installation

Add the widget script before the closing `</body>` tag:

```html
<script
  src="https://cdn.opencom.dev/widget.js"
  data-opencom-convex-url="YOUR_CONVEX_URL"
  data-opencom-workspace-id="YOUR_WORKSPACE_ID"
></script>
```

Find your exact snippet with pre-filled values in **Settings > Widget Installation** after logging in.

The loader auto-initializes the widget when `data-opencom-convex-url` is provided.
Manual `OpencomWidget.init(...)` is still supported for advanced use cases.

### Optional Global Config

You can also define a global settings object before the script loads:

```html
<script>
  window.opencomSettings = {
    convexUrl: "YOUR_CONVEX_URL",
    workspaceId: "YOUR_WORKSPACE_ID",
    trackPageViews: true,
  };
</script>
<script src="https://cdn.opencom.dev/widget.js"></script>
```

If both `window.opencomSettings` and `data-opencom-*` attributes are present,
the global settings object takes precedence.

Supported script attributes:

- `data-opencom-convex-url` (required for auto-init)
- `data-opencom-workspace-id`
- `data-opencom-track-page-views` (`true`/`false`)
- `data-opencom-onboarding-verification-token` (optional install-gate token for hosted onboarding)
- `data-opencom-client-identifier` (optional integration label shown in onboarding signals)
- `data-opencom-verification-token` (legacy alias for `data-opencom-onboarding-verification-token`)

## Integration Scenarios

Use the pattern below that matches your app architecture.

### 1) Static HTML / Multi-Page Site

Use declarative auto-init on every page template:

```html
<script
  src="https://cdn.opencom.dev/widget.js"
  data-opencom-convex-url="https://your-project.convex.cloud"
  data-opencom-workspace-id="your_workspace_id"
  data-opencom-track-page-views="true"
></script>
```

### 2) SPA (React/Vue/Angular)

Load the script once at app boot. Then use SDK methods for lifecycle events:

```javascript
window.opencomSettings = {
  convexUrl: "https://your-project.convex.cloud",
  workspaceId: "your_workspace_id",
  trackPageViews: true,
};

const script = document.createElement("script");
script.src = "https://cdn.opencom.dev/widget.js";
script.async = true;
document.head.appendChild(script);
```

When auth state changes:

```javascript
// on login
window.OpencomWidget?.identify({
  userId: user.id,
  email: user.email,
  name: user.name,
  userHash: user.hmac, // server-generated HMAC if verification is enabled
});

// on logout
window.OpencomWidget?.destroy();
```

### 3) Next.js (App Router)

Use `next/script` in your root layout. Keep config in `NEXT_PUBLIC_*` env vars:

```tsx
import Script from "next/script";

<Script
  id="opencom-widget-loader"
  src={process.env.NEXT_PUBLIC_WIDGET_URL ?? "https://cdn.opencom.dev/widget.js"}
  strategy="afterInteractive"
  data-opencom-convex-url={process.env.NEXT_PUBLIC_CONVEX_URL}
  data-opencom-workspace-id={process.env.NEXT_PUBLIC_WORKSPACE_ID}
/>;
```

### 4) Consent-Managed or Tag Manager Setup

Inject the script only after consent is granted:

```javascript
if (userConsented && !window.__opencomInjected) {
  window.__opencomInjected = true;
  window.opencomSettings = {
    convexUrl: "https://your-project.convex.cloud",
    workspaceId: "your_workspace_id",
  };
  const script = document.createElement("script");
  script.src = "https://cdn.opencom.dev/widget.js";
  script.async = true;
  document.head.appendChild(script);
}
```

### 5) Self-Hosted Widget Delivery

If you host widget assets yourself, point `src` to your loader URL:

```html
<script
  src="https://your-cdn.example.com/widget.js"
  data-opencom-convex-url="https://your-project.convex.cloud"
  data-opencom-workspace-id="your_workspace_id"
></script>
```

Use `scripts/deploy-widget-cdn.sh` (or your own pipeline) to publish `widget.js`, `manifest.json`, and versioned runtime bundles.

## Production Checklist

- Add your site origin in **Settings > Security > Allowed Origins**.
- If using strict CSP, allow:
  - `script-src` for your widget loader origin (for example `https://cdn.opencom.dev`)
  - `connect-src` for your Convex backend origin
- If identity verification is enabled, generate `userHash` server-side and pass it via `user.userHash` in `init` or `OpencomWidget.identify(...)`.
- `onboardingVerificationToken` is optional and only needed when hosted onboarding is in strict token-verification mode.

## API Reference

### `OpencomWidget.init(config)`

Initialize the widget with your workspace configuration.

```javascript
OpencomWidget.init({
  convexUrl: "https://your-project.convex.cloud",
  workspaceId: "your_workspace_id",
  trackPageViews: true,
  user: {
    email: "user@example.com",
    name: "Jane Doe",
    userId: "usr_123",
  },
});
```

**Config Options:**

| Option                        | Type    | Default     | Description                                                          |
| ----------------------------- | ------- | ----------- | -------------------------------------------------------------------- |
| `convexUrl`                   | string  | required    | Your Convex deployment URL                                           |
| `workspaceId`                 | string  | required    | Your workspace ID                                                    |
| `trackPageViews`              | boolean | `false`     | Automatically track page view events                                 |
| `user`                        | object  | `undefined` | Pre-identify user on initialization                                  |
| `onboardingVerificationToken` | string  | `undefined` | One-time hosted onboarding install token (not identity verification) |
| `verificationToken`           | string  | `undefined` | Deprecated alias for `onboardingVerificationToken`                   |
| `clientIdentifier`            | string  | `undefined` | Optional integration label surfaced in onboarding detection signals  |

### `OpencomWidget.identify(user)`

Link the current visitor to a known user. Call this when a user logs in.

```javascript
OpencomWidget.identify({
  email: "user@example.com",
  name: "Jane Doe",
  userId: "usr_123",
  company: "Acme Inc",
  userHash: "hmac_sha256_hash",
  customAttributes: {
    plan: "pro",
    signupDate: "2024-01-15",
    accountId: "acc_456",
  },
});
```

**User Fields:**

| Field              | Type    | Description                                            |
| ------------------ | ------- | ------------------------------------------------------ |
| `email`            | string? | User email address                                     |
| `name`             | string? | Display name                                           |
| `userId`           | string? | Your system's user ID                                  |
| `company`          | string? | Company name                                           |
| `userHash`         | string? | HMAC-SHA256 hash of `userId` for identity verification |
| `customAttributes` | object? | Arbitrary key-value pairs                              |

### `OpencomWidget.trackEvent(name, properties?)`

Track a custom event for analytics and targeting.

```javascript
OpencomWidget.trackEvent("feature_used", {
  featureName: "export",
  format: "csv",
});
```

| Param        | Type    | Description    |
| ------------ | ------- | -------------- |
| `name`       | string  | Event name     |
| `properties` | object? | Event metadata |

### `OpencomWidget.startTour(tourId)`

Programmatically start a product tour.

```javascript
OpencomWidget.startTour("tour_abc123");
```

| Param    | Type   | Description                |
| -------- | ------ | -------------------------- |
| `tourId` | string | Tour ID from the dashboard |

### `OpencomWidget.getAvailableTours()`

Get the list of tours available for the current visitor.

```javascript
const tours = OpencomWidget.getAvailableTours();
// [{ id, name, description, status, elementsAvailable }]
```

Returns an array of tour objects:

| Field               | Type    | Description                                         |
| ------------------- | ------- | --------------------------------------------------- |
| `id`                | string  | Tour ID                                             |
| `name`              | string  | Tour name                                           |
| `description`       | string? | Tour description                                    |
| `status`            | string  | "new", "in_progress", or "completed"                |
| `elementsAvailable` | boolean | Whether target elements are present on current page |

### `OpencomWidget.destroy()`

Remove the widget from the page and clean up all event listeners.

```javascript
OpencomWidget.destroy();
```

## Widget Behavior

### Session Management

- On first load, the widget generates a `sessionId` stored in `localStorage`.
- The widget calls `widgetSessions:boot` to obtain a cryptographic session token (`wst_…`).
- The token is sent with every API call and automatically refreshed when <25% lifetime remains.
- Tokens default to 24-hour lifetime (configurable 1h-7d per workspace).

### Real-Time Features

The widget subscribes to Convex queries for real-time updates:

| Feature           | Subscription                             | Data                            |
| ----------------- | ---------------------------------------- | ------------------------------- |
| Messages          | `messages.list`                          | Messages in active conversation |
| Unread badge      | `conversations.getTotalUnreadForVisitor` | Unread count                    |
| Tours             | `tours.listAll`                          | Active tours matching targeting |
| Tooltips          | `tooltips.getActiveForVisitor`           | Active tooltips                 |
| Outbound messages | `outboundMessages.getEligible`           | Eligible messages               |
| Surveys           | `surveys.getActiveSurveys`               | Active surveys                  |
| Checklists        | `checklists.getAllProgress`              | Checklist progress              |

### Automatic Tracking

When `trackPageViews: true` is set:

- Page view events are tracked on route changes.
- Current URL is updated on the visitor record.
- Referrer is captured on first load.

### Device Detection

The widget automatically detects and stores:

- Browser name and version
- Operating system
- Device type (desktop/mobile/tablet)
- Referrer URL
- Current page URL

### Heartbeat

The widget sends periodic heartbeat signals to maintain visitor online status, used for presence indicators in the agent dashboard.

## Identity Verification

For production deployments, enable HMAC identity verification to prevent visitor impersonation.

### Server-Side Hash Generation

```javascript
const crypto = require("crypto");

function generateUserHash(userId, secret) {
  return crypto.createHmac("sha256", secret).update(userId).digest("hex");
}
```

### Widget Integration

```javascript
OpencomWidget.init({
  convexUrl: "...",
  workspaceId: "...",
  user: {
    userId: "usr_123",
    email: "user@example.com",
    userHash: generateUserHash("usr_123", process.env.OPENCOM_HMAC_SECRET),
  },
});
```

### Verification Modes

| Mode         | Behavior                                               |
| ------------ | ------------------------------------------------------ |
| **Optional** | Unverified users allowed but marked as unverified      |
| **Required** | Unverified users rejected (widget won't load for them) |

## Widget Overlays

The widget renders several overlay types in priority order:

1. **Product Tours** (`TourOverlay.tsx`) — Step-by-step guides attached to page elements
2. **Tooltips** (`TooltipOverlay.tsx`) — Contextual hints on hover/click/auto
3. **Outbound Messages** (`OutboundOverlay.tsx`) — Proactive chat/post/banner messages
4. **Surveys** (`SurveyOverlay.tsx`) — In-app surveys (small/large format)
5. **Checklists** (`ChecklistOverlay.tsx`) — Onboarding task lists
6. **CSAT** (`CsatPrompt.tsx`) — Post-conversation satisfaction ratings

Each overlay evaluates audience rules, trigger conditions, and frequency settings before displaying.

## Authoring Mode

The widget supports a WYSIWYG authoring mode for building product tours and tooltips. When an authoring session token is present in the URL, the widget renders an element picker overlay that allows selecting page elements as tour step targets.

## Troubleshooting

### Widget not connecting

- Verify `convexUrl` and `workspaceId` are correct.
- Check browser console for CORS errors.
- Add your site's origin to **Settings > Security > Allowed Origins**.

### Surveys/tours not showing

- Verify the survey/tour status is "active" in the dashboard.
- Check audience rules match the current visitor.
- Check trigger conditions (page URL, time on page, etc.).

### Identity verification failing

- Ensure `userHash` is computed server-side with the correct HMAC secret.
- The hash must be of the `userId` field, not email.
- Check that verification mode matches your setup (optional vs required).
