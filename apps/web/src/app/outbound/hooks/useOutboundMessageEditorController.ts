"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";
import type { MessageFrequency, MessageTrigger } from "@opencom/types";
import {
  createDefaultClickActionFormState,
  createDefaultPostButtonFormState,
  type ClickActionFormState,
  type MessageContent,
  type PostButtonFormState,
  getClickActionSummary,
  toClickActionFormState,
  toMessageClickAction,
  toPostButtonFormState,
  toPostButtons,
} from "../[id]/editorState";
import { useOutboundMessageEditorConvex } from "./useOutboundMessageEditorConvex";

export function useOutboundMessageEditorController() {
  const params = useParams();
  const messageId = params.id as Id<"outboundMessages">;
  const { activeWorkspace } = useAuth();
  const { activateMessage, eventNames, members, message, pauseMessage, publicArticles, stats, updateMessage } =
    useOutboundMessageEditorConvex({
      messageId,
      workspaceId: activeWorkspace?._id,
    });

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

  const publicArticleOptions = publicArticles?.map((article) => ({
    _id: article._id,
    title: article.title,
  }));

  useEffect(() => {
    if (!message) {
      return;
    }

    setName(message.name);
    setContent(message.content);
    setTriggers(message.triggers || { type: "immediate" });
    setFrequency(message.frequency || "once");
    setAudienceRules(toInlineAudienceRule(message.audienceRules ?? message.targeting));
    setClickActionForm(toClickActionFormState(message.content.clickAction));

    if (message.type === "post") {
      setPostButtonForm(toPostButtonFormState(message.content.buttons ?? []));
      return;
    }

    setPostButtonForm(createDefaultPostButtonFormState());
  }, [message]);

  const handleSave = async () => {
    if (!message) {
      return;
    }

    const nextContent: MessageContent = {
      ...content,
      clickAction: toMessageClickAction(clickActionForm),
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
      return;
    }

    await activateMessage({ id: messageId });
  };

  return {
    activeWorkspace,
    audienceRules,
    clickActionForm,
    clickActionSummary: getClickActionSummary(clickActionForm),
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
  };
}
