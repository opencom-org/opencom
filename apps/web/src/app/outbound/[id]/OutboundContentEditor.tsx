"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@opencom/ui";
import type { Id } from "@opencom/convex/dataModel";
import {
  POST_PRIMARY_ACTION_OPTIONS,
  WIDGET_TAB_OPTIONS,
  type MessageContent,
  type MessageType,
  type PostButtonFormState,
  type PostPrimaryActionType,
} from "./editorState";
import { OutboundFieldLabel } from "./OutboundFieldLabel";

interface MemberOption {
  userId: Id<"users">;
  name?: string | null;
  email?: string | null;
}

interface ArticleOption {
  _id: Id<"articles">;
  title: string;
}

interface OutboundContentEditorProps {
  messageType: MessageType;
  content: MessageContent;
  setContent: Dispatch<SetStateAction<MessageContent>>;
  members?: readonly MemberOption[];
  articles?: readonly ArticleOption[];
  postButtonForm: PostButtonFormState;
  setPostButtonForm: Dispatch<SetStateAction<PostButtonFormState>>;
}

export function OutboundContentEditor({
  messageType,
  content,
  setContent,
  members,
  articles,
  postButtonForm,
  setPostButtonForm,
}: OutboundContentEditorProps) {
  switch (messageType) {
    case "chat":
      return (
        <div className="space-y-4">
          <div>
            <OutboundFieldLabel>Message Text</OutboundFieldLabel>
            <textarea
              value={content.text || ""}
              onChange={(e) => setContent({ ...content, text: e.target.value })}
              className="w-full mt-1 p-3 border rounded-md min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your chat message..."
            />
          </div>
          <div>
            <OutboundFieldLabel>Sender</OutboundFieldLabel>
            <select
              value={content.senderId || ""}
              onChange={(e) =>
                setContent({ ...content, senderId: (e.target.value as Id<"users">) || undefined })
              }
              className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Bot (default)</option>
              {members?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      );

    case "post":
      return (
        <div className="space-y-4">
          <div>
            <OutboundFieldLabel>Title</OutboundFieldLabel>
            <Input
              value={content.title || ""}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              placeholder="Announcement title"
            />
          </div>
          <div>
            <OutboundFieldLabel>Body</OutboundFieldLabel>
            <textarea
              value={content.body || ""}
              onChange={(e) => setContent({ ...content, body: e.target.value })}
              className="w-full mt-1 p-3 border rounded-md min-h-[150px] focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your announcement content..."
            />
          </div>
          <div>
            <OutboundFieldLabel>Image URL (optional)</OutboundFieldLabel>
            <Input
              value={content.imageUrl || ""}
              onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
              placeholder="https://example.com/image.png"
            />
          </div>

          <div>
            <OutboundFieldLabel>Video URL (optional)</OutboundFieldLabel>
            <Input
              value={content.videoUrl || ""}
              onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
              placeholder="https://example.com/video.mp4"
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Post Buttons</h3>

            <div>
              <OutboundFieldLabel>Primary CTA Label</OutboundFieldLabel>
              <Input
                value={postButtonForm.primaryButtonText}
                onChange={(e) =>
                  setPostButtonForm((prev) => ({ ...prev, primaryButtonText: e.target.value }))
                }
                placeholder="Learn More"
              />
            </div>

            <div>
              <OutboundFieldLabel>Primary CTA Action</OutboundFieldLabel>
              <select
                value={postButtonForm.primaryActionType}
                onChange={(e) =>
                  setPostButtonForm((prev) => ({
                    ...prev,
                    primaryActionType: e.target.value as PostPrimaryActionType,
                  }))
                }
                className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {POST_PRIMARY_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {postButtonForm.primaryActionType === "open_new_conversation" && (
              <div>
                <OutboundFieldLabel>Prefill Message (optional)</OutboundFieldLabel>
                <Input
                  value={postButtonForm.primaryActionPrefillMessage}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({
                      ...prev,
                      primaryActionPrefillMessage: e.target.value,
                    }))
                  }
                  placeholder="I'd like to learn more about..."
                />
              </div>
            )}

            {postButtonForm.primaryActionType === "open_widget_tab" && (
              <div>
                <OutboundFieldLabel>Widget Tab</OutboundFieldLabel>
                <select
                  value={postButtonForm.primaryActionTabId}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({ ...prev, primaryActionTabId: e.target.value }))
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {WIDGET_TAB_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {postButtonForm.primaryActionType === "open_help_article" && (
              <div>
                <OutboundFieldLabel>Help Article</OutboundFieldLabel>
                <select
                  value={postButtonForm.primaryActionArticleId}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({
                      ...prev,
                      primaryActionArticleId: e.target.value,
                    }))
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select an article...</option>
                  {articles?.map((article) => (
                    <option key={article._id} value={article._id}>
                      {article.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {postButtonForm.primaryActionType === "url" && (
              <div>
                <OutboundFieldLabel>Destination URL</OutboundFieldLabel>
                <Input
                  value={postButtonForm.primaryActionUrl}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({ ...prev, primaryActionUrl: e.target.value }))
                  }
                  placeholder="https://example.com/pricing"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                id="post-dismiss-enabled"
                type="checkbox"
                checked={postButtonForm.dismissEnabled}
                onChange={(e) =>
                  setPostButtonForm((prev) => ({ ...prev, dismissEnabled: e.target.checked }))
                }
                className="rounded"
              />
              <OutboundFieldLabel htmlFor="post-dismiss-enabled">
                Show dismiss button
              </OutboundFieldLabel>
            </div>

            {postButtonForm.dismissEnabled && (
              <div>
                <OutboundFieldLabel>Dismiss Label</OutboundFieldLabel>
                <Input
                  value={postButtonForm.dismissButtonText}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({ ...prev, dismissButtonText: e.target.value }))
                  }
                  placeholder="Dismiss"
                />
              </div>
            )}
          </div>
        </div>
      );

    case "banner":
      return (
        <div className="space-y-4">
          <div>
            <OutboundFieldLabel>Banner Text</OutboundFieldLabel>
            <Input
              value={content.text || ""}
              onChange={(e) => setContent({ ...content, text: e.target.value })}
              placeholder="Enter banner text..."
            />
          </div>
          <div>
            <OutboundFieldLabel>Style</OutboundFieldLabel>
            <select
              value={content.style || "inline"}
              onChange={(e) =>
                setContent({ ...content, style: e.target.value as "inline" | "floating" })
              }
              className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="inline">Inline (pushes content down)</option>
              <option value="floating">Floating (overlays content)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dismissible"
              checked={content.dismissible !== false}
              onChange={(e) => setContent({ ...content, dismissible: e.target.checked })}
              className="rounded"
            />
            <OutboundFieldLabel htmlFor="dismissible">Allow users to dismiss</OutboundFieldLabel>
          </div>
        </div>
      );
  }
}
