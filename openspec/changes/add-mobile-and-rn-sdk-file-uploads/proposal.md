## Why

Support attachment uploads now exist for web inbox, web tickets, and the widget, but the React Native SDK and first-party mobile app remain text-only. That creates an inconsistent support experience across surfaces and blocks common mobile workflows like sending screenshots, PDFs, and logs directly from a device.

## What Changes

- Add file attachment upload, validation, send, and rendering flows to the React Native SDK messenger and ticket surfaces.
- Extend the React Native SDK transport and component contracts to work with staged support attachments, secure download URLs, and attachment metadata returned from Convex.
- Add native attachment support to the first-party mobile app's existing agent conversation screen so mobile responders can send and review files from inbox conversations.
- Introduce shared React Native attachment helpers for file picking, upload orchestration, and attachment presentation that reuse the existing Convex support-attachment backend model.
- Add hardening and regression coverage for React Native/mobile attachment boundaries, validation failures, and authorized rendering.

## Capabilities

### New Capabilities
- `mobile-and-rn-sdk-file-attachments`: Upload, send, and render support attachments across the React Native SDK and the first-party mobile app.

### Modified Capabilities
- None.

## Impact

- `packages/react-native-sdk` hooks, components, transport adapters, and tests for messenger and ticket attachment flows.
- `apps/mobile` conversation experience, Convex wrapper hooks/types, and mobile hardening coverage for agent-side attachments.
- Shared upload helper code and any React Native file-picker integration needed to bridge device files into the existing Convex support attachment pipeline.
- Validation, boundary, and UI regression tests to keep React Native/mobile attachment behavior aligned with the web/widget attachment model.
