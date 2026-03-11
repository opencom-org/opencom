## 1. Rework Widget Email-Capture State And Placement

- [ ] 1.1 Move the widget email-capture render path from `ConversationFooter` into a dedicated slot directly beneath the conversation header.
- [ ] 1.2 Replace dismissal-based state and `opencom_email_dismissed` storage usage with pending-until-identified visibility logic driven by visitor identity and sent-message history.
- [ ] 1.3 Ensure reopening or updating an unidentified conversation keeps the email prompt visible without blocking the message thread or composer.

## 2. Implement Compact Top-Anchored UX

- [ ] 2.1 Update widget styles and animation so the email-capture surface is compact, descends from the header area, and remains responsive across desktop and mobile widget sizes.
- [ ] 2.2 Remove the skip or dismiss control and tighten the prompt copy/layout so the surface occupies less vertical space than the current footer panel.

## 3. Align Automated Coverage

- [ ] 3.1 Update widget email-capture automated coverage to assert top placement, continued composer/thread visibility, absence of a skip action, persistence until identification, and disappearance after successful email submission.
- [ ] 3.2 Update any E2E storage/reset helpers that currently assume dismissible email-capture behavior.

## 4. Verification

- [ ] 4.1 Run focused widget verification for the email-capture flow with PNPM-targeted tests or Playwright coverage for the affected widget spec.
- [ ] 4.2 Run the relevant widget/web typecheck coverage and strict `openspec validate streamline-widget-email-capture --strict --no-interactive`.
