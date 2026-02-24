# Survey Delivery Contract

This document defines the backend eligibility payload contract consumed by:

- `apps/widget` runtime survey orchestration
- `packages/react-native-sdk` runtime survey orchestration

## Source Query

- Convex endpoint: `api.surveys.getActiveSurveys`
- Auth modes:
  - Visitor session token path (`visitorId` + `sessionToken`)
  - Authenticated agent path (workspace settings permission)

## Eligibility Payload Shape

Each item in the query result is a survey document containing at least:

- `_id`: survey identifier
- `name`
- `format`: `"small" | "large"`
- `questions`: question definitions for rendering/submission
- `introStep`, `thankYouStep`
- `showProgressBar`, `showDismissButton`
- `triggers`:
  - `type`: `"immediate" | "page_visit" | "time_on_page" | "event"`
  - `pageUrl`, `pageUrlMatch`
  - `delaySeconds`
  - `eventName`
- `frequency`: `"once" | "until_completed"`
- `scheduling`:
  - `startDate`
  - `endDate`

## Runtime Delivery Rules

Runtime clients apply a shared helper (`@opencom/sdk-core` `selectSurveyForDelivery`) to enforce:

1. Schedule window (`startDate` / `endDate`)
2. Trigger satisfaction (`immediate`, `page_visit`, `time_on_page`, `event`)
3. Suppression:
   - already completed
   - already shown in current runtime session
   - previously shown for `frequency === "once"`

## Runtime Trigger Context

Clients provide this context while selecting a survey:

- `currentUrl`
- `timeOnPageSeconds`
- `firedEventName` (last tracked event name)
- `now` (optional override for deterministic tests)

## Failure/Fallback Behavior

If eligibility query data is unavailable, runtimes continue normal chat/messenger boot and skip survey rendering until eligibility data is available.
