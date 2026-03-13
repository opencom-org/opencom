import type {
  SurveyAnswerPrimitive,
  SurveyAnswerPrimitiveArray,
  SurveyAnswerValue,
} from "./types";

export function isSurveyAnswerPrimitive(value: unknown): value is SurveyAnswerPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function isStringOrNumberArray(value: unknown): value is SurveyAnswerPrimitiveArray {
  if (!Array.isArray(value)) {
    return false;
  }

  return (
    value.every((entry) => typeof entry === "string") ||
    value.every((entry) => typeof entry === "number")
  );
}

export function normalizeSurveyAnswerValue(value: unknown): SurveyAnswerValue {
  if (isSurveyAnswerPrimitive(value)) {
    return value;
  }

  if (isStringOrNumberArray(value)) {
    return value;
  }

  return null;
}
