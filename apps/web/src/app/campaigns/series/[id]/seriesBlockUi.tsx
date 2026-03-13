"use client";

import { Bell, Clock, Filter, GitBranch, Mail, MessageSquare, Tag } from "lucide-react";
import type { BlockType } from "./seriesEditorTypes";

export const SERIES_BLOCK_TYPES: BlockType[] = [
  "rule",
  "wait",
  "email",
  "push",
  "chat",
  "post",
  "carousel",
  "tag",
];

export function getSeriesBlockIcon(type: BlockType): React.JSX.Element {
  switch (type) {
    case "rule":
      return <Filter className="h-4 w-4" />;
    case "wait":
      return <Clock className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "push":
      return <Bell className="h-4 w-4" />;
    case "chat":
      return <MessageSquare className="h-4 w-4" />;
    case "post":
      return <MessageSquare className="h-4 w-4" />;
    case "carousel":
      return <GitBranch className="h-4 w-4" />;
    case "tag":
      return <Tag className="h-4 w-4" />;
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return <MessageSquare className="h-4 w-4" />;
    }
  }
}

export function getSeriesBlockColor(type: BlockType): string {
  switch (type) {
    case "rule":
      return "bg-purple-100 border-purple-300";
    case "wait":
      return "bg-yellow-100 border-yellow-300";
    case "email":
      return "bg-primary/10 border-primary/30";
    case "push":
      return "bg-green-100 border-green-300";
    case "chat":
      return "bg-cyan-100 border-cyan-300";
    case "post":
      return "bg-indigo-100 border-indigo-300";
    case "carousel":
      return "bg-pink-100 border-pink-300";
    case "tag":
      return "bg-orange-100 border-orange-300";
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return "bg-gray-100 border-gray-300";
    }
  }
}
