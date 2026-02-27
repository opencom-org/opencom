import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "../../src/contexts/AuthContext";

export default function WorkspaceSelectionScreen() {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    switchWorkspace,
    completeWorkspaceSelection,
  } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<Id<"workspaces"> | null>(
    activeWorkspaceId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const workspaceOptions = useMemo(
    () => [...workspaces].sort((left, right) => left.name.localeCompare(right.name)),
    [workspaces]
  );

  const handleContinue = async () => {
    if (!selectedWorkspaceId) {
      Alert.alert("Select a workspace", "Choose the workspace you want to use in this session.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedWorkspaceId !== activeWorkspaceId) {
        await switchWorkspace(selectedWorkspaceId);
      }
      await completeWorkspaceSelection();
    } catch (error) {
      Alert.alert("Unable to continue", error instanceof Error ? error.message : "Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Choose your workspace</Text>
      <Text style={styles.subtitle}>
        You belong to multiple workspaces. Pick one to continue. You can switch anytime from
        Settings.
      </Text>

      <View style={styles.card}>
        {workspaceOptions.map((workspace, index) => {
          const isSelected = workspace._id === selectedWorkspaceId;
          return (
            <View key={workspace._id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <TouchableOpacity
                style={styles.optionRow}
                disabled={isSubmitting}
                onPress={() => setSelectedWorkspaceId(workspace._id)}
              >
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionName}>{workspace.name}</Text>
                  <Text style={styles.optionRole}>{workspace.role}</Text>
                </View>
                <View style={[styles.optionIndicator, isSelected && styles.optionIndicatorActive]}>
                  {isSelected ? <View style={styles.optionIndicatorDot} /> : null}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
        onPress={() => {
          void handleContinue();
        }}
        disabled={isSubmitting}
      >
        <Text style={styles.primaryButtonText}>{isSubmitting ? "Saving..." : "Continue"}</Text>
      </TouchableOpacity>

      {activeWorkspace ? (
        <Text style={styles.helperText}>Current default: {activeWorkspace.name}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionTextWrap: {
    flex: 1,
    gap: 4,
  },
  optionName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  optionRole: {
    fontSize: 13,
    color: "#6b7280",
    textTransform: "capitalize",
  },
  optionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIndicatorActive: {
    borderColor: "#792cd4",
  },
  optionIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#792cd4",
  },
  divider: {
    height: 1,
    backgroundColor: "#ececec",
    marginLeft: 14,
  },
  primaryButton: {
    backgroundColor: "#792cd4",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
