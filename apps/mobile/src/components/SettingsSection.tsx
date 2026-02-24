import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
  style?: ViewStyle;
}

export function SettingsSection({ title, children, style }: SettingsSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
});
