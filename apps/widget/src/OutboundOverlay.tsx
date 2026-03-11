import { useState, useEffect, useCallback, useRef, useMemo, type MouseEvent } from "react";
import { X } from "./icons";
import type { Id } from "@opencom/convex/dataModel";
import type {
  EligibleOutboundMessage,
  OutboundClickAction,
} from "@opencom/types";
import { safeOpenUrl } from "./utils/safeOpenUrl";
import {
  useWidgetMutation,
  useWidgetQuery,
  widgetMutationRef,
  widgetQueryRef,
} from "./lib/convex/hooks";

type ClickAction = OutboundClickAction<Id<"articles">>;
type OutboundMessage = EligibleOutboundMessage<
  Id<"outboundMessages">,
  Id<"users">,
  Id<"tours">,
  Id<"articles">
>;

const eligibleOutboundMessagesQueryRef = widgetQueryRef<
  {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    sessionToken?: string;
    currentUrl: string;
    sessionId: string;
  },
  OutboundMessage[]
>("outboundMessages:getEligible");

const trackOutboundImpressionMutationRef = widgetMutationRef<
  {
    messageId: Id<"outboundMessages">;
    visitorId: Id<"visitors">;
    sessionToken?: string;
    sessionId: string;
    action: "shown" | "dismissed" | "clicked";
    buttonIndex?: number;
  },
  null
>("outboundMessages:trackImpression");

// Track one visible message per type (banner, post, chat) simultaneously
interface VisibleMessages {
  banner: OutboundMessage | null;
  post: OutboundMessage | null;
  chat: OutboundMessage | null;
}

// Stagger delay between showing different message types (in ms)
const STAGGER_DELAY_MS = 100;

interface OutboundOverlayProps {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken?: string | null;
  sessionId: string;
  currentUrl: string;
  allowBlockingPost?: boolean;
  onBlockingStateChange?: (state: { hasPendingPost: boolean; hasActivePost: boolean }) => void;
  onStartTour?: (tourId: Id<"tours">) => void;
  onOpenMessenger?: () => void;
  onStartConversation?: (prefillMessage?: string) => void;
  onNavigateTab?: (tabId: string) => void;
  onOpenArticle?: (articleId: Id<"articles">) => void;
}

function handleMutationResult(result: unknown) {
  if (result && typeof result === "object" && "catch" in result && typeof result.catch === "function") {
    result.catch(console.error);
  }
}

export function OutboundOverlay({
  workspaceId,
  visitorId,
  sessionToken,
  sessionId,
  currentUrl,
  allowBlockingPost = true,
  onBlockingStateChange,
  onStartTour,
  onOpenMessenger,
  onStartConversation,
  onNavigateTab,
  onOpenArticle,
}: OutboundOverlayProps) {
  const [visibleMessages, setVisibleMessages] = useState<VisibleMessages>({
    banner: null,
    post: null,
    chat: null,
  });
  const [shownMessageIds, setShownMessageIds] = useState<Set<string>>(new Set());
  const [scrollPercent, setScrollPercent] = useState(0);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const staggerTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const eligibleMessages = useWidgetQuery(eligibleOutboundMessagesQueryRef, {
    workspaceId,
    visitorId,
    sessionToken: sessionToken ?? undefined,
    currentUrl,
    sessionId,
  }) as OutboundMessage[] | undefined;

  const trackImpression = useWidgetMutation(trackOutboundImpressionMutationRef);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      setScrollPercent(percent);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track time on page
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOnPage((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset time on page when URL changes
  useEffect(() => {
    setTimeOnPage(0);
  }, [currentUrl]);

  const isTriggerReady = useCallback(
    (message: OutboundMessage): boolean => {
      const triggers = message.triggers;
      if (!triggers || triggers.type === "immediate") return true;
      if (triggers.type === "time_on_page") return timeOnPage >= (triggers.delaySeconds || 5);
      if (triggers.type === "scroll_depth") return scrollPercent >= (triggers.scrollPercent || 50);
      if (triggers.type === "page_visit") return true;
      return false;
    },
    [timeOnPage, scrollPercent]
  );

  const nextMessages = useMemo(() => {
    if (!eligibleMessages || eligibleMessages.length === 0) {
      return {
        banner: null as OutboundMessage | null,
        post: null as OutboundMessage | null,
        chat: null as OutboundMessage | null,
      };
    }

    const banner = eligibleMessages.find(
      (m) => m.type === "banner" && !shownMessageIds.has(m._id) && isTriggerReady(m)
    );
    const post = eligibleMessages.find(
      (m) => m.type === "post" && !shownMessageIds.has(m._id) && isTriggerReady(m)
    );
    const chat = eligibleMessages.find(
      (m) => m.type === "chat" && !shownMessageIds.has(m._id) && isTriggerReady(m)
    );

    return {
      banner: (banner as OutboundMessage | undefined) ?? null,
      post: (post as OutboundMessage | undefined) ?? null,
      chat: (chat as OutboundMessage | undefined) ?? null,
    };
  }, [eligibleMessages, shownMessageIds, isTriggerReady]);

  const hasActivePost = Boolean(visibleMessages.post);
  const hasPendingPost = Boolean(nextMessages.post && !visibleMessages.post);

  useEffect(() => {
    onBlockingStateChange?.({ hasPendingPost, hasActivePost });
  }, [onBlockingStateChange, hasPendingPost, hasActivePost]);

  useEffect(() => {
    return () => {
      onBlockingStateChange?.({ hasPendingPost: false, hasActivePost: false });
    };
  }, [onBlockingStateChange]);

  // Show all eligible messages simultaneously, grouped by type
  useEffect(() => {
    if (!nextMessages.banner && !nextMessages.post && !nextMessages.chat) return;

    const toShow: Array<{ message: OutboundMessage; delay: number }> = [];
    let delay = 0;

    if (nextMessages.banner && !visibleMessages.banner) {
      toShow.push({ message: nextMessages.banner, delay });
      delay += STAGGER_DELAY_MS;
    }
    if (nextMessages.post && !visibleMessages.post && allowBlockingPost) {
      toShow.push({ message: nextMessages.post, delay });
      delay += STAGGER_DELAY_MS;
    }
    if (nextMessages.chat && !visibleMessages.chat) {
      toShow.push({ message: nextMessages.chat, delay });
    }

    if (toShow.length === 0) return;

    // Show each message with staggered timing
    toShow.forEach(({ message, delay: msgDelay }) => {
      const timer = setTimeout(() => {
        setVisibleMessages((prev) => ({ ...prev, [message.type]: message }));
        setShownMessageIds((prev) => new Set(prev).add(message._id));
        handleMutationResult(
          trackImpression({
            messageId: message._id,
            visitorId,
            sessionToken: sessionToken ?? undefined,
            sessionId,
            action: "shown",
          })
        );
      }, msgDelay);
      staggerTimers.current.push(timer);
    });

    return () => {
      staggerTimers.current.forEach(clearTimeout);
      staggerTimers.current = [];
    };
  }, [
    nextMessages,
    allowBlockingPost,
    visibleMessages,
    visitorId,
    sessionToken,
    sessionId,
    trackImpression,
  ]);

  const handleDismiss = useCallback(
    (message: OutboundMessage) => {
      handleMutationResult(
        trackImpression({
          messageId: message._id,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          sessionId,
          action: "dismissed",
        })
      );
      setVisibleMessages((prev) => ({ ...prev, [message.type]: null }));
    },
    [visitorId, sessionToken, sessionId, trackImpression]
  );

  const executeClickAction = useCallback(
    (message: OutboundMessage, action: ClickAction) => {
      switch (action.type) {
        case "open_messenger":
          handleDismiss(message);
          onOpenMessenger?.();
          break;
        case "open_new_conversation":
          handleDismiss(message);
          onStartConversation?.(action.prefillMessage);
          break;
        case "open_widget_tab":
          handleDismiss(message);
          if (action.tabId) onNavigateTab?.(action.tabId);
          break;
        case "open_help_article":
          handleDismiss(message);
          if (action.articleId) onOpenArticle?.(action.articleId as Id<"articles">);
          break;
        case "open_url":
          if (action.url) safeOpenUrl(action.url);
          handleDismiss(message);
          break;
        case "dismiss":
          handleDismiss(message);
          break;
      }
    },
    [handleDismiss, onOpenMessenger, onStartConversation, onNavigateTab, onOpenArticle]
  );

  const handleClickAction = useCallback(
    (message: OutboundMessage) => {
      handleMutationResult(
        trackImpression({
          messageId: message._id,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          sessionId,
          action: "clicked",
        })
      );

      const action: ClickAction = message.content.clickAction || { type: "open_messenger" };
      executeClickAction(message, action);
    },
    [visitorId, sessionToken, sessionId, trackImpression, executeClickAction]
  );

  const handleButtonClick = useCallback(
    (
      event: MouseEvent<HTMLButtonElement>,
      message: OutboundMessage,
      button: NonNullable<OutboundMessage["content"]["buttons"]>[number],
      index: number
    ) => {
      event.stopPropagation();

      handleMutationResult(
        trackImpression({
          messageId: message._id,
          visitorId,
          sessionToken: sessionToken ?? undefined,
          sessionId,
          action: "clicked",
          buttonIndex: index,
        })
      );

      if (button.action === "url" && button.url) {
        safeOpenUrl(button.url);
      } else if (button.action === "tour" && button.tourId && onStartTour) {
        onStartTour(button.tourId as Id<"tours">);
      } else if (button.action === "open_new_conversation") {
        onStartConversation?.(button.prefillMessage);
        handleDismiss(message);
      } else if (button.action === "open_help_article" && button.articleId) {
        onOpenArticle?.(button.articleId as Id<"articles">);
        handleDismiss(message);
      } else if (button.action === "open_widget_tab" && button.tabId) {
        onNavigateTab?.(button.tabId);
        handleDismiss(message);
      }

      if (button.action === "dismiss" || button.action === "tour") {
        handleDismiss(message);
      }
    },
    [
      visitorId,
      sessionToken,
      sessionId,
      trackImpression,
      onStartTour,
      onStartConversation,
      onOpenArticle,
      onNavigateTab,
      handleDismiss,
    ]
  );

  const { banner, post, chat } = visibleMessages;
  const hasAnyVisible = banner || post || chat;

  if (!hasAnyVisible) return null;

  return (
    <>
      {/* Banner - positioned at top of page */}
      {banner &&
        (() => {
          const isFloating = banner.content.style === "floating";
          const isDismissible = banner.content.dismissible !== false;
          return (
            <div className={`opencom-outbound-banner ${isFloating ? "floating" : "inline"}`}>
              <div className="opencom-outbound-banner-content">
                <p onClick={() => handleClickAction(banner)} style={{ cursor: "pointer" }}>
                  {banner.content.text}
                </p>
                {banner.content.buttons && banner.content.buttons.length > 0 && (
                  <div className="opencom-outbound-banner-buttons">
                    {banner.content.buttons.map((btn, i) => (
                      <button
                        key={i}
                        onClick={(event) => handleButtonClick(event, banner, btn, i)}
                        className="opencom-outbound-banner-btn"
                      >
                        {btn.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isDismissible && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDismiss(banner);
                  }}
                  className="opencom-outbound-banner-close"
                >
                  <X />
                </button>
              )}
            </div>
          );
        })()}

      {/* Post - modal overlay */}
      {post && (
        <div className="opencom-outbound-post-overlay">
          <div className="opencom-outbound-post">
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleDismiss(post);
              }}
              className="opencom-outbound-post-close"
            >
              <X />
            </button>
            {post.content.imageUrl && (
              <img src={post.content.imageUrl} alt="" className="opencom-outbound-post-image" />
            )}
            {post.content.videoUrl && (
              <video src={post.content.videoUrl} controls className="opencom-outbound-post-video" />
            )}
            <div
              className="opencom-outbound-post-content"
              onClick={() => handleClickAction(post)}
              style={{ cursor: "pointer" }}
            >
              {post.content.title && (
                <h2 className="opencom-outbound-post-title">{post.content.title}</h2>
              )}
              {post.content.body && (
                <p className="opencom-outbound-post-body">{post.content.body}</p>
              )}
              {post.content.buttons && post.content.buttons.length > 0 && (
                <div className="opencom-outbound-post-buttons">
                  {post.content.buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={(event) => handleButtonClick(event, post, btn, i)}
                      className={`opencom-outbound-post-btn ${i === 0 ? "primary" : "secondary"}`}
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat - floating message bubble */}
      {chat && (
        <div className="opencom-outbound-chat">
          <div className="opencom-outbound-chat-bubble">
            <div className="opencom-outbound-chat-avatar">{chat.content.senderId ? "A" : "B"}</div>
            <div
              className="opencom-outbound-chat-content"
              onClick={() => handleClickAction(chat)}
              style={{ cursor: "pointer" }}
            >
              <p>{chat.content.text}</p>
              {chat.content.buttons && chat.content.buttons.length > 0 && (
                <div className="opencom-outbound-chat-buttons">
                  {chat.content.buttons.map((btn, i) => (
                    <button
                      key={i}
                      onClick={(event) => handleButtonClick(event, chat, btn, i)}
                      className="opencom-outbound-chat-btn"
                    >
                      {btn.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => handleDismiss(chat)} className="opencom-outbound-chat-close">
              <X />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
