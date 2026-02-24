import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Linking,
  Dimensions,
} from "react-native";
import {
  useOutboundMessages,
  type OutboundMessageData,
  type ClickAction,
} from "../hooks/useOutboundMessages";

interface OpencomOutboundProps {
  currentUrl?: string;
  onMessageShown?: (message: OutboundMessageData) => void;
  onMessageDismissed?: (message: OutboundMessageData) => void;
  onButtonClick?: (message: OutboundMessageData, buttonIndex: number) => void;
  onOpenMessenger?: () => void;
  onStartConversation?: (prefillMessage?: string) => void;
  onNavigateTab?: (tabId: string) => void;
  onOpenArticle?: (articleId: string) => void;
  launcherBottomOffset?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Track which messages are currently visible by their ID
interface VisibleMessages {
  banner: OutboundMessageData | null;
  post: OutboundMessageData | null;
  chat: OutboundMessageData | null;
}

// Stagger delay between showing different message types (in ms)
const STAGGER_DELAY_MS = 100;

export function OpencomOutbound({
  currentUrl = "",
  onMessageShown,
  onMessageDismissed,
  onButtonClick,
  onOpenMessenger,
  onStartConversation,
  onNavigateTab,
  onOpenArticle,
  launcherBottomOffset = 16,
}: OpencomOutboundProps) {
  const { messages, markAsSeen, trackClick, trackDismiss } = useOutboundMessages(currentUrl);
  const [visibleMessages, setVisibleMessages] = useState<VisibleMessages>({
    banner: null,
    post: null,
    chat: null,
  });
  const [shownMessageIds, setShownMessageIds] = useState<Set<string>>(new Set());

  // Show all eligible messages simultaneously (staggered by type)
  useEffect(() => {
    if (messages.length === 0) return;

    // Group messages by type and get the first unshown one for each type
    const bannerMessage = messages.find((m) => m.type === "banner" && !shownMessageIds.has(m._id));
    const postMessage = messages.find((m) => m.type === "post" && !shownMessageIds.has(m._id));
    const chatMessage = messages.find((m) => m.type === "chat" && !shownMessageIds.has(m._id));

    const messagesToShow: Array<{ message: OutboundMessageData; delay: number }> = [];
    let delay = 0;

    if (bannerMessage && !visibleMessages.banner) {
      messagesToShow.push({ message: bannerMessage, delay });
      delay += STAGGER_DELAY_MS;
    }
    if (postMessage && !visibleMessages.post) {
      messagesToShow.push({ message: postMessage, delay });
      delay += STAGGER_DELAY_MS;
    }
    if (chatMessage && !visibleMessages.chat) {
      messagesToShow.push({ message: chatMessage, delay });
    }

    // Show each message with staggered timing
    messagesToShow.forEach(({ message, delay: msgDelay }) => {
      const timeoutId = setTimeout(() => {
        showMessage(message);
      }, msgDelay);
      return () => clearTimeout(timeoutId);
    });
  }, [messages, shownMessageIds, visibleMessages]);

  const showMessage = async (message: OutboundMessageData) => {
    setVisibleMessages((prev) => ({
      ...prev,
      [message.type]: message,
    }));
    setShownMessageIds((prev) => new Set(prev).add(message._id));
    await markAsSeen(message._id);
    onMessageShown?.(message);
  };

  const hideMessage = (message: OutboundMessageData) => {
    setVisibleMessages((prev) => ({
      ...prev,
      [message.type]: null,
    }));
  };

  const handleDismiss = async (message: OutboundMessageData) => {
    await trackDismiss(message._id);
    onMessageDismissed?.(message);
    hideMessage(message);
  };

  const executeClickAction = (message: OutboundMessageData, action: ClickAction) => {
    switch (action.type) {
      case "open_messenger":
        hideMessage(message);
        onOpenMessenger?.();
        break;
      case "open_new_conversation":
        hideMessage(message);
        onStartConversation?.(action.prefillMessage);
        break;
      case "open_widget_tab":
        hideMessage(message);
        if (action.tabId) onNavigateTab?.(action.tabId);
        break;
      case "open_help_article":
        hideMessage(message);
        if (action.articleId) onOpenArticle?.(action.articleId as string);
        break;
      case "open_url":
        if (action.url) Linking.openURL(action.url);
        hideMessage(message);
        break;
      case "dismiss":
        handleDismiss(message);
        break;
    }
  };

  const handleClickAction = async (message: OutboundMessageData) => {
    await trackClick(message._id);
    const action: ClickAction = message.content.clickAction || { type: "open_messenger" };
    executeClickAction(message, action);
  };

  const handleButtonPress = async (message: OutboundMessageData, buttonIndex: number) => {
    const button = message.content.buttons?.[buttonIndex];
    if (!button) return;

    await trackClick(message._id, buttonIndex);
    onButtonClick?.(message, buttonIndex);

    if (button.action === "url" && button.url) {
      Linking.openURL(button.url);
    } else if (button.action === "open_new_conversation") {
      onStartConversation?.(button.prefillMessage);
      hideMessage(message);
    } else if (button.action === "open_help_article" && button.articleId) {
      onOpenArticle?.(button.articleId as string);
      hideMessage(message);
    } else if (button.action === "open_widget_tab" && button.tabId) {
      onNavigateTab?.(button.tabId);
      hideMessage(message);
    }

    if (button.action === "dismiss") {
      handleDismiss(message);
    }

    // Open messenger for reply/chat actions
    if (button.action === "reply" || button.action === "chat") {
      hideMessage(message);
      onOpenMessenger?.();
    }
  };

  const { banner, post, chat } = visibleMessages;
  const hasAnyVisible = banner || post || chat;

  if (!hasAnyVisible) {
    return null;
  }

  // Calculate position for chat to not block the launcher button
  const chatBottomPosition = launcherBottomOffset + 70; // 56px launcher + 14px gap

  return (
    <>
      {/* Banner - positioned at top */}
      {banner && (
        <View style={styles.bannerContainer}>
          <TouchableOpacity
            style={styles.bannerContent}
            onPress={() => handleClickAction(banner)}
            activeOpacity={0.8}
          >
            <Text style={styles.bannerText} numberOfLines={2}>
              {banner.content.text || banner.content.body}
            </Text>
            {banner.content.dismissible !== false && (
              <TouchableOpacity onPress={() => handleDismiss(banner)} style={styles.bannerClose}>
                <Text style={styles.bannerCloseText}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {banner.content.buttons && banner.content.buttons.length > 0 && (
            <View style={styles.bannerButtons}>
              {banner.content.buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.bannerButton}
                  onPress={() => handleButtonPress(banner, index)}
                >
                  <Text style={styles.bannerButtonText}>{button.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Post - modal overlay */}
      {post && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={() => handleDismiss(post)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.postContainer}>
              {post.content.dismissible !== false && (
                <TouchableOpacity style={styles.postClose} onPress={() => handleDismiss(post)}>
                  <Text style={styles.postCloseText}>✕</Text>
                </TouchableOpacity>
              )}

              {post.content.imageUrl && (
                <Image
                  source={{ uri: post.content.imageUrl }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}

              <TouchableOpacity
                style={styles.postContent}
                onPress={() => handleClickAction(post)}
                activeOpacity={0.8}
              >
                {post.content.title && <Text style={styles.postTitle}>{post.content.title}</Text>}
                {post.content.body && <Text style={styles.postBody}>{post.content.body}</Text>}
              </TouchableOpacity>

              {post.content.buttons && post.content.buttons.length > 0 && (
                <View style={styles.postButtons}>
                  {post.content.buttons.map((button, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.postButton, index === 0 && styles.postButtonPrimary]}
                      onPress={() => handleButtonPress(post, index)}
                    >
                      <Text
                        style={[styles.postButtonText, index === 0 && styles.postButtonTextPrimary]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Chat - floating message bubble */}
      {chat && (
        <View
          style={[
            styles.chatContainer,
            chat.content.style === "inline" ? styles.chatInline : { bottom: chatBottomPosition },
          ]}
          testID="outbound-message"
        >
          <TouchableOpacity
            style={styles.chatBubble}
            onPress={() => handleClickAction(chat)}
            activeOpacity={0.9}
            testID="outbound-message-bubble"
          >
            <Text style={styles.chatText}>{chat.content.text}</Text>
            {chat.content.dismissible !== false && (
              <TouchableOpacity
                onPress={() => handleDismiss(chat)}
                style={styles.chatClose}
                testID="outbound-dismiss-button"
              >
                <Text style={styles.chatCloseText}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {chat.content.buttons && chat.content.buttons.length > 0 && (
            <View style={styles.chatButtons}>
              {chat.content.buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chatButton}
                  onPress={() => handleButtonPress(chat, index)}
                  testID={`outbound-button-${index}`}
                >
                  <Text style={styles.chatButtonText}>{button.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Banner styles
  bannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#792cd4",
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  bannerClose: {
    padding: 4,
    marginLeft: 8,
  },
  bannerCloseText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  bannerButtons: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  bannerButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  bannerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  // Post styles
  postContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    overflow: "hidden",
  },
  postClose: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  postCloseText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  postImage: {
    width: "100%",
    height: 180,
  },
  postContent: {
    padding: 20,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  postBody: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  postButtons: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  postButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  postButtonPrimary: {
    backgroundColor: "#792cd4",
  },
  postButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
  },
  postButtonTextPrimary: {
    color: "#FFFFFF",
  },

  // Chat styles - positioned to not block the launcher
  chatContainer: {
    position: "absolute",
    right: 16,
    maxWidth: 280,
    zIndex: 999,
  },
  chatInline: {
    position: "relative",
    bottom: 0,
    right: 0,
    maxWidth: "100%",
  },
  chatFloating: {},
  chatBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  chatText: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 22,
    paddingRight: 20,
  },
  chatClose: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  chatCloseText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  chatButtons: {
    marginTop: 8,
    gap: 6,
  },
  chatButton: {
    backgroundColor: "#792cd4",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
