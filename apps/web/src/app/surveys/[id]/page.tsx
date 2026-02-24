"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { Button, Input, Textarea } from "@opencom/ui";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Play,
  Pause,
  BarChart3,
  Settings,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type QuestionType =
  | "nps"
  | "numeric_scale"
  | "star_rating"
  | "emoji_rating"
  | "dropdown"
  | "short_text"
  | "long_text"
  | "multiple_choice";

interface Question {
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

interface QuestionAnalytics {
  questionId: string;
  questionTitle: string;
  questionType: string;
  totalResponses: number;
  distribution: Record<string, number>;
  average?: number;
  npsScore?: number;
}

const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "nps", label: "NPS", description: "Net Promoter Score (0-10)" },
  { value: "numeric_scale", label: "Numeric Scale", description: "Custom number range" },
  { value: "star_rating", label: "Star Rating", description: "5-star rating" },
  { value: "emoji_rating", label: "Emoji Rating", description: "3 or 5 emoji scale" },
  { value: "dropdown", label: "Dropdown", description: "Single selection from list" },
  { value: "short_text", label: "Short Text", description: "Up to 255 characters" },
  { value: "long_text", label: "Long Text", description: "Up to 2,000 characters" },
  { value: "multiple_choice", label: "Multiple Choice", description: "Single or multi-select" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

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

  const [activeTab, setActiveTab] = useState<"builder" | "targeting" | "settings" | "analytics">(
    "builder"
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<"small" | "large">("small");
  const [questions, setQuestions] = useState<Question[]>([]);
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
  const [triggers, setTriggers] = useState<{
    type: "immediate" | "page_visit" | "time_on_page" | "event";
    pageUrl?: string;
    pageUrlMatch?: "exact" | "contains" | "regex";
    delaySeconds?: number;
    eventName?: string;
  }>({ type: "immediate" });
  const [frequency, setFrequency] = useState<"once" | "until_completed">("once");
  const [scheduling, setScheduling] = useState<{ startDate?: number; endDate?: number }>({});
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (survey) {
      setName(survey.name);
      setDescription(survey.description || "");
      setFormat(survey.format);
      setQuestions(survey.questions as Question[]);
      setIntroStep(survey.introStep || null);
      setThankYouStep(survey.thankYouStep || null);
      setShowProgressBar(survey.showProgressBar ?? true);
      setShowDismissButton(survey.showDismissButton ?? true);
      setAudienceRules(toInlineAudienceRule(survey.audienceRules));
      setTriggers(survey.triggers || { type: "immediate" });
      setFrequency(survey.frequency || "once");
      setScheduling(survey.scheduling || {});
    }
  }, [survey]);

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
        questions,
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

    if (survey?.status !== "active" && questions.length === 0) {
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

  const addQuestion = (type: QuestionType) => {
    const newQuestion: Question = {
      id: generateId(),
      type,
      title: "",
      required: true,
      options: getDefaultOptions(type),
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion.id);
    setHasChanges(true);
  };

  const getDefaultOptions = (type: QuestionType): Question["options"] => {
    switch (type) {
      case "numeric_scale":
        return { scaleStart: 1, scaleEnd: 5, startLabel: "Low", endLabel: "High" };
      case "star_rating":
        return { starLabels: { low: "Poor", high: "Excellent" } };
      case "emoji_rating":
        return { emojiCount: 5, emojiLabels: { low: "Very unhappy", high: "Very happy" } };
      case "dropdown":
      case "multiple_choice":
        return { choices: ["Option 1", "Option 2", "Option 3"], allowMultiple: false };
      default:
        return undefined;
    }
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    setHasChanges(true);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
    setHasChanges(true);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
    setHasChanges(true);
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
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Format Selector */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-2">Survey Format</label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 p-4 border rounded-lg cursor-pointer ${format === "small" ? "border-primary bg-primary/5" : ""}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="small"
                    checked={format === "small"}
                    onChange={() => {
                      setFormat("small");
                      setHasChanges(true);
                    }}
                    className="sr-only"
                  />
                  <div className="font-medium">Small Format</div>
                  <div className="text-sm text-gray-500">Floating banner, 1 question per step</div>
                </label>
                <label
                  className={`flex-1 p-4 border rounded-lg cursor-pointer ${format === "large" ? "border-purple-500 bg-purple-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="large"
                    checked={format === "large"}
                    onChange={() => {
                      setFormat("large");
                      setHasChanges(true);
                    }}
                    className="sr-only"
                  />
                  <div className="font-medium">Large Format</div>
                  <div className="text-sm text-gray-500">
                    Centered modal, up to 3 questions per step
                  </div>
                </label>
              </div>
            </div>

            {/* Intro Step (large format only) */}
            {format === "large" && (
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium">Intro Step</label>
                  {!introStep ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIntroStep({ title: "Welcome!" });
                        setHasChanges(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Intro
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIntroStep(null);
                        setHasChanges(true);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {introStep && (
                  <div className="space-y-3">
                    <Input
                      placeholder="Title"
                      value={introStep.title}
                      onChange={(e) => {
                        setIntroStep({ ...introStep, title: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                    <Textarea
                      placeholder="Description (optional)"
                      value={introStep.description || ""}
                      onChange={(e) => {
                        setIntroStep({ ...introStep, description: e.target.value });
                        setHasChanges(true);
                      }}
                      rows={2}
                    />
                    <Input
                      placeholder="Button text (default: Start)"
                      value={introStep.buttonText || ""}
                      onChange={(e) => {
                        setIntroStep({ ...introStep, buttonText: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Questions */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium">Questions ({questions.length}/12)</label>
              </div>

              {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No questions yet. Add your first question below.
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div key={question.id} className="border rounded-lg">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() =>
                          setExpandedQuestion(expandedQuestion === question.id ? null : question.id)
                        }
                      >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
                            </span>
                            {question.required && (
                              <span className="text-xs text-red-500">Required</span>
                            )}
                          </div>
                          <div className="font-medium">{question.title || "(No title)"}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(index, "up");
                            }}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveQuestion(index, "down");
                            }}
                            disabled={index === questions.length - 1}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeQuestion(question.id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {expandedQuestion === question.id && (
                        <div className="border-t p-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Question Title</label>
                            <Input
                              value={question.title}
                              onChange={(e) =>
                                updateQuestion(question.id, { title: e.target.value })
                              }
                              placeholder="Enter your question"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Description (optional)
                            </label>
                            <Textarea
                              value={question.description || ""}
                              onChange={(e) =>
                                updateQuestion(question.id, { description: e.target.value })
                              }
                              placeholder="Add more context"
                              rows={2}
                            />
                          </div>

                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={question.required}
                                onChange={(e) =>
                                  updateQuestion(question.id, { required: e.target.checked })
                                }
                              />
                              <span className="text-sm">Required</span>
                            </label>
                          </div>

                          {/* Question-specific options */}
                          <QuestionOptions
                            question={question}
                            onUpdate={(options) => updateQuestion(question.id, { options })}
                          />

                          <div>
                            <label className="block text-sm font-medium mb-1">
                              Store as user attribute (optional)
                            </label>
                            <Input
                              value={question.storeAsAttribute || ""}
                              onChange={(e) =>
                                updateQuestion(question.id, { storeAsAttribute: e.target.value })
                              }
                              placeholder="e.g., nps_score"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Save the response as a custom attribute for segmentation
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add Question */}
              {questions.length < 12 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">Add Question</label>
                  <div className="grid grid-cols-4 gap-2">
                    {QUESTION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => addQuestion(type.value)}
                        disabled={type.value === "multiple_choice" && format === "small"}
                        className={`p-3 border rounded-lg text-left hover:bg-gray-50 ${
                          type.value === "multiple_choice" && format === "small"
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        <div className="font-medium text-sm">{type.label}</div>
                        <div className="text-xs text-gray-500">{type.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Thank You Step */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium">Thank You Step</label>
                {!thankYouStep ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setThankYouStep({ title: "Thank you!" });
                      setHasChanges(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Thank You
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setThankYouStep(null);
                      setHasChanges(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {thankYouStep && (
                <div className="space-y-3">
                  <Input
                    placeholder="Title"
                    value={thankYouStep.title}
                    onChange={(e) => {
                      setThankYouStep({ ...thankYouStep, title: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={thankYouStep.description || ""}
                    onChange={(e) => {
                      setThankYouStep({ ...thankYouStep, description: e.target.value });
                      setHasChanges(true);
                    }}
                    rows={2}
                  />
                  <Input
                    placeholder="Button text (default: Done)"
                    value={thankYouStep.buttonText || ""}
                    onChange={(e) => {
                      setThankYouStep({ ...thankYouStep, buttonText: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "targeting" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Audience Rules */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-4">Audience</label>
              <AudienceRuleBuilder
                value={audienceRules}
                onChange={(rules: AudienceRule | null) => {
                  setAudienceRules(toInlineAudienceRuleFromBuilder(rules));
                  setHasChanges(true);
                }}
                workspaceId={activeWorkspace?._id}
                showSegmentSelector={false}
              />
            </div>

            {/* Triggers */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-4">Trigger</label>
              <div className="space-y-4">
                <select
                  value={triggers.type}
                  onChange={(e) => {
                    setTriggers({ ...triggers, type: e.target.value as typeof triggers.type });
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="immediate">Show immediately</option>
                  <option value="page_visit">On page visit</option>
                  <option value="time_on_page">After time on page</option>
                  <option value="event">On event</option>
                </select>

                {triggers.type === "page_visit" && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Page URL"
                      value={triggers.pageUrl || ""}
                      onChange={(e) => {
                        setTriggers({ ...triggers, pageUrl: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                    <select
                      value={triggers.pageUrlMatch || "contains"}
                      onChange={(e) => {
                        setTriggers({
                          ...triggers,
                          pageUrlMatch: e.target.value as typeof triggers.pageUrlMatch,
                        });
                        setHasChanges(true);
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="exact">Exact match</option>
                      <option value="contains">Contains</option>
                      <option value="regex">Regex</option>
                    </select>
                  </div>
                )}

                {triggers.type === "time_on_page" && (
                  <div>
                    <label className="block text-sm mb-1">Delay (seconds)</label>
                    <Input
                      type="number"
                      value={triggers.delaySeconds || 0}
                      onChange={(e) => {
                        setTriggers({ ...triggers, delaySeconds: parseInt(e.target.value) });
                        setHasChanges(true);
                      }}
                      min={0}
                    />
                  </div>
                )}

                {triggers.type === "event" && (
                  <Input
                    placeholder="Event name"
                    value={triggers.eventName || ""}
                    onChange={(e) => {
                      setTriggers({ ...triggers, eventName: e.target.value });
                      setHasChanges(true);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Frequency */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-4">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value as typeof frequency);
                  setHasChanges(true);
                }}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="once">Show once</option>
                <option value="until_completed">Show until completed</option>
              </select>
            </div>

            {/* Scheduling */}
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-4">Scheduling</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Start Date (optional)</label>
                  <Input
                    type="datetime-local"
                    value={
                      scheduling.startDate
                        ? new Date(scheduling.startDate).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      setScheduling({
                        ...scheduling,
                        startDate: e.target.value ? new Date(e.target.value).getTime() : undefined,
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">End Date (optional)</label>
                  <Input
                    type="datetime-local"
                    value={
                      scheduling.endDate
                        ? new Date(scheduling.endDate).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) => {
                      setScheduling({
                        ...scheduling,
                        endDate: e.target.value ? new Date(e.target.value).getTime() : undefined,
                      });
                      setHasChanges(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-4">Display Options</label>
              <div className="space-y-3">
                {format === "large" && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showProgressBar}
                      onChange={(e) => {
                        setShowProgressBar(e.target.checked);
                        setHasChanges(true);
                      }}
                    />
                    <span className="text-sm">Show progress bar</span>
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showDismissButton}
                    onChange={(e) => {
                      setShowDismissButton(e.target.checked);
                      setHasChanges(true);
                    }}
                  />
                  <span className="text-sm">Show dismiss button</span>
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-4">
              <label className="block text-sm font-medium mb-2">Description</label>
              <Textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Internal description for this survey"
                rows={3}
              />
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="max-w-4xl mx-auto space-y-6">
            {analytics ? (
              <>
                <div className="flex items-center justify-between bg-white rounded-lg border p-4">
                  <div>
                    <h3 className="font-medium">Survey Response Export</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Download completed and partial survey responses as CSV.
                    </p>
                  </div>
                  <Button
                    data-testid="survey-export-csv-button"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? "Exporting..." : "Export CSV"}
                  </Button>
                </div>
                {exportError && (
                  <div
                    data-testid="survey-export-error"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {exportError}
                  </div>
                )}

                {/* Overview Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border p-4">
                    <div data-testid="survey-analytics-shown" className="text-2xl font-bold">
                      {analytics.impressions.shown}
                    </div>
                    <div className="text-sm text-gray-500">Shown</div>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <div data-testid="survey-analytics-started" className="text-2xl font-bold">
                      {analytics.impressions.started}
                    </div>
                    <div className="text-sm text-gray-500">Started</div>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <div data-testid="survey-analytics-completed" className="text-2xl font-bold">
                      {analytics.totalResponses}
                    </div>
                    <div className="text-sm text-gray-500">Completed</div>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <div
                      data-testid="survey-analytics-response-rate"
                      className="text-2xl font-bold"
                    >
                      {analytics.responseRate}%
                    </div>
                    <div className="text-sm text-gray-500">Response Rate</div>
                  </div>
                </div>

                {/* Question Analytics */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-medium mb-4">Question Results</h3>
                  <div className="space-y-6">
                    {(Object.values(analytics.questionAnalytics) as QuestionAnalytics[]).map(
                      (qa) => (
                        <div key={qa.questionId} className="border-b pb-4 last:border-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-xs font-medium text-gray-500 uppercase">
                                {qa.questionType}
                              </span>
                              <div className="font-medium">{qa.questionTitle}</div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {qa.totalResponses} responses
                            </div>
                          </div>

                          {qa.npsScore !== undefined && (
                            <div className="mb-2">
                              <span
                                className={`text-2xl font-bold ${
                                  qa.npsScore >= 50
                                    ? "text-green-600"
                                    : qa.npsScore >= 0
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {qa.npsScore}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">NPS Score</span>
                            </div>
                          )}

                          {qa.average !== undefined && qa.npsScore === undefined && (
                            <div className="mb-2">
                              <span className="text-2xl font-bold">{qa.average.toFixed(1)}</span>
                              <span className="text-sm text-gray-500 ml-2">Average</span>
                            </div>
                          )}

                          {Object.keys(qa.distribution).length > 0 && (
                            <div className="space-y-1">
                              {Object.entries(qa.distribution)
                                .sort(([a], [b]) => {
                                  const numA = parseFloat(a);
                                  const numB = parseFloat(b);
                                  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                                  return b.localeCompare(a);
                                })
                                .map(([value, count]) => (
                                  <div key={value} className="flex items-center gap-2">
                                    <div className="w-20 text-sm truncate">{value}</div>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                                      <div
                                        className="bg-primary/50 rounded-full h-4"
                                        style={{ width: `${(count / qa.totalResponses) * 100}%` }}
                                      />
                                    </div>
                                    <div className="w-12 text-sm text-right">{count}</div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Loading analytics...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionOptions({
  question,
  onUpdate,
}: {
  question: Question;
  onUpdate: (options: Question["options"]) => void;
}) {
  const options = question.options || {};

  switch (question.type) {
    case "numeric_scale":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Start</label>
              <Input
                type="number"
                value={options.scaleStart ?? 1}
                onChange={(e) => onUpdate({ ...options, scaleStart: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End</label>
              <Input
                type="number"
                value={options.scaleEnd ?? 5}
                onChange={(e) => onUpdate({ ...options, scaleEnd: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Start Label</label>
              <Input
                value={options.startLabel || ""}
                onChange={(e) => onUpdate({ ...options, startLabel: e.target.value })}
                placeholder="e.g., Low"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End Label</label>
              <Input
                value={options.endLabel || ""}
                onChange={(e) => onUpdate({ ...options, endLabel: e.target.value })}
                placeholder="e.g., High"
              />
            </div>
          </div>
        </div>
      );

    case "star_rating":
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Low Label</label>
            <Input
              value={options.starLabels?.low || ""}
              onChange={(e) =>
                onUpdate({ ...options, starLabels: { ...options.starLabels, low: e.target.value } })
              }
              placeholder="e.g., Poor"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">High Label</label>
            <Input
              value={options.starLabels?.high || ""}
              onChange={(e) =>
                onUpdate({
                  ...options,
                  starLabels: { ...options.starLabels, high: e.target.value },
                })
              }
              placeholder="e.g., Excellent"
            />
          </div>
        </div>
      );

    case "emoji_rating":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Number of Emojis</label>
            <select
              value={options.emojiCount ?? 5}
              onChange={(e) =>
                onUpdate({ ...options, emojiCount: parseInt(e.target.value) as 3 | 5 })
              }
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value={3}>3 emojis</option>
              <option value={5}>5 emojis</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Low Label</label>
              <Input
                value={options.emojiLabels?.low || ""}
                onChange={(e) =>
                  onUpdate({
                    ...options,
                    emojiLabels: { ...options.emojiLabels, low: e.target.value },
                  })
                }
                placeholder="e.g., Very unhappy"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">High Label</label>
              <Input
                value={options.emojiLabels?.high || ""}
                onChange={(e) =>
                  onUpdate({
                    ...options,
                    emojiLabels: { ...options.emojiLabels, high: e.target.value },
                  })
                }
                placeholder="e.g., Very happy"
              />
            </div>
          </div>
        </div>
      );

    case "dropdown":
    case "multiple_choice":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Options</label>
            {(options.choices || []).map((choice, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <Input
                  value={choice}
                  onChange={(e) => {
                    const newChoices = [...(options.choices || [])];
                    newChoices[index] = e.target.value;
                    onUpdate({ ...options, choices: newChoices });
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const newChoices = (options.choices || []).filter((_, i) => i !== index);
                    onUpdate({ ...options, choices: newChoices });
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdate({ ...options, choices: [...(options.choices || []), ""] })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Option
            </Button>
          </div>
          {question.type === "multiple_choice" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.allowMultiple ?? false}
                onChange={(e) => onUpdate({ ...options, allowMultiple: e.target.checked })}
              />
              <span className="text-sm">Allow multiple selections</span>
            </label>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function SurveyBuilderPage() {
  return (
    <AppLayout>
      <SurveyBuilderContent />
    </AppLayout>
  );
}
