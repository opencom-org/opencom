import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDefaultQuestionOptions, useSurveyQuestionEditor } from "./useSurveyQuestionEditor";

describe("getDefaultQuestionOptions", () => {
  it("returns expected defaults for question types with options", () => {
    expect(getDefaultQuestionOptions("numeric_scale")).toEqual({
      scaleStart: 1,
      scaleEnd: 5,
      startLabel: "Low",
      endLabel: "High",
    });

    expect(getDefaultQuestionOptions("multiple_choice")).toEqual({
      choices: ["Option 1", "Option 2", "Option 3"],
      allowMultiple: false,
    });
  });
});

describe("useSurveyQuestionEditor", () => {
  it("adds and updates questions while tracking dirty state", () => {
    const onDirty = vi.fn();
    const { result } = renderHook(() => useSurveyQuestionEditor({ onDirty }));

    act(() => {
      result.current.addQuestion("numeric_scale");
    });

    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0].options?.scaleStart).toBe(1);
    expect(result.current.expandedQuestion).toBe(result.current.questions[0].id);
    expect(onDirty).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateQuestion(result.current.questions[0].id, { title: "How was your day?" });
    });

    expect(result.current.questions[0].title).toBe("How was your day?");
    expect(onDirty).toHaveBeenCalledTimes(2);
  });

  it("moves and removes questions", () => {
    const onDirty = vi.fn();
    const { result } = renderHook(() => useSurveyQuestionEditor({ onDirty }));

    act(() => {
      result.current.addQuestion("short_text");
      result.current.addQuestion("long_text");
    });

    const firstIdBeforeMove = result.current.questions[0].id;
    const secondIdBeforeMove = result.current.questions[1].id;

    act(() => {
      result.current.moveQuestion(0, "down");
    });

    expect(result.current.questions[0].id).toBe(secondIdBeforeMove);
    expect(result.current.questions[1].id).toBe(firstIdBeforeMove);

    act(() => {
      result.current.removeQuestion(firstIdBeforeMove);
    });

    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0].id).toBe(secondIdBeforeMove);
  });
});
