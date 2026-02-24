import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, Image, type ViewStyle } from "react-native";
import { useConversations } from "../hooks/useConversations";
import { useMessengerSettings } from "../hooks/useMessengerSettings";

interface OpencomLauncherProps {
  onPress?: () => void;
  style?: ViewStyle;
  iconColor?: string;
  backgroundColor?: string;
  size?: number;
  position?: "bottom-right" | "bottom-left";
  /** Override spacing from edge (uses messenger settings if not provided) */
  spacing?: number;
  /** Test ID for E2E testing */
  testID?: string;
}

export function OpencomLauncher({
  onPress,
  style,
  iconColor,
  backgroundColor,
  size = 60,
  position,
  spacing,
  testID,
}: OpencomLauncherProps) {
  const { totalUnread } = useConversations();
  const { settings, theme } = useMessengerSettings();

  // Don't render if launcher is disabled in settings
  if (!settings.showLauncher) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  // Use settings for position/spacing, but allow prop overrides
  const effectivePosition =
    position ?? (settings.launcherPosition === "left" ? "bottom-left" : "bottom-right");
  const effectiveSpacing = spacing ?? settings.launcherSideSpacing;
  const effectiveBottomSpacing = settings.launcherBottomSpacing;
  const effectiveBgColor = backgroundColor ?? theme.primaryColor;
  const effectiveIconColor = iconColor ?? theme.textOnPrimary;

  const positionStyle =
    effectivePosition === "bottom-right"
      ? { right: effectiveSpacing, bottom: effectiveBottomSpacing }
      : { left: effectiveSpacing, bottom: effectiveBottomSpacing };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.container,
        positionStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: effectiveBgColor,
        },
        style,
      ]}
      activeOpacity={0.8}
      testID={testID}
    >
      {settings.launcherIconUrl ? (
        <Image
          source={{ uri: settings.launcherIconUrl }}
          style={{ width: size * 0.5, height: size * 0.5 }}
          resizeMode="contain"
        />
      ) : (
        <MessageIcon color={effectiveIconColor} size={size * 0.4} />
      )}
      {totalUnread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.primaryColor }]}>
          <Text style={[styles.badgeText, { color: theme.textOnPrimary }]}>
            {totalUnread > 99 ? "99+" : totalUnread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MessageIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Text style={{ fontSize: size * 0.8, color, textAlign: "center" }}>💬</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
