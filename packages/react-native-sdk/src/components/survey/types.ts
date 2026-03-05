import type { ViewStyle } from "react-native";
import type { Id } from "@opencom/convex/dataModel";

export type QuestionType =
  | "nps"
  | "numeric_scale"
  | "star_rating"
  | "emoji_rating"
  | "dropdown"
  | "short_text"
  | "long_text"
  | "multiple_choice";

export interface SurveyQuestion {
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

export interface OpencomSurveyProps {
  survey: Survey;
  onDismiss?: () => void;
  onComplete?: () => void;
  style?: ViewStyle;
  primaryColor?: string;
}
