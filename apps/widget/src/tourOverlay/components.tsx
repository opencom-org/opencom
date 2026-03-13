import type { RefObject } from "react";
import type { ElementPosition, TooltipPosition, TourStep } from "./types";

type AsyncHandler = () => void | Promise<void>;

interface EmergencyCloseButtonProps {
  onDismiss: AsyncHandler;
}

export function TourEmergencyCloseButton({ onDismiss }: EmergencyCloseButtonProps) {
  return (
    <button
      type="button"
      data-testid="tour-emergency-close"
      onClick={() => {
        void onDismiss();
      }}
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 1000003,
        pointerEvents: "auto",
        border: "none",
        borderRadius: 999,
        background: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Exit tour
    </button>
  );
}

interface RecoveryModalProps {
  failureHint: string | null;
  currentStepIndex: number;
  totalSteps: number;
  buttonColor: string;
  onRetry: () => void;
  onSkipStep: AsyncHandler;
  onDismiss: AsyncHandler;
}

export function TourRecoveryModal({
  failureHint,
  currentStepIndex,
  totalSteps,
  buttonColor,
  onRetry,
  onSkipStep,
  onDismiss,
}: RecoveryModalProps) {
  return (
    <div
      className="opencom-tour-modal"
      style={{ maxWidth: 460, zIndex: 1000002 }}
      data-testid="tour-recovery-hint"
    >
      <h3 className="opencom-tour-title">Tour paused</h3>
      <div className="opencom-tour-content">
        {failureHint ??
          "We couldn't render this tour step properly. You can retry, skip this step, or close the tour."}
      </div>
      <div className="opencom-tour-footer">
        <div className="opencom-tour-progress">
          {currentStepIndex + 1} / {totalSteps}
        </div>
        <div className="opencom-tour-actions">
          <button onClick={onRetry} className="opencom-tour-btn-secondary">
            Retry
          </button>
          <button
            onClick={() => {
              void onSkipStep();
            }}
            className="opencom-tour-btn-secondary"
          >
            Skip step
          </button>
          <button
            onClick={() => {
              void onDismiss();
            }}
            className="opencom-tour-btn-primary"
            style={{ backgroundColor: buttonColor }}
          >
            Close tour
          </button>
        </div>
      </div>
      <button
        onClick={() => {
          void onDismiss();
        }}
        className="opencom-tour-close"
        aria-label="Dismiss tour"
      >
        ×
      </button>
    </div>
  );
}

interface RouteHintModalProps {
  routeHint: string;
  currentStepIndex: number;
  totalSteps: number;
  onDismiss: AsyncHandler;
}

export function TourRouteHintModal({
  routeHint,
  currentStepIndex,
  totalSteps,
  onDismiss,
}: RouteHintModalProps) {
  return (
    <div
      className="opencom-tour-modal"
      style={{ maxWidth: 420, zIndex: 1000001 }}
      data-testid="tour-route-hint"
    >
      <div className="opencom-tour-body">
        <h3 className="opencom-tour-title">Continue Tour</h3>
        <div className="opencom-tour-content">{routeHint}</div>
      </div>
      <div className="opencom-tour-footer">
        <div className="opencom-tour-progress">
          {currentStepIndex + 1} / {totalSteps}
        </div>
      </div>
      <button
        onClick={() => {
          void onDismiss();
        }}
        className="opencom-tour-close"
        aria-label="Dismiss tour"
      >
        ×
      </button>
    </div>
  );
}

interface PointerBackdropProps {
  elementPosition: ElementPosition;
  buttonColor: string;
}

export function TourPointerBackdrop({ elementPosition, buttonColor }: PointerBackdropProps) {
  return (
    <div className="opencom-tour-backdrop">
      <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={elementPosition.left}
              y={elementPosition.top}
              width={elementPosition.width}
              height={elementPosition.height}
              rx="4"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
      </svg>

      <div
        className="opencom-tour-highlight"
        style={{
          top: elementPosition.top,
          left: elementPosition.left,
          width: elementPosition.width,
          height: elementPosition.height,
          borderColor: buttonColor,
        }}
      />
    </div>
  );
}

export function TourPostBackdrop() {
  return <div className="opencom-tour-backdrop opencom-tour-backdrop-full" />;
}

interface PointerStepCardProps {
  currentStep: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  tooltipPosition: TooltipPosition;
  advanceHint: string | null;
  hasSecondaryActions: boolean;
  showMoreMenu: boolean;
  moreMenuRef: RefObject<HTMLDivElement | null>;
  buttonColor: string;
  buttonText: string;
  canUseClickButton: boolean;
  showDontShowAgain: boolean;
  showSnooze: boolean;
  showRestart: boolean;
  onToggleMoreMenu: () => void;
  onDismissPermanentlyWithClose: AsyncHandler;
  onSnoozeWithClose: AsyncHandler;
  onRestart: AsyncHandler;
  onNextClick: AsyncHandler;
  onDismiss: AsyncHandler;
}

export function TourPointerStepCard({
  currentStep,
  currentStepIndex,
  totalSteps,
  tooltipPosition,
  advanceHint,
  hasSecondaryActions,
  showMoreMenu,
  moreMenuRef,
  buttonColor,
  buttonText,
  canUseClickButton,
  showDontShowAgain,
  showSnooze,
  showRestart,
  onToggleMoreMenu,
  onDismissPermanentlyWithClose,
  onSnoozeWithClose,
  onRestart,
  onNextClick,
  onDismiss,
}: PointerStepCardProps) {
  return (
    <div
      className={`opencom-tour-tooltip opencom-tour-tooltip-${currentStep.size || "small"} ${
        tooltipPosition.layout === "fallback" ? "opencom-tour-tooltip-fallback" : ""
      }`}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        width: tooltipPosition.width,
        maxHeight: tooltipPosition.maxHeight,
      }}
      data-testid="tour-step-card"
      data-tour-layout={tooltipPosition.layout}
    >
      <div className="opencom-tour-body">
        {currentStep.title && (
          <h3 className="opencom-tour-title" data-testid="tour-step-title">
            {currentStep.title}
          </h3>
        )}
        <div className="opencom-tour-content">{currentStep.content}</div>

        {currentStep.type === "video" && currentStep.mediaUrl && (
          <video
            src={currentStep.mediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="opencom-tour-video"
          />
        )}

        {advanceHint && (
          <div className="opencom-tour-content" style={{ marginTop: 8 }} data-testid="tour-advance-guidance">
            {advanceHint}
          </div>
        )}
      </div>

      <div className="opencom-tour-footer">
        <div className="opencom-tour-progress" data-testid="tour-step-progress">
          {currentStepIndex + 1} / {totalSteps}
        </div>
        <div className="opencom-tour-actions">
          {hasSecondaryActions && (
            <div className="opencom-tour-more-container" ref={moreMenuRef}>
              <button onClick={onToggleMoreMenu} className="opencom-tour-btn-more" aria-label="More options">
                ⋯
              </button>
              {showMoreMenu && (
                <div className="opencom-tour-more-menu">
                  {showDontShowAgain && (
                    <button
                      onClick={() => {
                        void onDismissPermanentlyWithClose();
                      }}
                    >
                      Don&apos;t show again
                    </button>
                  )}
                  {showSnooze && (
                    <button
                      onClick={() => {
                        void onSnoozeWithClose();
                      }}
                    >
                      Remind me later
                    </button>
                  )}
                  {showRestart && (
                    <button
                      onClick={() => {
                        void onRestart();
                      }}
                    >
                      Restart
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {canUseClickButton && (
            <button
              onClick={() => {
                void onNextClick();
              }}
              className="opencom-tour-btn-primary"
              style={{ backgroundColor: buttonColor }}
              data-testid="tour-primary-action"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          void onDismiss();
        }}
        className="opencom-tour-close"
        aria-label="Dismiss tour"
      >
        ×
      </button>
    </div>
  );
}

interface PostStepCardProps {
  currentStep: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  advanceHint: string | null;
  hasSecondaryActions: boolean;
  showMoreMenu: boolean;
  moreMenuRef: RefObject<HTMLDivElement | null>;
  buttonColor: string;
  buttonText: string;
  canUseClickButton: boolean;
  showDontShowAgain: boolean;
  showSnooze: boolean;
  onToggleMoreMenu: () => void;
  onDismissPermanentlyWithClose: AsyncHandler;
  onSnoozeWithClose: AsyncHandler;
  onNextClick: AsyncHandler;
  onDismiss: AsyncHandler;
}

export function TourPostStepCard({
  currentStep,
  currentStepIndex,
  totalSteps,
  advanceHint,
  hasSecondaryActions,
  showMoreMenu,
  moreMenuRef,
  buttonColor,
  buttonText,
  canUseClickButton,
  showDontShowAgain,
  showSnooze,
  onToggleMoreMenu,
  onDismissPermanentlyWithClose,
  onSnoozeWithClose,
  onNextClick,
  onDismiss,
}: PostStepCardProps) {
  return (
    <div className="opencom-tour-modal" data-testid="tour-step-card">
      <div className="opencom-tour-body">
        {currentStep.title && (
          <h3 className="opencom-tour-title" data-testid="tour-step-title">
            {currentStep.title}
          </h3>
        )}

        {currentStep.mediaUrl && currentStep.mediaType === "image" && (
          <img src={currentStep.mediaUrl} alt="" className="opencom-tour-image" />
        )}
        {currentStep.mediaUrl && currentStep.mediaType === "video" && (
          <video
            src={currentStep.mediaUrl}
            autoPlay
            controls
            playsInline
            className="opencom-tour-video"
          />
        )}

        <div className="opencom-tour-content">{currentStep.content}</div>
        {advanceHint && (
          <div className="opencom-tour-content" style={{ marginTop: 8 }} data-testid="tour-advance-guidance">
            {advanceHint}
          </div>
        )}
      </div>

      <div className="opencom-tour-footer">
        <div className="opencom-tour-progress" data-testid="tour-step-progress">
          {currentStepIndex + 1} / {totalSteps}
        </div>
        <div className="opencom-tour-actions">
          {hasSecondaryActions && (
            <div className="opencom-tour-more-container" ref={moreMenuRef}>
              <button onClick={onToggleMoreMenu} className="opencom-tour-btn-more" aria-label="More options">
                ⋯
              </button>
              {showMoreMenu && (
                <div className="opencom-tour-more-menu">
                  {showDontShowAgain && (
                    <button
                      onClick={() => {
                        void onDismissPermanentlyWithClose();
                      }}
                    >
                      Don&apos;t show again
                    </button>
                  )}
                  {showSnooze && (
                    <button
                      onClick={() => {
                        void onSnoozeWithClose();
                      }}
                    >
                      Remind me later
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {canUseClickButton && (
            <button
              onClick={() => {
                void onNextClick();
              }}
              className="opencom-tour-btn-primary"
              style={{ backgroundColor: buttonColor }}
              data-testid="tour-primary-action"
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          void onDismiss();
        }}
        className="opencom-tour-close"
        aria-label="Dismiss tour"
      >
        ×
      </button>
    </div>
  );
}

export function TourConfettiLayer() {
  return (
    <div className="opencom-tour-confetti">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="opencom-confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ["#ff0", "#f0f", "#0ff", "#f00", "#0f0", "#00f"][
              Math.floor(Math.random() * 6)
            ],
          }}
        />
      ))}
    </div>
  );
}
