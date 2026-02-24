import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  type ViewStyle,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { OpencomSDK } from "../OpencomSDK";
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

interface OpencomSurveyProps {
  survey: Survey;
  onDismiss?: () => void;
  onComplete?: () => void;
  style?: ViewStyle;
  primaryColor?: string;
}

type SurveySubmissionValue = string | number | boolean | string[] | number[] | null;

function isSurveyAnswerPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeSurveyAnswerValue(value: unknown): SurveySubmissionValue {
  if (isSurveyAnswerPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string")) {
      return value;
    }
    if (value.every((entry) => typeof entry === "number")) {
      return value;
    }
  }

  return null;
}

export function OpencomSurvey({
  survey,
  onDismiss,
  onComplete,
  style,
  primaryColor = "#792cd4",
}: OpencomSurveyProps) {
  const [currentIndex, setCurrentIndex] = useState(survey.introStep ? -1 : 0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const submitResponse = useMutation(api.surveys.submitResponse);
  const recordImpression = useMutation(api.surveys.recordImpression);

  const totalSteps = survey.questions.length;
  const isIntroStep = currentIndex === -1;
  const isQuestionStep = currentIndex >= 0 && currentIndex < totalSteps;
  const currentQuestion = isQuestionStep ? survey.questions[currentIndex] : null;

  useEffect(() => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "shown",
      });
    }
  }, []);

  const handleAnswer = (value: unknown) => {
    if (!currentQuestion) return;
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = async () => {
    const state = OpencomSDK.getVisitorState();

    if (isIntroStep) {
      if (state.visitorId && state.sessionToken) {
        recordImpression({
          surveyId: survey._id,
          visitorId: state.visitorId,
          sessionId: state.sessionId,
          sessionToken: state.sessionToken,
          action: "started",
        });
      }
      setCurrentIndex(0);
      return;
    }

    if (currentQuestion?.required && answers[currentQuestion.id] === undefined) {
      return;
    }

    if (currentIndex < totalSteps - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentIndex > (survey.introStep ? -1 : 0)) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const state = OpencomSDK.getVisitorState();
    if (!state.visitorId || !state.sessionToken) {
      setIsSubmitting(false);
      return;
    }

    try {
      const answerArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value: normalizeSurveyAnswerValue(value),
      }));

      await submitResponse({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        answers: answerArray,
        isComplete: true,
      });

      await recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "completed",
      });

      if (survey.thankYouStep) {
        setShowThankYou(true);
      } else {
        onComplete?.();
      }
    } catch (error) {
      console.error("Failed to submit survey:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      await recordImpression({
        surveyId: survey._id,
        visitorId: state.visitorId,
        sessionId: state.sessionId,
        sessionToken: state.sessionToken,
        action: "dismissed",
      });
    }
    onDismiss?.();
  };

  const canProceed = !currentQuestion?.required || answers[currentQuestion.id] !== undefined;

  if (showThankYou && survey.thankYouStep) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.thankYouContainer}>
          <Text style={styles.title}>{survey.thankYouStep.title}</Text>
          {survey.thankYouStep.description && (
            <Text style={styles.description}>{survey.thankYouStep.description}</Text>
          )}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: primaryColor }]}
            onPress={onComplete}
          >
            <Text style={styles.primaryButtonText}>{survey.thankYouStep.buttonText || "Done"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {survey.showDismissButton !== false && (
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}

      {survey.showProgressBar && isQuestionStep && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${((currentIndex + 1) / totalSteps) * 100}%`,
                backgroundColor: primaryColor,
              },
            ]}
          />
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {isIntroStep && survey.introStep && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{survey.introStep.title}</Text>
            {survey.introStep.description && (
              <Text style={styles.description}>{survey.introStep.description}</Text>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryColor }]}
              onPress={handleNext}
            >
              <Text style={styles.primaryButtonText}>{survey.introStep.buttonText || "Start"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isQuestionStep && currentQuestion && (
          <View style={styles.stepContainer}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionTitle}>
                {currentQuestion.title}
                {currentQuestion.required && <Text style={styles.required}> *</Text>}
              </Text>
              {currentQuestion.description && (
                <Text style={styles.questionDescription}>{currentQuestion.description}</Text>
              )}
            </View>

            <View style={styles.questionContent}>
              <QuestionRenderer
                question={currentQuestion}
                value={answers[currentQuestion.id]}
                onChange={handleAnswer}
                primaryColor={primaryColor}
              />
            </View>

            <View style={styles.actions}>
              {currentIndex > 0 && (
                <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
                  <Text style={[styles.secondaryButtonText, { color: primaryColor }]}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: canProceed ? primaryColor : "#9CA3AF" },
                  currentIndex === 0 && styles.fullWidthButton,
                ]}
                onPress={handleNext}
                disabled={!canProceed || isSubmitting}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? "..." : currentIndex === totalSteps - 1 ? "Submit" : "Next"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
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
    case "multiple_choice":
      return (
        <MultipleChoiceQuestion
          value={value as string | string[] | undefined}
          onChange={onChange}
          options={question.options}
          primaryColor={primaryColor}
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
    <View style={styles.scaleContainer}>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>Not likely</Text>
        <Text style={styles.scaleLabel}>Very likely</Text>
      </View>
      <View style={styles.scaleButtons}>
        {Array.from({ length: 11 }, (_, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.scaleButton,
              value === i && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => onChange(i)}
          >
            <Text style={[styles.scaleButtonText, value === i && styles.scaleButtonTextSelected]}>
              {i}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
    <View style={styles.scaleContainer}>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>{options?.startLabel || String(start)}</Text>
        <Text style={styles.scaleLabel}>{options?.endLabel || String(end)}</Text>
      </View>
      <View style={styles.scaleButtons}>
        {range.map((n) => (
          <TouchableOpacity
            key={n}
            style={[
              styles.scaleButton,
              value === n && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.scaleButtonText, value === n && styles.scaleButtonTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  return (
    <View style={styles.starsContainer}>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>{options?.starLabels?.low || ""}</Text>
        <Text style={styles.scaleLabel}>{options?.starLabels?.high || ""}</Text>
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} style={styles.starButton} onPress={() => onChange(star)}>
            <Text
              style={[styles.starIcon, { color: star <= (value || 0) ? primaryColor : "#D1D5DB" }]}
            >
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
    <View style={styles.emojiContainer}>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>{options?.emojiLabels?.low || ""}</Text>
        <Text style={styles.scaleLabel}>{options?.emojiLabels?.high || ""}</Text>
      </View>
      <View style={styles.emojiRow}>
        {emojis.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.emojiButton,
              value === index + 1 && {
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}10`,
              },
            ]}
            onPress={() => onChange(index + 1)}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
    <View style={styles.choicesContainer}>
      {options?.choices?.map((choice) => {
        const isSelected = selectedValues.includes(choice);
        return (
          <TouchableOpacity
            key={choice}
            style={[
              styles.choiceButton,
              isSelected && { borderColor: primaryColor, backgroundColor: `${primaryColor}10` },
            ]}
            onPress={() => handleSelect(choice)}
          >
            <View
              style={[
                styles.choiceIndicator,
                allowMultiple ? styles.checkbox : styles.radio,
                isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
            >
              {isSelected && <Text style={styles.checkmark}>{allowMultiple ? "✓" : "●"}</Text>}
            </View>
            <Text style={styles.choiceText}>{choice}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
    <View style={styles.textContainer}>
      <TextInput
        style={[styles.textInput, multiline && styles.textInputMultiline]}
        value={value || ""}
        onChangeText={onChange}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        placeholder="Type your answer..."
        placeholderTextColor="#9CA3AF"
      />
      <Text style={styles.charCount}>
        {(value || "").length}/{maxLength}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  dismissButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  dismissText: {
    color: "#374151",
    fontSize: 18,
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 24,
    marginTop: 60,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  stepContainer: {
    alignItems: "center",
  },
  thankYouContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  questionHeader: {
    width: "100%",
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  questionDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  required: {
    color: "#EF4444",
  },
  questionContent: {
    width: "100%",
    marginBottom: 32,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scaleContainer: {
    width: "100%",
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scaleLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  scaleButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  scaleButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  scaleButtonText: {
    fontSize: 14,
    color: "#374151",
  },
  scaleButtonTextSelected: {
    color: "#FFFFFF",
  },
  starsContainer: {
    width: "100%",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 36,
  },
  emojiContainer: {
    width: "100%",
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  emojiButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  emoji: {
    fontSize: 32,
  },
  choicesContainer: {
    width: "100%",
    gap: 8,
  },
  choiceButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  choiceIndicator: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radio: {
    borderRadius: 10,
  },
  checkbox: {
    borderRadius: 4,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  choiceText: {
    fontSize: 14,
    color: "#374151",
  },
  textContainer: {
    width: "100%",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
});
