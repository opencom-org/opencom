import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SurveyQuestionRenderer } from "./SurveyQuestionRenderer";
import type { SurveyQuestion } from "./types";
import { surveyStyles } from "./styles";

interface SurveyIntroStepViewProps {
  title: string;
  description?: string;
  buttonText?: string;
  primaryColor: string;
  onStart: () => Promise<void>;
}

export function SurveyIntroStepView({
  title,
  description,
  buttonText,
  primaryColor,
  onStart,
}: SurveyIntroStepViewProps) {
  return (
    <View style={surveyStyles.stepContainer}>
      <Text style={surveyStyles.title}>{title}</Text>
      {description && <Text style={surveyStyles.description}>{description}</Text>}
      <TouchableOpacity
        style={[surveyStyles.primaryButton, { backgroundColor: primaryColor }]}
        onPress={onStart}
      >
        <Text style={surveyStyles.primaryButtonText}>{buttonText || "Start"}</Text>
      </TouchableOpacity>
    </View>
  );
}

interface SurveyQuestionStepViewProps {
  question: SurveyQuestion;
  value: unknown;
  currentIndex: number;
  totalSteps: number;
  canProceed: boolean;
  isSubmitting: boolean;
  primaryColor: string;
  onAnswer: (value: unknown) => void;
  onBack: () => void;
  onNext: () => Promise<void>;
}

export function SurveyQuestionStepView({
  question,
  value,
  currentIndex,
  totalSteps,
  canProceed,
  isSubmitting,
  primaryColor,
  onAnswer,
  onBack,
  onNext,
}: SurveyQuestionStepViewProps) {
  return (
    <View style={surveyStyles.stepContainer}>
      <View style={surveyStyles.questionHeader}>
        <Text style={surveyStyles.questionTitle}>
          {question.title}
          {question.required && <Text style={surveyStyles.required}> *</Text>}
        </Text>
        {question.description && <Text style={surveyStyles.questionDescription}>{question.description}</Text>}
      </View>

      <View style={surveyStyles.questionContent}>
        <SurveyQuestionRenderer
          question={question}
          value={value}
          onChange={onAnswer}
          primaryColor={primaryColor}
        />
      </View>

      <View style={surveyStyles.actions}>
        {currentIndex > 0 && (
          <TouchableOpacity style={surveyStyles.secondaryButton} onPress={onBack}>
            <Text style={[surveyStyles.secondaryButtonText, { color: primaryColor }]}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            surveyStyles.primaryButton,
            { backgroundColor: canProceed ? primaryColor : "#9CA3AF" },
            currentIndex === 0 && surveyStyles.fullWidthButton,
          ]}
          onPress={onNext}
          disabled={!canProceed || isSubmitting}
        >
          <Text style={surveyStyles.primaryButtonText}>
            {isSubmitting ? "..." : currentIndex === totalSteps - 1 ? "Submit" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface SurveyThankYouStepViewProps {
  title: string;
  description?: string;
  buttonText?: string;
  primaryColor: string;
  onComplete?: () => void;
}

export function SurveyThankYouStepView({
  title,
  description,
  buttonText,
  primaryColor,
  onComplete,
}: SurveyThankYouStepViewProps) {
  return (
    <View style={surveyStyles.thankYouContainer}>
      <Text style={surveyStyles.title}>{title}</Text>
      {description && <Text style={surveyStyles.description}>{description}</Text>}
      <TouchableOpacity
        style={[surveyStyles.primaryButton, { backgroundColor: primaryColor }]}
        onPress={onComplete}
      >
        <Text style={surveyStyles.primaryButtonText}>{buttonText || "Done"}</Text>
      </TouchableOpacity>
    </View>
  );
}
