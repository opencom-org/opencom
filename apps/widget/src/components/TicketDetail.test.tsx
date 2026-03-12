import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { TicketDetail } from "./TicketDetail";

describe("TicketDetail attachments", () => {
  it("renders ticket and comment attachments and allows removing queued reply files", () => {
    const onRemoveAttachment = vi.fn();

    render(
      <TicketDetail
        ticket={{
          subject: "Billing ticket",
          status: "submitted",
          description: "Please review the attached screenshot.",
          attachments: [
            {
              _id: "ticket-attachment-1",
              fileName: "billing-screenshot.png",
              mimeType: "image/png",
              size: 2048,
              url: "https://example.com/billing-screenshot.png",
            },
          ],
          comments: [
            {
              _id: "comment-1",
              authorType: "agent",
              content: "Here is the log we reviewed.",
              createdAt: Date.now(),
              isInternal: false,
              attachments: [
                {
                  _id: "comment-attachment-1",
                  fileName: "support-log.txt",
                  mimeType: "text/plain",
                  size: 1024,
                  url: "https://example.com/support-log.txt",
                },
              ],
            },
          ],
        }}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onAddComment={vi.fn().mockResolvedValue(undefined)}
        onUploadAttachments={vi.fn()}
        onRemoveAttachment={onRemoveAttachment}
        pendingAttachments={[
          {
            attachmentId: "pending-attachment-1" as Id<"supportAttachments">,
            fileName: "queued-reply.png",
            mimeType: "image/png",
            size: 4096,
            status: "staged",
          },
        ]}
        isUploadingAttachments={false}
        errorFeedback={null}
      />
    );

    expect(screen.getByText("billing-screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("support-log.txt")).toBeInTheDocument();
    expect(screen.getByText("queued-reply.png")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Remove queued-reply.png"));
    expect(onRemoveAttachment).toHaveBeenCalledWith(
      "pending-attachment-1" as Id<"supportAttachments">
    );
  });
});
