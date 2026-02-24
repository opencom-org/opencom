import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

interface SurveyQuestion {
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

interface Survey {
  _id: Id<"surveys">;
  name: string;
  format: "small" | "large";
  questions: SurveyQuestion[];
  introStep?: { title: string; description?: string; buttonText?: string };
  thankYouStep?: { title: string; description?: string; buttonText?: string };
  showProgressBar?: boolean;
  showDismissButton?: boolean;
}

interface SurveyOverlayProps {
  survey: Survey;
  visitorId: Id<"visitors">;
  sessionId?: string;
  sessionToken?: string;
  onComplete: () => void;
  onDismiss: () => void;
  primaryColor?: string;
}

type SurveyAnswerPrimitive = string | number | boolean | null;
type SurveyAnswerPrimitiveArray = string[] | number[];
type SurveyAnswerValue = SurveyAnswerPrimitive | SurveyAnswerPrimitiveArray;

function isSurveyAnswerPrimitive(value: unknown): value is SurveyAnswerPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isStringOrNumberArray(value: unknown): value is SurveyAnswerPrimitiveArray {
  if (!Array.isArray(value)) {
    return false;
  }
  return (
    value.every((entry) => typeof entry === "string") ||
    value.every((entry) => typeof entry === "number")
  );
}

function normalizeSurveyAnswerValue(value: unknown): SurveyAnswerValue {
  if (isSurveyAnswerPrimitive(value)) {
    return value;
  }

  if (isStringOrNumberArray(value)) {
    return value;
  }

  return null;
}

export function SurveyOverlay({
  survey,
  visitorId,
  sessionId,
  sessionToken,
  onComplete,
  onDismiss,
  primaryColor = "#792cd4",
}: SurveyOverlayProps) {
  const [currentStep, setCurrentStep] = useState(survey.introStep ? -1 : 0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const submitResponse = useMutation(api.surveys.submitResponse);
  const recordImpression = useMutation(api.surveys.recordImpression);

  const totalSteps = survey.questions.length;
  const isIntroStep = currentStep === -1;
  const isQuestionStep = currentStep >= 0 && currentStep < totalSteps;
  const currentQuestion = isQuestionStep ? survey.questions[currentStep] : null;

  useEffect(() => {
    void recordImpression({
      surveyId: survey._id,
      visitorId,
      sessionId,
      sessionToken,
      action: "shown",
    });
  }, [recordImpression, survey._id, visitorId, sessionId, sessionToken]);

  const handleAnswer = (value: unknown) => {
    if (!currentQuestion) return;
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = async () => {
    if (isIntroStep) {
      recordImpression({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        action: "started",
      });
      setCurrentStep(0);
      return;
    }

    if (currentQuestion?.required && answers[currentQuestion.id] === undefined) {
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > (survey.introStep ? -1 : 0)) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value: normalizeSurveyAnswerValue(value),
      }));

      await submitResponse({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        answers: answerArray,
        isComplete: true,
      });

      await recordImpression({
        surveyId: survey._id,
        visitorId,
        sessionId,
        sessionToken,
        action: "completed",
      });

      if (survey.thankYouStep) {
        setShowThankYou(true);
      } else {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to submit survey:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    await recordImpression({
      surveyId: survey._id,
      visitorId,
      sessionId,
      sessionToken,
      action: "dismissed",
    });
    onDismiss();
  };

  const canProceed = !currentQuestion?.required || answers[currentQuestion.id] !== undefined;

  if (showThankYou && survey.thankYouStep) {
    return survey.format === "small" ? (
      <SmallFormatContainer onDismiss={onComplete} showDismiss={false}>
        <div className="oc-survey-thank-you">
          <h3 className="oc-survey-title">{survey.thankYouStep.title}</h3>
          {survey.thankYouStep.description && (
            <p className="oc-survey-description">{survey.thankYouStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={onComplete}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.thankYouStep.buttonText || "Done"}
          </button>
        </div>
      </SmallFormatContainer>
    ) : (
      <LargeFormatContainer onDismiss={onComplete} showDismiss={false}>
        <div className="oc-survey-thank-you">
          <h3 className="oc-survey-title">{survey.thankYouStep.title}</h3>
          {survey.thankYouStep.description && (
            <p className="oc-survey-description">{survey.thankYouStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={onComplete}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.thankYouStep.buttonText || "Done"}
          </button>
        </div>
      </LargeFormatContainer>
    );
  }

  const content = (
    <>
      {survey.showProgressBar && survey.format === "large" && isQuestionStep && (
        <div className="oc-survey-progress">
          <div
            className="oc-survey-progress-bar"
            style={{
              width: `${((currentStep + 1) / totalSteps) * 100}%`,
              backgroundColor: primaryColor,
            }}
          />
        </div>
      )}

      {isIntroStep && survey.introStep && (
        <div className="oc-survey-intro">
          <h3 className="oc-survey-title">{survey.introStep.title}</h3>
          {survey.introStep.description && (
            <p className="oc-survey-description">{survey.introStep.description}</p>
          )}
          <button
            className="oc-survey-button oc-survey-button-primary"
            onClick={handleNext}
            style={{ backgroundColor: primaryColor }}
          >
            {survey.introStep.buttonText || "Start"}
          </button>
        </div>
      )}

      {isQuestionStep && currentQuestion && (
        <div className="oc-survey-question">
          <div className="oc-survey-question-header">
            <h3 className="oc-survey-question-title">
              {currentQuestion.title}
              {currentQuestion.required && <span className="oc-survey-required">*</span>}
            </h3>
            {currentQuestion.description && (
              <p className="oc-survey-question-description">{currentQuestion.description}</p>
            )}
          </div>

          <div className="oc-survey-question-content">
            <QuestionRenderer
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={handleAnswer}
              primaryColor={primaryColor}
            />
          </div>

          <div className="oc-survey-actions">
            {currentStep > 0 && (
              <button className="oc-survey-button oc-survey-button-secondary" onClick={handleBack}>
                Back
              </button>
            )}
            <button
              className="oc-survey-button oc-survey-button-primary"
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              style={{ backgroundColor: canProceed ? primaryColor : "#9ca3af" }}
            >
              {isSubmitting ? "..." : currentStep === totalSteps - 1 ? "Submit" : "Next"}
            </button>
          </div>
        </div>
      )}
    </>
  );

  return survey.format === "small" ? (
    <SmallFormatContainer onDismiss={handleDismiss} showDismiss={survey.showDismissButton}>
      {content}
    </SmallFormatContainer>
  ) : (
    <LargeFormatContainer onDismiss={handleDismiss} showDismiss={survey.showDismissButton}>
      {content}
    </LargeFormatContainer>
  );
}

function SmallFormatContainer({
  children,
  onDismiss,
  showDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  showDismiss?: boolean;
}) {
  return (
    <div className="oc-survey-small">
      {showDismiss && (
        <button className="oc-survey-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
      {children}
    </div>
  );
}

function LargeFormatContainer({
  children,
  onDismiss,
  showDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  showDismiss?: boolean;
}) {
  return (
    <div className="oc-survey-overlay">
      <div className="oc-survey-backdrop" onClick={showDismiss ? onDismiss : undefined} />
      <div className="oc-survey-large">
        {showDismiss && (
          <button className="oc-survey-dismiss" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function QuestionRenderer({
  question,
  value,
  onChange,
  primaryColor,
}: {
  question: SurveyQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  primaryColor: string;
}) {
  switch (question.type) {
    case "nps":
      return (
        <NPSQuestion
          value={value as number | undefined}
          onChange={onChange}
          primaryColor={primaryColor}
        />
      );
    case "numeric_scale":
      return (
        <NumericScaleQuestion
          value={value as number | undefined}
          onChange={onChange}
          options={question.options}
          primaryColor={primaryColor}
        />
      );
    case "star_rating":
      return (
        <StarRatingQuestion
          value={value as number | undefined}
          onChange={onChange}
          options={question.options}
          primaryColor={primaryColor}
        />
      );
    case "emoji_rating":
      return (
        <EmojiRatingQuestion
          value={value as number | undefined}
          onChange={onChange}
          options={question.options}
          primaryColor={primaryColor}
        />
      );
    case "dropdown":
      return (
        <DropdownQuestion
          value={value as string | undefined}
          onChange={onChange}
          options={question.options}
        />
      );
    case "short_text":
      return (
        <TextQuestion value={value as string | undefined} onChange={onChange} maxLength={255} />
      );
    case "long_text":
      return (
        <TextQuestion
          value={value as string | undefined}
          onChange={onChange}
          maxLength={2000}
          multiline
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceQuestion
          value={value as string | string[] | undefined}
          onChange={onChange}
          options={question.options}
          primaryColor={primaryColor}
        />
      );
    default:
      return null;
  }
}

function NPSQuestion({
  value,
  onChange,
  primaryColor,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  primaryColor: string;
}) {
  return (
    <div className="oc-survey-nps">
      <div className="oc-survey-nps-labels">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      <div className="oc-survey-nps-scale">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            className={`oc-survey-nps-button ${value === i ? "oc-survey-nps-button-selected" : ""}`}
            onClick={() => onChange(i)}
            style={value === i ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumericScaleQuestion({
  value,
  onChange,
  options,
  primaryColor,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  options?: SurveyQuestion["options"];
  primaryColor: string;
}) {
  const start = options?.scaleStart ?? 1;
  const end = options?.scaleEnd ?? 5;
  const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="oc-survey-numeric">
      <div className="oc-survey-numeric-labels">
        <span>{options?.startLabel || start}</span>
        <span>{options?.endLabel || end}</span>
      </div>
      <div className="oc-survey-numeric-scale">
        {range.map((n) => (
          <button
            key={n}
            className={`oc-survey-numeric-button ${value === n ? "oc-survey-numeric-button-selected" : ""}`}
            onClick={() => onChange(n)}
            style={value === n ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRatingQuestion({
  value,
  onChange,
  options,
  primaryColor,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  options?: SurveyQuestion["options"];
  primaryColor: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="oc-survey-stars">
      <div className="oc-survey-stars-labels">
        <span>{options?.starLabels?.low || ""}</span>
        <span>{options?.starLabels?.high || ""}</span>
      </div>
      <div className="oc-survey-stars-container">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className="oc-survey-star"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
          >
            <svg
              viewBox="0 0 24 24"
              fill={
                (hovered !== null ? star <= hovered : star <= (value || 0)) ? primaryColor : "none"
              }
              stroke={primaryColor}
              strokeWidth="2"
              className="oc-survey-star-icon"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmojiRatingQuestion({
  value,
  onChange,
  options,
  primaryColor,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
  options?: SurveyQuestion["options"];
  primaryColor: string;
}) {
  const count = options?.emojiCount ?? 5;
  const emojis5 = ["😠", "😕", "😐", "🙂", "😄"];
  const emojis3 = ["😕", "😐", "🙂"];
  const emojis = count === 3 ? emojis3 : emojis5;

  return (
    <div className="oc-survey-emoji">
      <div className="oc-survey-emoji-labels">
        <span>{options?.emojiLabels?.low || ""}</span>
        <span>{options?.emojiLabels?.high || ""}</span>
      </div>
      <div className="oc-survey-emoji-container">
        {emojis.map((emoji, index) => (
          <button
            key={index}
            className={`oc-survey-emoji-button ${value === index + 1 ? "oc-survey-emoji-button-selected" : ""}`}
            onClick={() => onChange(index + 1)}
            style={value === index + 1 ? { borderColor: primaryColor } : {}}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function DropdownQuestion({
  value,
  onChange,
  options,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  options?: SurveyQuestion["options"];
}) {
  return (
    <div className="oc-survey-dropdown">
      <select
        className="oc-survey-select"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select an option
        </option>
        {options?.choices?.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextQuestion({
  value,
  onChange,
  maxLength,
  multiline,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  maxLength: number;
  multiline?: boolean;
}) {
  return (
    <div className="oc-survey-text">
      {multiline ? (
        <textarea
          className="oc-survey-textarea"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={4}
          placeholder="Type your answer..."
        />
      ) : (
        <input
          type="text"
          className="oc-survey-input"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          placeholder="Type your answer..."
        />
      )}
      <div className="oc-survey-text-count">
        {(value || "").length}/{maxLength}
      </div>
    </div>
  );
}

function MultipleChoiceQuestion({
  value,
  onChange,
  options,
  primaryColor,
}: {
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  options?: SurveyQuestion["options"];
  primaryColor: string;
}) {
  const allowMultiple = options?.allowMultiple ?? false;
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const handleSelect = (choice: string) => {
    if (allowMultiple) {
      if (selectedValues.includes(choice)) {
        onChange(selectedValues.filter((v) => v !== choice));
      } else {
        onChange([...selectedValues, choice]);
      }
    } else {
      onChange(choice);
    }
  };

  return (
    <div className="oc-survey-multiple-choice">
      {options?.choices?.map((choice) => {
        const isSelected = selectedValues.includes(choice);
        return (
          <button
            key={choice}
            className={`oc-survey-choice ${isSelected ? "oc-survey-choice-selected" : ""}`}
            onClick={() => handleSelect(choice)}
            style={
              isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}
            }
          >
            <span
              className={`oc-survey-choice-indicator ${allowMultiple ? "oc-survey-choice-checkbox" : "oc-survey-choice-radio"}`}
              style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
            >
              {isSelected && (allowMultiple ? "✓" : "●")}
            </span>
            {choice}
          </button>
        );
      })}
    </div>
  );
}
