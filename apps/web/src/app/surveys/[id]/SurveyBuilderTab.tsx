"use client";

import { Button, Input, Textarea } from "@opencom/ui";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { QUESTION_TYPES, type Question } from "./surveyEditorTypes";
import type { SurveyQuestionEditorController } from "./useSurveyQuestionEditor";

interface SurveyBuilderTabProps {
  format: "small" | "large";
  setFormat: (format: "small" | "large") => void;
  introStep: {
    title: string;
    description?: string;
    buttonText?: string;
  } | null;
  setIntroStep: (
    introStep: {
      title: string;
      description?: string;
      buttonText?: string;
    } | null
  ) => void;
  thankYouStep: {
    title: string;
    description?: string;
    buttonText?: string;
  } | null;
  setThankYouStep: (
    thankYouStep: {
      title: string;
      description?: string;
      buttonText?: string;
    } | null
  ) => void;
  questionEditor: SurveyQuestionEditorController;
  onDirty: () => void;
}

export function SurveyBuilderTab({
  format,
  setFormat,
  introStep,
  setIntroStep,
  thankYouStep,
  setThankYouStep,
  questionEditor,
  onDirty,
}: SurveyBuilderTabProps): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
                onDirty();
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
                onDirty();
              }}
              className="sr-only"
            />
            <div className="font-medium">Large Format</div>
            <div className="text-sm text-gray-500">Centered modal, up to 3 questions per step</div>
          </label>
        </div>
      </div>

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
                  onDirty();
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
                  onDirty();
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
                onChange={(event) => {
                  setIntroStep({ ...introStep, title: event.target.value });
                  onDirty();
                }}
              />
              <Textarea
                placeholder="Description (optional)"
                value={introStep.description || ""}
                onChange={(event) => {
                  setIntroStep({ ...introStep, description: event.target.value });
                  onDirty();
                }}
                rows={2}
              />
              <Input
                placeholder="Button text (default: Start)"
                value={introStep.buttonText || ""}
                onChange={(event) => {
                  setIntroStep({ ...introStep, buttonText: event.target.value });
                  onDirty();
                }}
              />
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium">
            Questions ({questionEditor.questions.length}/12)
          </label>
        </div>

        {questionEditor.questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No questions yet. Add your first question below.
          </div>
        ) : (
          <div className="space-y-3">
            {questionEditor.questions.map((question, index) => (
              <div key={question.id} className="border rounded-lg">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() =>
                    questionEditor.setExpandedQuestion(
                      questionEditor.expandedQuestion === question.id ? null : question.id
                    )
                  }
                >
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {QUESTION_TYPES.find((type) => type.value === question.type)?.label}
                      </span>
                      {question.required && <span className="text-xs text-red-500">Required</span>}
                    </div>
                    <div className="font-medium">{question.title || "(No title)"}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        questionEditor.moveQuestion(index, "up");
                      }}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        questionEditor.moveQuestion(index, "down");
                      }}
                      disabled={index === questionEditor.questions.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        questionEditor.removeQuestion(question.id);
                      }}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {questionEditor.expandedQuestion === question.id && (
                  <div className="border-t p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Question Title</label>
                      <Input
                        value={question.title}
                        onChange={(event) =>
                          questionEditor.updateQuestion(question.id, { title: event.target.value })
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
                        onChange={(event) =>
                          questionEditor.updateQuestion(question.id, { description: event.target.value })
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
                          onChange={(event) =>
                            questionEditor.updateQuestion(question.id, {
                              required: event.target.checked,
                            })
                          }
                        />
                        <span className="text-sm">Required</span>
                      </label>
                    </div>

                    <QuestionOptions
                      question={question}
                      onUpdate={(options) => questionEditor.updateQuestion(question.id, { options })}
                    />

                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Store as user attribute (optional)
                      </label>
                      <Input
                        value={question.storeAsAttribute || ""}
                        onChange={(event) =>
                          questionEditor.updateQuestion(question.id, {
                            storeAsAttribute: event.target.value,
                          })
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

        {questionEditor.questions.length < 12 && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Add Question</label>
            <div className="grid grid-cols-4 gap-2">
              {QUESTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => questionEditor.addQuestion(type.value)}
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

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium">Thank You Step</label>
          {!thankYouStep ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setThankYouStep({ title: "Thank you!" });
                onDirty();
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
                onDirty();
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
              onChange={(event) => {
                setThankYouStep({ ...thankYouStep, title: event.target.value });
                onDirty();
              }}
            />
            <Textarea
              placeholder="Description (optional)"
              value={thankYouStep.description || ""}
              onChange={(event) => {
                setThankYouStep({ ...thankYouStep, description: event.target.value });
                onDirty();
              }}
              rows={2}
            />
            <Input
              placeholder="Button text (default: Done)"
              value={thankYouStep.buttonText || ""}
              onChange={(event) => {
                setThankYouStep({ ...thankYouStep, buttonText: event.target.value });
                onDirty();
              }}
            />
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
}): React.JSX.Element | null {
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
                onChange={(event) => onUpdate({ ...options, scaleStart: parseInt(event.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End</label>
              <Input
                type="number"
                value={options.scaleEnd ?? 5}
                onChange={(event) => onUpdate({ ...options, scaleEnd: parseInt(event.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Start Label</label>
              <Input
                value={options.startLabel || ""}
                onChange={(event) => onUpdate({ ...options, startLabel: event.target.value })}
                placeholder="e.g., Low"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">End Label</label>
              <Input
                value={options.endLabel || ""}
                onChange={(event) => onUpdate({ ...options, endLabel: event.target.value })}
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
              onChange={(event) =>
                onUpdate({ ...options, starLabels: { ...options.starLabels, low: event.target.value } })
              }
              placeholder="e.g., Poor"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">High Label</label>
            <Input
              value={options.starLabels?.high || ""}
              onChange={(event) =>
                onUpdate({ ...options, starLabels: { ...options.starLabels, high: event.target.value } })
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
              onChange={(event) =>
                onUpdate({ ...options, emojiCount: parseInt(event.target.value) as 3 | 5 })
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
                onChange={(event) =>
                  onUpdate({
                    ...options,
                    emojiLabels: { ...options.emojiLabels, low: event.target.value },
                  })
                }
                placeholder="e.g., Very unhappy"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">High Label</label>
              <Input
                value={options.emojiLabels?.high || ""}
                onChange={(event) =>
                  onUpdate({
                    ...options,
                    emojiLabels: { ...options.emojiLabels, high: event.target.value },
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
                  onChange={(event) => {
                    const nextChoices = [...(options.choices || [])];
                    nextChoices[index] = event.target.value;
                    onUpdate({ ...options, choices: nextChoices });
                  }}
                  placeholder={`Option ${index + 1}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextChoices = (options.choices || []).filter((_, position) => position !== index);
                    onUpdate({ ...options, choices: nextChoices });
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
                onChange={(event) => onUpdate({ ...options, allowMultiple: event.target.checked })}
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
