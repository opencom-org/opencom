"use client";

export type SurveyEditorTab = "builder" | "targeting" | "settings" | "analytics";

export type QuestionType =
  | "nps"
  | "numeric_scale"
  | "star_rating"
  | "emoji_rating"
  | "dropdown"
  | "short_text"
  | "long_text"
  | "multiple_choice";

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  storeAsAttribute?: string;
  options?: {
    scaleStart?: number;
    scaleEnd?: number;
    startLabel?: string;
    endLabel?: string;
    starLabels?: { low?: string; high?: string };
    emojiCount?: 3 | 5;
    emojiLabels?: { low?: string; high?: string };
    choices?: string[];
    allowMultiple?: boolean;
  };
}

export interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: string;
  totalResponses: number;
  distribution: Record<string, number>;
  average?: number;
  npsScore?: number;
}

export type SurveyTriggers = {
  type: "immediate" | "page_visit" | "time_on_page" | "event";
  pageUrl?: string;
  pageUrlMatch?: "exact" | "contains" | "regex";
  delaySeconds?: number;
  eventName?: string;
};

export type SurveyFrequency = "once" | "until_completed";

export type SurveyScheduling = { startDate?: number; endDate?: number };

export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "nps", label: "NPS", description: "Net Promoter Score (0-10)" },
  { value: "numeric_scale", label: "Numeric Scale", description: "Custom number range" },
  { value: "star_rating", label: "Star Rating", description: "5-star rating" },
  { value: "emoji_rating", label: "Emoji Rating", description: "3 or 5 emoji scale" },
  { value: "dropdown", label: "Dropdown", description: "Single selection from list" },
  { value: "short_text", label: "Short Text", description: "Up to 255 characters" },
  { value: "long_text", label: "Long Text", description: "Up to 2,000 characters" },
  { value: "multiple_choice", label: "Multiple Choice", description: "Single or multi-select" },
];

export function generateSurveyQuestionId(): string {
  return Math.random().toString(36).substring(2, 15);
}
