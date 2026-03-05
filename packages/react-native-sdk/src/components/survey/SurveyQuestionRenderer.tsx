import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import type { SurveyQuestion } from "./types";
import { surveyStyles } from "./styles";

interface SurveyQuestionRendererProps {
  question: SurveyQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  primaryColor: string;
}

export function SurveyQuestionRenderer({
  question,
  value,
  onChange,
  primaryColor,
}: SurveyQuestionRendererProps) {
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
    <View style={surveyStyles.scaleContainer}>
      <View style={surveyStyles.scaleLabels}>
        <Text style={surveyStyles.scaleLabel}>Not likely</Text>
        <Text style={surveyStyles.scaleLabel}>Very likely</Text>
      </View>
      <View style={surveyStyles.scaleButtons}>
        {Array.from({ length: 11 }, (_, i) => (
          <TouchableOpacity
            key={i}
            style={[
              surveyStyles.scaleButton,
              value === i && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => onChange(i)}
          >
            <Text
              style={[
                surveyStyles.scaleButtonText,
                value === i && surveyStyles.scaleButtonTextSelected,
              ]}
            >
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
    <View style={surveyStyles.scaleContainer}>
      <View style={surveyStyles.scaleLabels}>
        <Text style={surveyStyles.scaleLabel}>{options?.startLabel || String(start)}</Text>
        <Text style={surveyStyles.scaleLabel}>{options?.endLabel || String(end)}</Text>
      </View>
      <View style={surveyStyles.scaleButtons}>
        {range.map((valueInRange) => (
          <TouchableOpacity
            key={valueInRange}
            style={[
              surveyStyles.scaleButton,
              value === valueInRange && {
                backgroundColor: primaryColor,
                borderColor: primaryColor,
              },
            ]}
            onPress={() => onChange(valueInRange)}
          >
            <Text
              style={[
                surveyStyles.scaleButtonText,
                value === valueInRange && surveyStyles.scaleButtonTextSelected,
              ]}
            >
              {valueInRange}
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
    <View style={surveyStyles.starsContainer}>
      <View style={surveyStyles.scaleLabels}>
        <Text style={surveyStyles.scaleLabel}>{options?.starLabels?.low || ""}</Text>
        <Text style={surveyStyles.scaleLabel}>{options?.starLabels?.high || ""}</Text>
      </View>
      <View style={surveyStyles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} style={surveyStyles.starButton} onPress={() => onChange(star)}>
            <Text style={[surveyStyles.starIcon, { color: star <= (value || 0) ? primaryColor : "#D1D5DB" }]}>
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
    <View style={surveyStyles.emojiContainer}>
      <View style={surveyStyles.scaleLabels}>
        <Text style={surveyStyles.scaleLabel}>{options?.emojiLabels?.low || ""}</Text>
        <Text style={surveyStyles.scaleLabel}>{options?.emojiLabels?.high || ""}</Text>
      </View>
      <View style={surveyStyles.emojiRow}>
        {emojis.map((emoji, index) => (
          <TouchableOpacity
            key={index}
            style={[
              surveyStyles.emojiButton,
              value === index + 1 && {
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}10`,
              },
            ]}
            onPress={() => onChange(index + 1)}
          >
            <Text style={surveyStyles.emoji}>{emoji}</Text>
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
        onChange(selectedValues.filter((existingValue) => existingValue !== choice));
      } else {
        onChange([...selectedValues, choice]);
      }
      return;
    }
    onChange(choice);
  };

  return (
    <View style={surveyStyles.choicesContainer}>
      {options?.choices?.map((choice) => {
        const isSelected = selectedValues.includes(choice);
        return (
          <TouchableOpacity
            key={choice}
            style={[
              surveyStyles.choiceButton,
              isSelected && {
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}10`,
              },
            ]}
            onPress={() => handleSelect(choice)}
          >
            <View
              style={[
                surveyStyles.choiceIndicator,
                allowMultiple ? surveyStyles.checkbox : surveyStyles.radio,
                isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
            >
              {isSelected && (
                <Text style={surveyStyles.checkmark}>{allowMultiple ? "✓" : "●"}</Text>
              )}
            </View>
            <Text style={surveyStyles.choiceText}>{choice}</Text>
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
    <View style={surveyStyles.textContainer}>
      <TextInput
        style={[surveyStyles.textInput, multiline && surveyStyles.textInputMultiline]}
        value={value || ""}
        onChangeText={onChange}
        maxLength={maxLength}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        placeholder="Type your answer..."
        placeholderTextColor="#9CA3AF"
      />
      <Text style={surveyStyles.charCount}>
        {(value || "").length}/{maxLength}
      </Text>
    </View>
  );
}
