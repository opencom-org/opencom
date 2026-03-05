"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { toInlineAudienceRule, type InlineAudienceRule } from "@/lib/audienceRules";
import {
  ArrowLeft,
  Plus,
  Save,
  Play,
  Pause,
  BarChart3,
  Settings,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { SurveyBuilderTab } from "./SurveyBuilderTab";
import { SurveyTargetingTab } from "./SurveyTargetingTab";
import { SurveySettingsTab } from "./SurveySettingsTab";
import { SurveyAnalyticsTab } from "./SurveyAnalyticsTab";
import {
  type Question,
  type SurveyEditorTab,
  type SurveyFrequency,
  type SurveyScheduling,
  type SurveyTriggers,
} from "./surveyEditorTypes";
import { useSurveyQuestionEditor } from "./useSurveyQuestionEditor";

function SurveyBuilderContent() {
  const params = useParams();
  const { activeWorkspace } = useAuth();
  const surveyId = params.id as Id<"surveys">;

  const survey = useQuery(api.surveys.get, { id: surveyId });
  const analytics = useQuery(api.surveys.getAnalytics, { surveyId });
  const updateSurvey = useMutation(api.surveys.update);
  const activateSurvey = useMutation(api.surveys.activate);
  const pauseSurvey = useMutation(api.surveys.pause);
  const exportResponsesCsv = useMutation(api.surveys.exportResponsesCsv);

  const [activeTab, setActiveTab] = useState<SurveyEditorTab>("builder");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"small" | "large">("small");
  const [introStep, setIntroStep] = useState<{
    title: string;
    description?: string;
    buttonText?: string;
  } | null>(null);
  const [thankYouStep, setThankYouStep] = useState<{
    title: string;
    description?: string;
    buttonText?: string;
  } | null>(null);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showDismissButton, setShowDismissButton] = useState(true);
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(null);
  const [triggers, setTriggers] = useState<SurveyTriggers>({ type: "immediate" });
  const [frequency, setFrequency] = useState<SurveyFrequency>("once");
  const [scheduling, setScheduling] = useState<SurveyScheduling>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const questionEditor = useSurveyQuestionEditor({
    onDirty: () => {
      setHasChanges(true);
    },
  });
  const { setQuestions, setExpandedQuestion } = questionEditor;

  useEffect(() => {
    if (survey) {
      setName(survey.name);
      setDescription(survey.description || "");
      setFormat(survey.format);
      setQuestions(survey.questions as Question[]);
      setExpandedQuestion(null);
      setIntroStep(survey.introStep || null);
      setThankYouStep(survey.thankYouStep || null);
      setShowProgressBar(survey.showProgressBar ?? true);
      setShowDismissButton(survey.showDismissButton ?? true);
      setAudienceRules(toInlineAudienceRule(survey.audienceRules));
      setTriggers(survey.triggers || { type: "immediate" });
      setFrequency(survey.frequency || "once");
      setScheduling(survey.scheduling || {});
    }
  }, [setExpandedQuestion, setQuestions, survey]);

  const handleSave = async () => {
    setSaveError(null);
    const mutationAudienceRules = audienceRules
      ? (audienceRules as Parameters<typeof updateSurvey>[0]["audienceRules"])
      : undefined;

    try {
      await updateSurvey({
        id: surveyId,
        name,
        description: description || undefined,
        format,
        questions: questionEditor.questions,
        introStep: introStep || undefined,
        thankYouStep: thankYouStep || undefined,
        showProgressBar,
        showDismissButton,
        ...(mutationAudienceRules ? { audienceRules: mutationAudienceRules } : {}),
        triggers,
        frequency,
        scheduling: Object.keys(scheduling).length > 0 ? scheduling : undefined,
      });
      setHasChanges(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save survey");
    }
  };

  const handleToggleStatus = async () => {
    setStatusError(null);

    if (survey?.status !== "active" && questionEditor.questions.length === 0) {
      setStatusError("Add at least one question before activating this survey.");
      return;
    }

    try {
      if (survey?.status === "active") {
        await pauseSurvey({ id: surveyId });
      } else {
        await activateSurvey({ id: surveyId });
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Failed to update survey status");
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await exportResponsesCsv({ surveyId });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Failed to export responses");
    } finally {
      setIsExporting(false);
    }
  };

  if (!survey) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/surveys">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setHasChanges(true);
                }}
                className="text-lg font-semibold border-none p-0 h-auto focus:ring-0"
                placeholder="Survey name"
              />
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    survey.status === "active"
                      ? "bg-green-100 text-green-800"
                      : survey.status === "paused"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {survey.status}
                </span>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    format === "small"
                      ? "bg-primary/10 text-primary"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {format} format
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleToggleStatus}>
              {survey.status === "active" ? (
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
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {(saveError || statusError) && (
          <div className="mt-3 space-y-2">
            {saveError && (
              <div
                data-testid="survey-save-error"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {saveError}
              </div>
            )}
            {statusError && (
              <div
                data-testid="survey-status-error"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {statusError}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mt-4">
          {[
            { id: "builder", label: "Builder", icon: Plus },
            { id: "targeting", label: "Targeting", icon: Eye },
            { id: "settings", label: "Settings", icon: Settings },
            { id: "analytics", label: "Analytics", icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              data-testid={`survey-tab-${tab.id}`}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === tab.id
                  ? "bg-primary/5 text-primary"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {activeTab === "builder" && (
          <SurveyBuilderTab
            format={format}
            setFormat={setFormat}
            introStep={introStep}
            setIntroStep={setIntroStep}
            thankYouStep={thankYouStep}
            setThankYouStep={setThankYouStep}
            questionEditor={questionEditor}
            onDirty={() => setHasChanges(true)}
          />
        )}

        {activeTab === "targeting" && (
          <SurveyTargetingTab
            workspaceId={activeWorkspace?._id}
            audienceRules={audienceRules}
            setAudienceRules={setAudienceRules}
            triggers={triggers}
            setTriggers={setTriggers}
            frequency={frequency}
            setFrequency={setFrequency}
            scheduling={scheduling}
            setScheduling={setScheduling}
            onDirty={() => setHasChanges(true)}
          />
        )}

        {activeTab === "settings" && (
          <SurveySettingsTab
            format={format}
            showProgressBar={showProgressBar}
            setShowProgressBar={setShowProgressBar}
            showDismissButton={showDismissButton}
            setShowDismissButton={setShowDismissButton}
            description={description}
            setDescription={setDescription}
            onDirty={() => setHasChanges(true)}
          />
        )}

        {activeTab === "analytics" && (
          <SurveyAnalyticsTab
            analytics={analytics}
            isExporting={isExporting}
            exportError={exportError}
            onExportCsv={handleExportCsv}
          />
        )}
      </div>
    </div>
  );
}

export default function SurveyBuilderPage() {
  return (
    <AppLayout>
      <SurveyBuilderContent />
    </AppLayout>
  );
}
