## Context

The backend support-attachment domain now exists in Convex and already powers web inbox, web tickets, and widget uploads. React Native surfaces have not adopted that model yet:

- `packages/react-native-sdk` messenger and ticket hooks still send only text content and do not expose attachment metadata.
- `packages/react-native-sdk` compose/detail components have no file picker affordance, upload orchestration, or attachment rendering.
- `apps/mobile` currently exposes an agent conversation screen backed by direct Convex wrapper hooks, but that screen is also text-only.

This change crosses public SDK contracts, shared transport helpers, and first-party mobile UI. The main constraints are preserving the existing Convex support-attachment lifecycle, keeping the RN SDK usable outside a single Expo app shell, and extending hardening coverage so new native upload boundaries do not bypass the current Convex adapter rules.

## Goals / Non-Goals

**Goals:**

- Add attachment upload, send, and rendering support to the React Native SDK messenger conversation flow.
- Add attachment support to React Native SDK ticket creation and ticket reply flows.
- Add agent-side attachment support to the first-party mobile app's existing conversation screen.
- Reuse the existing Convex staged-upload and secure download model instead of inventing a mobile-only storage path.
- Keep file picking and upload boundaries explicit so host apps and tests can control them safely.

**Non-Goals:**

- Replacing or redesigning the existing Convex support attachment backend model.
- Adding first-party mobile ticket surfaces that do not already exist in `apps/mobile`.
- Shipping rich native preview generation, annotation, or offline attachment sync.
- Guaranteeing a built-in picker implementation for every possible React Native host environment in v1.
- Expanding the imperative `OpencomSDK` static API unless attachment support there is required during implementation.

## Decisions

### 1) Add a React Native-specific attachment client layer instead of reusing the browser upload helper directly

Decision:

- Introduce a React Native attachment helper layer in `packages/react-native-sdk` that normalizes picked files into a platform-safe local descriptor such as `uri`, `fileName`, `mimeType`, and `size`.
- Reuse the existing Convex staged-upload flow and attachment descriptor shape, but keep React Native upload orchestration separate from `packages/web-shared/src/supportAttachments.ts`, which is browser-`File` based.

Rationale:

- The existing browser helper assumes DOM `File` objects and browser upload semantics that are not a safe fit for React Native/native file URIs.
- A dedicated RN helper keeps native concerns local while preserving backend parity with web/widget behavior.

Alternatives considered:

- Reuse the browser helper directly: rejected because it couples RN code to DOM-only types and upload assumptions.
- Reimplement upload orchestration independently in each RN component: rejected because it would duplicate validation, error handling, and attachment state management.

### 2) Put file selection behind an explicit picker adapter boundary for the RN SDK

Decision:

- Extend the RN SDK configuration/context with an attachment picker contract that host apps can supply.
- The built-in SDK messenger/ticket components will only expose upload affordances when a picker adapter is available.
- The first-party mobile app will provide an Expo-backed picker implementation for its own screens and any SDK usage it owns.

Rationale:

- The SDK is a reusable package, while first-party mobile is an Expo app. An adapter boundary lets us support the Expo path without baking Expo-only document-picker assumptions into every SDK consumer.
- This keeps failure modes predictable: host apps without picker support remain text-capable instead of crashing on missing native modules.

Alternatives considered:

- Hard-depend on `expo-document-picker` inside the RN SDK: rejected because it over-couples the SDK to Expo runtime assumptions.
- Leave attachment picking entirely to host-defined custom UI: rejected because the built-in Opencom messenger/ticket components would still lack first-class attachment support.

### 3) Extend RN SDK hooks/controllers and mobile Convex wrappers with attachment-aware contracts

Decision:

- Update RN SDK conversation/ticket query result types to include attachment descriptors returned by backend reads.
- Extend RN SDK send/create/reply flows so controller logic can bind staged attachment IDs alongside message or ticket content.
- Extend `apps/mobile` Convex wrapper types and send-message arguments so the first-party agent conversation screen can render attachment metadata and send attachment IDs.

Rationale:

- Attachment support is not just a UI concern; the current hook/controller contracts only model text and would otherwise force components to bypass the existing transport boundaries.
- Keeping attachment-aware reads and writes in the established adapter layers preserves the repo's Convex hardening rules.

Alternatives considered:

- Add standalone upload-only helpers and keep hooks text-only: rejected because it would split one user action across unrelated public APIs.
- Let first-party mobile call backend attachment functions directly from screens: rejected because it would bypass the wrapper pattern the app already uses for Convex access.

### 4) Keep rendering download-first and compact on native surfaces

Decision:

- RN SDK messenger, ticket create/detail, and first-party mobile conversation UIs will render attachments as compact rows/chips with filename, size, removal state, and secure open/download actions.
- Inline previews, if any, should be limited to safe lightweight cases discovered during implementation; the baseline experience is explicit attachment rows.

Rationale:

- Native layouts are smaller and more variable than web surfaces, so a download-first presentation is the lowest-risk way to achieve parity quickly.
- This matches the secure URL model already returned by the backend without requiring new preview pipelines.

Alternatives considered:

- Build image-gallery style previews for all image uploads in v1: rejected because it adds platform-specific complexity without being required for support workflows.
- Hide attachments in historical threads and only support upload on send: rejected because attachment parity would be incomplete for recipients.

### 5) Treat boundary and contract tests as part of the feature, not follow-up cleanup

Decision:

- Update RN SDK hardening/contract tests for new attachment transport helpers and public component contracts.
- Update mobile hardening coverage for any new Convex wrapper hooks or ref factories introduced for attachment support.
- Add focused UI/controller tests that cover attachment queueing, validation feedback, and attachment rendering.

Rationale:

- This feature adds new public API surface and native-side upload orchestration, which is exactly where boundary regressions are most likely.
- Existing repo guidance explicitly expects corresponding hardening guards to move with changed boundaries.

Alternatives considered:

- Rely only on manual testing after implementation: rejected because the risk surface spans auth, native file inputs, and public SDK contracts.

## Risks / Trade-offs

- [Risk] Host apps may not provide an attachment picker adapter, leaving built-in SDK upload UI unavailable.
  -> Mitigation: make picker availability explicit in config/context and preserve a stable text-only fallback.

- [Risk] React Native local-file upload mechanics differ across environments.
  -> Mitigation: normalize picked attachments through one RN helper layer and cover the Expo-backed path used by first-party mobile.

- [Risk] Attachment chips and composer queues can crowd small-screen layouts.
  -> Mitigation: keep the native UI compact, cap visible queued items, and prefer scrolling attachment stacks over expanding the composer indefinitely.

- [Risk] Extending public hook and component contracts can create subtle SDK compatibility drift.
  -> Mitigation: keep changes additive where possible and update contract tests alongside implementation.

## Migration Plan

1. Add RN attachment types, picker adapter contracts, and upload helpers in `packages/react-native-sdk`.
2. Extend RN SDK conversation/ticket hooks and controller layers to upload staged attachments, send attachment IDs, and read attachment descriptors.
3. Update RN SDK messenger and ticket UI components to queue, render, and remove attachments.
4. Extend `apps/mobile` conversation wrappers/types and wire an Expo-backed picker plus attachment rendering into the existing agent conversation screen.
5. Add or update RN SDK and mobile hardening/UI tests.
6. Validate the change with strict OpenSpec validation before implementation handoff.

Rollback strategy:

- Remove or disable native attachment affordances in RN/mobile UI while leaving the backend support attachment model intact.
- Keep additive read fields and attachment-aware types backward-compatible where possible so historical attachment-bearing content remains readable.
- If needed, revert picker adapter wiring independently from backend attachment support.

## Open Questions

- Should the RN SDK expose a default Expo picker adapter when `expo-document-picker` is installed, or require explicit host injection in all cases?
- Do we want to extend the imperative `OpencomSDK` API for attachment-bearing sends in the same change, or keep v1 scoped to hooks/components?
- What native affordance should we use to open downloaded attachments across platforms: direct URL open, share sheet, or host-provided handler?
