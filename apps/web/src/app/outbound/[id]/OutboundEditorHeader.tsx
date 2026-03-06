"use client";

import { ArrowLeft, Eye, Pause, Play, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@opencom/ui";
import type { OutboundMessageStatus, OutboundMessageType } from "@opencom/types";
import {
  OutboundMessageTypeIcon,
  getOutboundMessageStatusBadgeClass,
} from "../outboundMessageUi";

interface OutboundEditorHeaderProps {
  messageType: OutboundMessageType;
  status: OutboundMessageStatus;
  showPreview: boolean;
  onTogglePreview: () => void;
  onToggleStatus: () => void;
  onSave: () => void;
}

export function OutboundEditorHeader({
  messageType,
  status,
  showPreview,
  onTogglePreview,
  onToggleStatus,
  onSave,
}: OutboundEditorHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <Link href="/outbound">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <OutboundMessageTypeIcon type={messageType} className="h-5 w-5" />
          <h1 className="text-2xl font-bold capitalize">{messageType} Message</h1>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${getOutboundMessageStatusBadgeClass(status)}`}
        >
          {status}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onTogglePreview}>
          <Eye className="h-4 w-4 mr-2" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
        <Button variant="outline" onClick={onToggleStatus}>
          {status === "active" ? (
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
        <Button onClick={onSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
