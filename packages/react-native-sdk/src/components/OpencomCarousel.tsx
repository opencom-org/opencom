import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Image,
  Linking,
  type ViewStyle,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { OpencomSDK } from "../OpencomSDK";
import { useMessengerSettings } from "../hooks/useMessengerSettings";
import type { CarouselScreen, CarouselButton } from "@opencom/sdk-core";
import type { Id } from "@opencom/convex/dataModel";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OpencomCarouselProps {
  carouselId: Id<"carousels">;
  screens: CarouselScreen[];
  onDismiss?: () => void;
  onComplete?: () => void;
  style?: ViewStyle;
  primaryColor?: string;
}

export function OpencomCarousel({
  carouselId,
  screens,
  onDismiss,
  onComplete,
  style,
  primaryColor,
}: OpencomCarouselProps) {
  const { theme } = useMessengerSettings();
  const effectivePrimaryColor = primaryColor ?? theme.primaryColor;
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const recordImpression = useMutation(api.carousels.recordImpression);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const goToNext = () => {
    if (currentIndex < screens.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      await recordImpression({
        carouselId,
        visitorId: state.visitorId,
        sessionToken: state.sessionToken,
        action: "completed",
        screenIndex: currentIndex,
      });
    }
    onComplete?.();
  };

  const handleDismiss = async () => {
    const state = OpencomSDK.getVisitorState();
    if (state.visitorId && state.sessionToken) {
      await recordImpression({
        carouselId,
        visitorId: state.visitorId,
        sessionToken: state.sessionToken,
        action: "dismissed",
        screenIndex: currentIndex,
      });
    }
    onDismiss?.();
  };

  const handleButtonPress = async (button: CarouselButton) => {
    switch (button.action) {
      case "next":
        goToNext();
        break;
      case "dismiss":
        handleDismiss();
        break;
      case "url":
        if (button.url) {
          Linking.openURL(button.url);
        }
        break;
      case "deeplink":
        if (button.deepLink) {
          Linking.openURL(button.deepLink);
        }
        break;
    }
  };

  const renderScreen = ({ item }: { item: CarouselScreen }) => (
    <View style={[styles.screenContainer, { backgroundColor: theme.surfaceColor }]}>
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.contentContainer}>
        {item.title && <Text style={[styles.title, { color: theme.textColor }]}>{item.title}</Text>}
        {item.body && <Text style={[styles.body, { color: theme.textMuted }]}>{item.body}</Text>}
        {item.buttons && item.buttons.length > 0 && (
          <View style={styles.buttonsContainer}>
            {item.buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  index === 0
                    ? { backgroundColor: effectivePrimaryColor }
                    : [styles.secondaryButton, { borderColor: theme.borderColor }],
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: index === 0 ? theme.textOnPrimary : effectivePrimaryColor },
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceColor }, style]}>
      <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
        <Text style={[styles.dismissText, { color: theme.textOnPrimary }]}>✕</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={screens}
        renderItem={renderScreen}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      <View style={styles.pagination}>
        {screens.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              { backgroundColor: theme.mutedColor },
              index === currentIndex && [
                styles.paginationDotActive,
                { backgroundColor: effectivePrimaryColor },
              ],
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  dismissButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  dismissText: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  screenContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  image: {
    width: "100%",
    height: "50%",
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E5E5",
  },
  paginationDotActive: {
    width: 24,
  },
});
