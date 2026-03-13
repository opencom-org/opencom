import { useState } from "react";
import type { SurveyQuestion } from "./types";

interface SurveyContainerProps {
  children: React.ReactNode;
  onDismiss: () => void;
  showDismiss?: boolean;
}

export function SmallFormatContainer({ children, onDismiss, showDismiss }: SurveyContainerProps) {
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

export function LargeFormatContainer({ children, onDismiss, showDismiss }: SurveyContainerProps) {
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
        onChange(selectedValues.filter((selected) => selected !== choice));
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
