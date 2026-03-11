import { Bell, Flag, MessageSquare } from "lucide-react";
import type { OutboundMessageStatus, OutboundMessageType } from "@opencom/types";

export const OUTBOUND_MESSAGE_TYPE_OPTIONS = [
  { value: "chat", label: "Chat" },
  { value: "post", label: "Post" },
  { value: "banner", label: "Banner" },
] as const satisfies ReadonlyArray<{ value: OutboundMessageType; label: string }>;

export const OUTBOUND_MESSAGE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
] as const satisfies ReadonlyArray<{ value: OutboundMessageStatus; label: string }>;

export function getOutboundMessageStatusBadgeClass(status: OutboundMessageStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "paused":
      return "bg-yellow-100 text-yellow-800";
    case "archived":
      return "bg-red-100 text-red-800";
  }
}

interface OutboundMessageTypeIconProps {
  type: OutboundMessageType;
  className?: string;
}

export function OutboundMessageTypeIcon({
  type,
  className = "h-4 w-4",
}: OutboundMessageTypeIconProps) {
  switch (type) {
    case "chat":
      return <MessageSquare className={className} />;
    case "post":
      return <Bell className={className} />;
    case "banner":
      return <Flag className={className} />;
  }
}
