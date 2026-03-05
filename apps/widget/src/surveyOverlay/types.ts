import type { Id } from "@opencom/convex/dataModel";

export interface SurveyQuestion {
  id: string;
  type:
    | "nps"
    | "numeric_scale"
    | "star_rating"
    | "emoji_rating"
    | "dropdown"
    | "short_text"
    | "long_text"
    | "multiple_choice";
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

export interface Survey {
  _id: Id<"surveys">;
  name: string;
  format: "small" | "large";
  questions: SurveyQuestion[];
  introStep?: { title: string; description?: string; buttonText?: string };
  thankYouStep?: { title: string; description?: string; buttonText?: string };
  showProgressBar?: boolean;
  showDismissButton?: boolean;
}

export interface SurveyOverlayProps {
  survey: Survey;
  visitorId: Id<"visitors">;
  sessionId?: string;
  sessionToken?: string;
  onComplete: () => void;
  onDismiss: () => void;
  primaryColor?: string;
}

export type SurveyAnswerPrimitive = string | number | boolean | null;
export type SurveyAnswerPrimitiveArray = string[] | number[];
export type SurveyAnswerValue = SurveyAnswerPrimitive | SurveyAnswerPrimitiveArray;
