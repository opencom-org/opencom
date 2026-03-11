import type { ErrorFeedbackMessage } from "@opencom/web-shared";

interface ErrorFeedbackBannerProps {
  feedback: ErrorFeedbackMessage;
}

export function ErrorFeedbackBanner({ feedback }: ErrorFeedbackBannerProps): React.JSX.Element {
  return (
    <div className="opencom-error-feedback" role="alert">
      <p className="opencom-error-feedback-message">{feedback.message}</p>
      {feedback.nextAction && (
        <p className="opencom-error-feedback-next-action">{feedback.nextAction}</p>
      )}
    </div>
  );
}
