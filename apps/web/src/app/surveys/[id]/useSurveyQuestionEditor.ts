"use client";

import { useCallback, useState } from "react";
import {
  generateSurveyQuestionId,
  type Question,
  type QuestionType,
} from "./surveyEditorTypes";

export function getDefaultQuestionOptions(type: QuestionType): Question["options"] {
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
}

interface UseSurveyQuestionEditorOptions {
  onDirty: () => void;
}

export interface SurveyQuestionEditorController {
  questions: Question[];
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  expandedQuestion: string | null;
  setExpandedQuestion: React.Dispatch<React.SetStateAction<string | null>>;
  addQuestion: (type: QuestionType) => void;
  updateQuestion: (id: string, updates: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  moveQuestion: (index: number, direction: "up" | "down") => void;
}

export function useSurveyQuestionEditor({
  onDirty,
}: UseSurveyQuestionEditorOptions): SurveyQuestionEditorController {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const addQuestion = useCallback(
    (type: QuestionType) => {
      const newQuestion: Question = {
        id: generateSurveyQuestionId(),
        type,
        title: "",
        required: true,
        options: getDefaultQuestionOptions(type),
      };
      setQuestions((previousQuestions) => [...previousQuestions, newQuestion]);
      setExpandedQuestion(newQuestion.id);
      onDirty();
    },
    [onDirty]
  );

  const updateQuestion = useCallback(
    (id: string, updates: Partial<Question>) => {
      setQuestions((previousQuestions) =>
        previousQuestions.map((question) => (question.id === id ? { ...question, ...updates } : question))
      );
      onDirty();
    },
    [onDirty]
  );

  const removeQuestion = useCallback(
    (id: string) => {
      setQuestions((previousQuestions) => previousQuestions.filter((question) => question.id !== id));
      onDirty();
    },
    [onDirty]
  );

  const moveQuestion = useCallback(
    (index: number, direction: "up" | "down") => {
      setQuestions((previousQuestions) => {
        const nextQuestions = [...previousQuestions];
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= nextQuestions.length) {
          return previousQuestions;
        }
        [nextQuestions[index], nextQuestions[nextIndex]] = [nextQuestions[nextIndex], nextQuestions[index]];
        return nextQuestions;
      });
      onDirty();
    },
    [onDirty]
  );

  return {
    questions,
    setQuestions,
    expandedQuestion,
    setExpandedQuestion,
    addQuestion,
    updateQuestion,
    removeQuestion,
    moveQuestion,
  };
}
