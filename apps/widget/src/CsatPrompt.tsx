import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { X } from "./icons";
import type { Id } from "@opencom/convex/dataModel";

interface CsatPromptProps {
  conversationId: Id<"conversations">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function CsatPrompt({
  conversationId,
  visitorId,
  sessionToken,
  onClose,
  onSubmitted,
}: CsatPromptProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitCsat = useMutation(api.reporting.submitCsatResponse);

  const handleSubmit = async () => {
    if (rating === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await submitCsat({
        conversationId,
        rating,
        feedback: feedback.trim() || undefined,
        visitorId,
        sessionToken,
      });
      setSubmitted(true);
      setTimeout(() => {
        onSubmitted();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ratingLabels = [
    "Very Dissatisfied",
    "Dissatisfied",
    "Neutral",
    "Satisfied",
    "Very Satisfied",
  ];

  if (submitted) {
    return (
      <div className="opencom-csat-prompt" data-testid="widget-csat-prompt">
        <div className="opencom-csat-success" data-testid="widget-csat-success">
          <div className="opencom-csat-success-icon">✓</div>
          <p className="opencom-csat-success-text" data-testid="widget-csat-success-text">
            Thank you for your feedback!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="opencom-csat-prompt" data-testid="widget-csat-prompt">
      <button
        className="opencom-csat-close"
        onClick={onClose}
        aria-label="Close"
        data-testid="widget-csat-close"
        type="button"
      >
        <X />
      </button>

      <h3 className="opencom-csat-title" data-testid="widget-csat-title">
        How was your experience?
      </h3>
      <p className="opencom-csat-subtitle">Your feedback helps us improve</p>

      <div className="opencom-csat-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`opencom-csat-star ${rating !== null && star <= rating ? "opencom-csat-star-active" : ""}`}
            onClick={() => setRating(star)}
            aria-label={`Rate ${star} out of 5`}
            data-testid={`widget-csat-rating-${star}`}
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              fill={rating !== null && star <= rating ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>

      {rating !== null && <p className="opencom-csat-rating-label">{ratingLabels[rating - 1]}</p>}

      {rating !== null && (
        <div className="opencom-csat-feedback">
          <textarea
            className="opencom-csat-textarea"
            placeholder="Tell us more about your experience (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            data-testid="widget-csat-feedback-input"
          />
        </div>
      )}

      {error && (
        <p className="opencom-csat-error" data-testid="widget-csat-error">
          {error}
        </p>
      )}

      <button
        className="opencom-csat-submit"
        onClick={handleSubmit}
        disabled={rating === null || isSubmitting}
        data-testid="widget-csat-submit"
        type="button"
      >
        {isSubmitting ? "Submitting..." : "Submit Feedback"}
      </button>
    </div>
  );
}
