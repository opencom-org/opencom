import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationMessageList } from "./MessageList";

describe("ConversationMessageList attachments", () => {
  it("renders disabled attachment rows when signed URLs are unavailable", () => {
    render(
      <ConversationMessageList
        messages={[
          {
            _id: "message-1",
            _creationTime: Date.now(),
            senderType: "agent",
            senderId: "agent-1",
            senderName: "Support",
            content: "",
            attachments: [
              {
                _id: "attachment-1",
                fileName: "missing-url.txt",
                mimeType: "text/plain",
                size: 1024,
              },
            ],
          },
        ]}
        aiSettingsEnabled={false}
        isAiMessage={() => false}
        getAiResponseData={() => undefined}
        aiResponseFeedback={{}}
        onAiFeedback={vi.fn()}
        onSelectArticle={vi.fn()}
        showWaitingForHumanSupport={false}
        isAiTyping={false}
        renderedMessages={new Map()}
        messagesEndRef={createRef<HTMLDivElement>()}
      />
    );

    expect(screen.getByText("missing-url.txt")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /missing-url\.txt/i })).not.toBeInTheDocument();
    expect(screen.getByText("missing-url.txt").closest("[aria-disabled='true']")).toBeTruthy();
  });
});
