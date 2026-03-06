"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@opencom/ui";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";
import type { MessageFrequency, MessageTrigger } from "@opencom/types";
import { OutboundClickActionPanel } from "./OutboundClickActionPanel";
import { OutboundContentEditor } from "./OutboundContentEditor";
import { OutboundEditorHeader } from "./OutboundEditorHeader";
import { OutboundFieldLabel } from "./OutboundFieldLabel";
import { OutboundFrequencyPanel } from "./OutboundFrequencyPanel";
import { OutboundPreviewPanel } from "./OutboundPreviewPanel";
import { OutboundStatisticsPanel } from "./OutboundStatisticsPanel";
import { OutboundTriggerPanel } from "./OutboundTriggerPanel";
import {
  createDefaultClickActionFormState,
  createDefaultPostButtonFormState,
  MessageContent,
  getClickActionSummary,
  toClickActionFormState,
  toMessageClickAction,
  toPostButtonFormState,
  toPostButtons,
  type ClickActionFormState,
  type MessageButton,
  type PostButtonFormState,
} from "./editorState";

function MessageBuilderContent() {
  const params = useParams();
  const messageId = params.id as Id<"outboundMessages">;
  const { activeWorkspace } = useAuth();

  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const message = useQuery(api.outboundMessages.get, { id: messageId });
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const stats = useQuery(api.outboundMessages.getStats, { id: messageId });
  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const updateMessage = useMutation(api.outboundMessages.update);
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const activateMessage = useMutation(api.outboundMessages.activate);
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const pauseMessage = useMutation(api.outboundMessages.pause);

  const [name, setName] = useState("");
  const [content, setContent] = useState<MessageContent>({});
  const [triggers, setTriggers] = useState<MessageTrigger>({ type: "immediate" });
  const [frequency, setFrequency] = useState<MessageFrequency>("once");
  const [showPreview, setShowPreview] = useState(false);
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(null);
  const [clickActionForm, setClickActionForm] = useState<ClickActionFormState>(
    createDefaultClickActionFormState()
  );
  const [postButtonForm, setPostButtonForm] = useState<PostButtonFormState>(
    createDefaultPostButtonFormState()
  );

  const articles = useQuery(
    api.articles.list,
    activeWorkspace?._id
      ? { workspaceId: activeWorkspace._id, status: "published" as const }
      : "skip"
  );

  useEffect(() => {
    if (message) {
      setName(message.name);
      setContent(message.content);
      setTriggers(message.triggers || { type: "immediate" });
      setFrequency(message.frequency || "once");
      setAudienceRules(toInlineAudienceRule(message.audienceRules ?? message.targeting));
      setClickActionForm(
        toClickActionFormState(message.content.clickAction as MessageContent["clickAction"])
      );

      if (message.type === "post") {
        setPostButtonForm(toPostButtonFormState((message.content.buttons ?? []) as MessageButton[]));
      } else {
        setPostButtonForm(createDefaultPostButtonFormState());
      }
    }
  }, [message]);

  const handleSave = async () => {
    if (!message) {
      return;
    }

    const clickAction = toMessageClickAction(clickActionForm);

    const nextContent: MessageContent = {
      ...content,
      clickAction,
    };

    if (message.type === "post") {
      nextContent.buttons = toPostButtons(postButtonForm);
    }

    await updateMessage({
      id: messageId,
      name,
      content: nextContent,
      triggers,
      frequency,
      targeting: audienceRules ?? undefined,
    });
  };

  const handleToggleStatus = async () => {
    if (message?.status === "active") {
      await pauseMessage({ id: messageId });
    } else {
      await activateMessage({ id: messageId });
    }
  };

  if (!message) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <OutboundEditorHeader
        messageType={message.type}
        status={message.status}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        onToggleStatus={handleToggleStatus}
        onSave={handleSave}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Info</h2>
            <div>
              <OutboundFieldLabel>Name</OutboundFieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Message name (internal)"
              />
            </div>
          </div>

          {/* Content */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Content</h2>
            <OutboundContentEditor
              messageType={message.type}
              content={content}
              setContent={setContent}
              members={members}
              articles={articles}
              postButtonForm={postButtonForm}
              setPostButtonForm={setPostButtonForm}
            />
          </div>

          <OutboundTriggerPanel value={triggers} onChange={setTriggers} />

          <OutboundFrequencyPanel value={frequency} onChange={setFrequency} />

          <OutboundClickActionPanel
            articles={articles}
            clickActionForm={clickActionForm}
            setClickActionForm={setClickActionForm}
          />

          {/* Audience Targeting */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Audience Targeting</h2>
            <p className="text-sm text-gray-500 mb-4">
              Target specific users based on their properties, custom attributes, or behavior.
            </p>
            <AudienceRuleBuilder
              value={audienceRules}
              onChange={(rules: AudienceRule | null) =>
                setAudienceRules(toInlineAudienceRuleFromBuilder(rules))
              }
              eventNames={eventNames ?? []}
              workspaceId={activeWorkspace?._id}
              showSegmentSelector={false}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview */}
          {showPreview && (
            <OutboundPreviewPanel
              messageType={message.type}
              content={content}
              postButtonForm={postButtonForm}
              clickActionSummary={getClickActionSummary(clickActionForm)}
            />
          )}

          <OutboundStatisticsPanel stats={stats} />
        </div>
      </div>
    </div>
  );
}

export default function MessageBuilderPage() {
  return (
    <AppLayout>
      <MessageBuilderContent />
    </AppLayout>
  );
}
