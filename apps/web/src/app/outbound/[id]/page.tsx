"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, Play, Pause, Eye } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";
import type { MessageFrequency, MessageTrigger } from "@opencom/types";
import {
  OutboundMessageTypeIcon,
  getOutboundMessageStatusBadgeClass,
} from "../outboundMessageUi";
import { OutboundClickActionPanel } from "./OutboundClickActionPanel";
import { OutboundContentEditor } from "./OutboundContentEditor";
import { OutboundFieldLabel } from "./OutboundFieldLabel";
import { OutboundPreviewPanel } from "./OutboundPreviewPanel";
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/outbound">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <OutboundMessageTypeIcon type={message.type} className="h-5 w-5" />
            <h1 className="text-2xl font-bold capitalize">{message.type} Message</h1>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getOutboundMessageStatusBadgeClass(message.status)}`}
          >
            {message.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button variant="outline" onClick={handleToggleStatus}>
            {message.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

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

          {/* Frequency */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Frequency</h2>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="once">Once per user</option>
              <option value="once_per_session">Once per session</option>
              <option value="always">Every time conditions are met</option>
            </select>
          </div>

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

          {/* Stats */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            {stats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Shown</span>
                  <span className="font-medium">{stats.shown}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Clicked</span>
                  <span className="font-medium">{stats.clicked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dismissed</span>
                  <span className="font-medium">{stats.dismissed}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-gray-600">Click Rate</span>
                  <span className="font-medium">{stats.clickRate.toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No data yet</p>
            )}
          </div>
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
