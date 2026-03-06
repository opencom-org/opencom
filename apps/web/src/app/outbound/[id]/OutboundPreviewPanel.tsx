"use client";

import { Button } from "@opencom/ui";
import {
  getPostPreviewButtons,
  type MessageContent,
  type MessageType,
  type PostButtonFormState,
} from "./editorState";

interface OutboundPreviewPanelProps {
  messageType: MessageType;
  content: MessageContent;
  postButtonForm: PostButtonFormState;
  clickActionSummary: string;
}

export function OutboundPreviewPanel({
  messageType,
  content,
  postButtonForm,
  clickActionSummary,
}: OutboundPreviewPanelProps) {
  return (
    <div className="bg-gray-100 border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Preview</h2>
      <div className="flex justify-center">{renderPreview(messageType, content, postButtonForm)}</div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 border-t pt-3">
        <span className="font-medium text-gray-700">Click action:</span>
        <span className="font-medium text-gray-700">{clickActionSummary}</span>
      </div>
    </div>
  );
}

function renderPreview(
  messageType: MessageType,
  content: MessageContent,
  postButtonForm: PostButtonFormState
) {
  switch (messageType) {
    case "chat":
      return (
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/50 flex items-center justify-center text-white text-sm">
              {content.senderId ? "A" : "B"}
            </div>
            <div className="flex-1">
              <div className="bg-gray-100 rounded-lg p-3">
                <p className="text-sm">{content.text || "Your message here..."}</p>
              </div>
            </div>
          </div>
        </div>
      );

    case "post": {
      const postPreviewButtons = getPostPreviewButtons(postButtonForm);

      return (
        <div className="bg-white rounded-lg shadow-lg max-w-md overflow-hidden">
          {content.imageUrl && <img src={content.imageUrl} alt="" className="w-full h-40 object-cover" />}
          {content.videoUrl && (
            <video src={content.videoUrl} controls className="w-full max-h-64 bg-black" />
          )}
          <div className="p-6">
            <h3 className="text-xl font-bold mb-2">{content.title || "Title"}</h3>
            <p className="text-gray-600">{content.body || "Your announcement content..."}</p>
            {postPreviewButtons.length > 0 && (
              <div className="mt-4 flex gap-2">
                {postPreviewButtons.map((button, index) =>
                  button.variant === "secondary" ? (
                    <Button key={`${button.text}-${index}`} size="sm" variant="outline">
                      {button.text}
                    </Button>
                  ) : (
                    <Button key={`${button.text}-${index}`} size="sm">
                      {button.text}
                    </Button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    case "banner":
      return (
        <div
          className={`${content.style === "floating" ? "shadow-lg" : ""} bg-primary text-white p-3 flex items-center justify-between`}
        >
          <p className="text-sm font-medium">{content.text || "Your banner text..."}</p>
          {content.dismissible !== false && (
            <button className="text-white/80 hover:text-white">x</button>
          )}
        </div>
      );
  }
}
