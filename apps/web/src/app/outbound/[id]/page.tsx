"use client";

import { AppLayout } from "@/components/AppLayout";
import { Input } from "@opencom/ui";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { OutboundClickActionPanel } from "./OutboundClickActionPanel";
import { OutboundContentEditor } from "./OutboundContentEditor";
import { OutboundEditorHeader } from "./OutboundEditorHeader";
import { OutboundFieldLabel } from "./OutboundFieldLabel";
import { OutboundFrequencyPanel } from "./OutboundFrequencyPanel";
import { OutboundPreviewPanel } from "./OutboundPreviewPanel";
import { OutboundStatisticsPanel } from "./OutboundStatisticsPanel";
import { OutboundTriggerPanel } from "./OutboundTriggerPanel";
import { useOutboundMessageEditorController } from "../hooks/useOutboundMessageEditorController";

function MessageBuilderContent() {
  const {
    activeWorkspace,
    audienceRules,
    clickActionForm,
    clickActionSummary,
    content,
    eventNames,
    frequency,
    handleSave,
    handleToggleStatus,
    members,
    message,
    name,
    postButtonForm,
    publicArticleOptions,
    setAudienceRules,
    setClickActionForm,
    setContent,
    setFrequency,
    setName,
    setPostButtonForm,
    setShowPreview,
    setTriggers,
    showPreview,
    stats,
    toInlineAudienceRuleFromBuilder,
    triggers,
  } = useOutboundMessageEditorController();

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
              articles={publicArticleOptions}
              postButtonForm={postButtonForm}
              setPostButtonForm={setPostButtonForm}
            />
          </div>

          <OutboundTriggerPanel value={triggers} onChange={setTriggers} />

          <OutboundFrequencyPanel value={frequency} onChange={setFrequency} />

          <OutboundClickActionPanel
            articles={publicArticleOptions}
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
              clickActionSummary={clickActionSummary}
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
