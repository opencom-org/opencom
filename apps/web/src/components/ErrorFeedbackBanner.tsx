import type { ErrorFeedbackMessage } from "@opencom/web-shared";

interface ErrorFeedbackBannerProps {
  feedback: ErrorFeedbackMessage;
  className?: string;
}

export function ErrorFeedbackBanner({
  feedback,
  className,
}: ErrorFeedbackBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className={`rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 ${className ?? ""}`.trim()}
    >
      <p>{feedback.message}</p>
      {feedback.nextAction && <p className="mt-1 text-red-600">{feedback.nextAction}</p>}
    </div>
  );
}
