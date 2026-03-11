"use client";

import type { Dispatch, SetStateAction } from "react";
import { MousePointerClick } from "lucide-react";
import { Input } from "@opencom/ui";
import type { Id } from "@opencom/convex/dataModel";
import {
  CLICK_ACTION_OPTIONS,
  WIDGET_TAB_OPTIONS,
  type ClickActionFormState,
  type MessageClickActionType,
} from "./editorState";
import { OutboundFieldLabel } from "./OutboundFieldLabel";

interface ArticleOption {
  _id: Id<"articles">;
  title: string;
}

interface OutboundClickActionPanelProps {
  articles?: readonly ArticleOption[];
  clickActionForm: ClickActionFormState;
  setClickActionForm: Dispatch<SetStateAction<ClickActionFormState>>;
}

export function OutboundClickActionPanel({
  articles,
  clickActionForm,
  setClickActionForm,
}: OutboundClickActionPanelProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MousePointerClick className="h-5 w-5" />
        Click Action
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Choose what happens when a visitor clicks the message body.
      </p>
      <div className="space-y-4">
        <div>
          <OutboundFieldLabel>Action Type</OutboundFieldLabel>
          <select
            value={clickActionForm.type}
            onChange={(e) =>
              setClickActionForm((prev) => ({
                ...prev,
                type: e.target.value as MessageClickActionType,
              }))
            }
            className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CLICK_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {clickActionForm.type === "open_new_conversation" && (
          <div>
            <OutboundFieldLabel>Prefill Message (optional)</OutboundFieldLabel>
            <Input
              value={clickActionForm.prefillMessage}
              onChange={(e) =>
                setClickActionForm((prev) => ({
                  ...prev,
                  prefillMessage: e.target.value,
                }))
              }
              placeholder="I'd like to learn more about..."
            />
          </div>
        )}

        {clickActionForm.type === "open_widget_tab" && (
          <div>
            <OutboundFieldLabel>Tab</OutboundFieldLabel>
            <select
              value={clickActionForm.tabId}
              onChange={(e) => setClickActionForm((prev) => ({ ...prev, tabId: e.target.value }))}
              className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a tab...</option>
              {WIDGET_TAB_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {clickActionForm.type === "open_help_article" && (
          <div>
            <OutboundFieldLabel>Article</OutboundFieldLabel>
            <select
              value={clickActionForm.articleId}
              onChange={(e) =>
                setClickActionForm((prev) => ({ ...prev, articleId: e.target.value }))
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

        {clickActionForm.type === "open_url" && (
          <div>
            <OutboundFieldLabel>URL</OutboundFieldLabel>
            <Input
              value={clickActionForm.url}
              onChange={(e) => setClickActionForm((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/pricing"
            />
          </div>
        )}
      </div>
    </div>
  );
}
