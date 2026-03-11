"use client";

import type { Id } from "@opencom/convex/dataModel";
import type {
  Question,
  QuestionAnalytics,
  SurveyFrequency,
  SurveyScheduling,
  SurveyTriggers,
} from "../[id]/surveyEditorTypes";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type SurveyArgs = {
  id: Id<"surveys">;
};

type SurveyStatus = "draft" | "active" | "paused" | "archived";

const SURVEYS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs & { status?: SurveyStatus },
  Array<{
    _id: Id<"surveys">;
    name: string;
    description?: string;
    format: string;
    questions: unknown[];
    status: SurveyStatus;
    createdAt: number;
  }>
>("surveys:list");
const CREATE_SURVEY_REF = webMutationRef<
  WorkspaceArgs & { name: string; format: string },
  Id<"surveys">
>("surveys:create");
const DELETE_SURVEY_REF = webMutationRef<SurveyArgs, null>("surveys:remove");
const ACTIVATE_SURVEY_REF = webMutationRef<SurveyArgs, null>("surveys:activate");
const PAUSE_SURVEY_REF = webMutationRef<SurveyArgs, null>("surveys:pause");
const DUPLICATE_SURVEY_REF = webMutationRef<SurveyArgs, Id<"surveys"> | null>(
  "surveys:duplicate"
);
const SURVEY_QUERY_REF = webQueryRef<
  SurveyArgs,
  {
    _id: Id<"surveys">;
    name: string;
    description?: string;
    format: "small" | "large";
    questions: Question[];
    introStep?: { title: string; description?: string; buttonText?: string } | null;
    thankYouStep?: { title: string; description?: string; buttonText?: string } | null;
    showProgressBar?: boolean;
    showDismissButton?: boolean;
    audienceRules?: unknown;
    triggers?: SurveyTriggers;
    frequency?: SurveyFrequency;
    scheduling?: SurveyScheduling;
    status: SurveyStatus;
  } | null
>("surveys:get");
const SURVEY_ANALYTICS_QUERY_REF = webQueryRef<
  { surveyId: Id<"surveys"> },
  {
    impressions: { shown: number; started: number };
    totalResponses: number;
    responseRate: number;
    questionAnalytics: Record<string, QuestionAnalytics>;
  } | undefined
>("surveys:getAnalytics");
const UPDATE_SURVEY_REF = webMutationRef<
  {
    id: Id<"surveys">;
    name?: string;
    description?: string;
    format?: "small" | "large";
    questions?: Question[];
    introStep?: { title: string; description?: string; buttonText?: string };
    thankYouStep?: { title: string; description?: string; buttonText?: string };
    showProgressBar?: boolean;
    showDismissButton?: boolean;
    audienceRules?: unknown;
    triggers?: SurveyTriggers;
    frequency?: SurveyFrequency;
    scheduling?: SurveyScheduling;
  },
  null
>("surveys:update");
const EXPORT_SURVEY_RESPONSES_CSV_REF = webMutationRef<
  { surveyId: Id<"surveys"> },
  { csv: string; fileName: string }
>("surveys:exportResponsesCsv");

export function useSurveysPageConvex(
  workspaceId?: Id<"workspaces"> | null,
  status?: SurveyStatus
) {
  return {
    activateSurvey: useWebMutation(ACTIVATE_SURVEY_REF),
    createSurvey: useWebMutation(CREATE_SURVEY_REF),
    deleteSurvey: useWebMutation(DELETE_SURVEY_REF),
    duplicateSurvey: useWebMutation(DUPLICATE_SURVEY_REF),
    pauseSurvey: useWebMutation(PAUSE_SURVEY_REF),
    surveys: useWebQuery(
      SURVEYS_LIST_QUERY_REF,
      workspaceId ? { workspaceId, status } : "skip"
    ),
  };
}

export function useSurveyBuilderConvex(surveyId: Id<"surveys">) {
  return {
    activateSurvey: useWebMutation(ACTIVATE_SURVEY_REF),
    analytics: useWebQuery(SURVEY_ANALYTICS_QUERY_REF, { surveyId }),
    exportResponsesCsv: useWebMutation(EXPORT_SURVEY_RESPONSES_CSV_REF),
    pauseSurvey: useWebMutation(PAUSE_SURVEY_REF),
    survey: useWebQuery(SURVEY_QUERY_REF, { id: surveyId }),
    updateSurvey: useWebMutation(UPDATE_SURVEY_REF),
  };
}
