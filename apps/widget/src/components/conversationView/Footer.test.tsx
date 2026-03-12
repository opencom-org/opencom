import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { ConversationFooter } from "./Footer";

describe("ConversationFooter", () => {
  it("keeps the composer controls together when pending attachments are present", () => {
    const { container } = render(
      <ConversationFooter
        conversationId={"conversation-1" as Id<"conversations">}
        visitorId={"visitor-1" as Id<"visitors">}
        sessionToken={undefined}
        csatPromptVisible={false}
        shouldEvaluateCsat={false}
        onDismissCsatPrompt={vi.fn()}
        onCsatSubmitted={vi.fn()}
        isConversationResolved={false}
        automationSettings={undefined}
        csatEligibility={undefined}
        showEmailCapture={false}
        emailInput=""
        onEmailInputChange={vi.fn()}
        onEmailSubmit={vi.fn()}
        onEmailDismiss={vi.fn()}
        officeHoursStatus={undefined}
        expectedReplyTime={undefined}
        commonIssueButtons={[]}
        hasMessages
        onSelectArticle={vi.fn()}
        onApplyConversationStarter={vi.fn()}
        showArticleSuggestions={false}
        articleSuggestions={[]}
        onSelectSuggestionArticle={vi.fn()}
        inputValue=""
        composerError={null}
        pendingAttachments={[
          {
            attachmentId: "attachment-1" as Id<"supportAttachments">,
            fileName: "screenshot-one.png",
            mimeType: "image/png",
            size: 1024,
            status: "staged",
          },
          {
            attachmentId: "attachment-2" as Id<"supportAttachments">,
            fileName: "screenshot-two.png",
            mimeType: "image/png",
            size: 2048,
            status: "staged",
          },
        ]}
        isUploadingAttachments={false}
        onInputChange={vi.fn()}
        onInputKeyDown={vi.fn()}
        onSendMessage={vi.fn()}
        onUploadAttachments={vi.fn()}
        onRemovePendingAttachment={vi.fn()}
      />
    );

    const composerRow = container.querySelector(".opencom-composer-row");
    const pendingList = container.querySelector(".opencom-pending-attachments");
    const attachButton = screen.getByLabelText("Attach files");
    const messageInput = screen.getByTestId("widget-message-input");
    const sendButton = screen.getByTestId("widget-send-button");
    const attachmentName = screen.getByText("screenshot-one.png");

    expect(composerRow).toBeTruthy();
    expect(pendingList).toBeTruthy();
    expect(composerRow).toContainElement(attachButton);
    expect(composerRow).toContainElement(messageInput);
    expect(composerRow).toContainElement(sendButton);
    expect(composerRow).not.toContainElement(attachmentName);
    expect(pendingList).toContainElement(attachmentName);
  });
});
