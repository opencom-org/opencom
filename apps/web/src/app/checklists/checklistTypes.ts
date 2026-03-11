import type { Id } from "@opencom/convex/dataModel";
import type { InlineAudienceRule } from "@/lib/audienceRules";

export type ChecklistStatus = "draft" | "active" | "archived";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = Record<string, JsonPrimitive>;
export type JsonValue = JsonPrimitive | JsonPrimitive[] | JsonObject;

export interface ChecklistTask {
  id: string;
  title: string;
  description?: string;
  action?: {
    type: "tour" | "url" | "event";
    tourId?: Id<"tours">;
    url?: string;
    eventName?: string;
  };
  completionType: "manual" | "auto_event" | "auto_attribute";
  completionEvent?: string;
  completionAttribute?: {
    key: string;
    operator: string;
    value?: JsonValue;
  };
}

export type ChecklistListItem = {
  _id: Id<"checklists">;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
  status: ChecklistStatus;
  createdAt: number;
};

export type ChecklistDetailRecord = {
  _id: Id<"checklists">;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
  status: ChecklistStatus;
  audienceRules?: InlineAudienceRule | null;
  targeting?: InlineAudienceRule | null;
};
