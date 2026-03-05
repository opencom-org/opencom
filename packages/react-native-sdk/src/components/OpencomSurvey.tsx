import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SurveyIntroStepView, SurveyQuestionStepView, SurveyThankYouStepView } from "./survey/SurveyStepViews";
import { surveyStyles } from "./survey/styles";
import type { OpencomSurveyProps, Survey, SurveyQuestion } from "./survey/types";
import { useSurveyController } from "./survey/useSurveyController";

export type { Survey, SurveyQuestion };

export function OpencomSurvey({
  survey,
  onDismiss,
  onComplete,
  style,
  primaryColor = "#792cd4",
}: OpencomSurveyProps) {
  const controller = useSurveyController({
    survey,
    onDismiss,
    onComplete,
    style,
    primaryColor,
  });

  if (controller.showThankYou && survey.thankYouStep) {
    return (
      <View style={[surveyStyles.container, style]}>
        <SurveyThankYouStepView
          title={survey.thankYouStep.title}
          description={survey.thankYouStep.description}
          buttonText={survey.thankYouStep.buttonText}
          primaryColor={primaryColor}
          onComplete={onComplete}
        />
      </View>
    );
  }

  return (
    <View style={[surveyStyles.container, style]}>
      {survey.showDismissButton !== false && (
        <TouchableOpacity style={surveyStyles.dismissButton} onPress={controller.handleDismiss}>
          <Text style={surveyStyles.dismissText}>✕</Text>
        </TouchableOpacity>
      )}

      {survey.showProgressBar && controller.isQuestionStep && (
        <View style={surveyStyles.progressContainer}>
          <View
            style={[
              surveyStyles.progressBar,
              {
                width: `${((controller.currentIndex + 1) / controller.totalSteps) * 100}%`,
                backgroundColor: primaryColor,
              },
            ]}
          />
        </View>
      )}

      <ScrollView
        style={surveyStyles.content}
        contentContainerStyle={surveyStyles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {controller.isIntroStep && survey.introStep && (
          <SurveyIntroStepView
            title={survey.introStep.title}
            description={survey.introStep.description}
            buttonText={survey.introStep.buttonText}
            primaryColor={primaryColor}
            onStart={controller.handleNext}
          />
        )}

        {controller.isQuestionStep && controller.currentQuestion && (
          <SurveyQuestionStepView
            question={controller.currentQuestion}
            value={controller.answers[controller.currentQuestion.id]}
            currentIndex={controller.currentIndex}
            totalSteps={controller.totalSteps}
            canProceed={controller.canProceed}
            isSubmitting={controller.isSubmitting}
            primaryColor={primaryColor}
            onAnswer={controller.answerQuestion}
            onBack={controller.handleBack}
            onNext={controller.handleNext}
          />
        )}
      </ScrollView>
    </View>
  );
}
