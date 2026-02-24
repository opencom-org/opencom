import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useChecklists, type ChecklistId, type EligibleChecklist } from "../hooks/useChecklists";
import { useMessengerSettings, type OpencomTheme } from "../hooks/useMessengerSettings";

interface OpencomChecklistProps {
  onTaskAction?: (
    checklistId: ChecklistId,
    taskId: string,
    action: { type: string; url?: string }
  ) => void;
  onChecklistComplete?: (checklistId: ChecklistId) => void;
  style?: object;
}

function ChecklistItem({
  checklist,
  onTaskPress,
  onTaskAction,
  theme,
}: {
  checklist: EligibleChecklist;
  onTaskPress: (taskId: string) => void;
  onTaskAction?: (taskId: string, action: { type: string; url?: string }) => void;
  theme: OpencomTheme;
}) {
  const { checklist: data, progress } = checklist;
  const completedCount = progress?.completedTaskIds.length ?? 0;
  const totalCount = data.tasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <View style={[styles.checklistCard, { backgroundColor: theme.surfaceColor }]}>
      <View style={styles.checklistHeader}>
        <Text style={[styles.checklistName, { color: theme.textColor }]}>{data.name}</Text>
        <Text style={[styles.checklistProgress, { color: theme.textMuted }]}>
          {completedCount}/{totalCount}
        </Text>
      </View>

      {data.description && (
        <Text style={[styles.checklistDescription, { color: theme.textMuted }]}>
          {data.description}
        </Text>
      )}

      <View style={[styles.progressBarContainer, { backgroundColor: theme.mutedColor }]}>
        <View
          style={[
            styles.progressBar,
            { width: `${progressPercent}%`, backgroundColor: theme.primaryColor },
          ]}
        />
      </View>

      <View style={styles.taskList}>
        {data.tasks.map((task) => {
          const isCompleted = progress?.completedTaskIds.includes(task.id) ?? false;

          return (
            <TouchableOpacity
              key={task.id}
              style={styles.taskItem}
              onPress={() => {
                if (!isCompleted) {
                  if (task.action) {
                    onTaskAction?.(task.id, task.action);
                    if (task.action.type === "url" && task.action.url) {
                      Linking.openURL(task.action.url);
                    }
                  }
                  if (task.completionType === "manual") {
                    onTaskPress(task.id);
                  }
                }
              }}
              disabled={isCompleted}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.taskCheckbox,
                  { borderColor: theme.borderColor },
                  isCompleted && {
                    backgroundColor: theme.primaryColor,
                    borderColor: theme.primaryColor,
                  },
                ]}
              >
                {isCompleted && (
                  <Text style={[styles.taskCheckmark, { color: theme.textOnPrimary }]}>✓</Text>
                )}
              </View>
              <View style={styles.taskContent}>
                <Text
                  style={[
                    styles.taskTitle,
                    { color: theme.textColor },
                    isCompleted && {
                      color: theme.textMuted,
                      textDecorationLine: "line-through" as const,
                    },
                  ]}
                >
                  {task.title}
                </Text>
                {task.description && (
                  <Text style={[styles.taskDescription, { color: theme.textMuted }]}>
                    {task.description}
                  </Text>
                )}
              </View>
              {task.action && !isCompleted && (
                <Text style={[styles.taskAction, { color: theme.primaryColor }]}>→</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function OpencomChecklist({
  onTaskAction,
  onChecklistComplete,
  style,
}: OpencomChecklistProps) {
  const { theme } = useMessengerSettings();
  const { checklists, isLoading, completeTask, getProgress } = useChecklists();

  const handleTaskPress = async (checklistId: ChecklistId, taskId: string) => {
    await completeTask(checklistId, taskId);

    // Check if checklist is now complete
    const checklist = checklists.find((c) => c.checklist._id === checklistId);
    if (checklist) {
      const progress = getProgress(checklistId);
      const allCompleted = checklist.checklist.tasks.every((t) =>
        progress?.completedTaskIds.includes(t.id)
      );
      if (allCompleted) {
        onChecklistComplete?.(checklistId);
      }
    }
  };

  if (isLoading) {
    return null;
  }

  // Filter out completed checklists
  const activeChecklists = checklists.filter((c) => {
    const progress = c.progress;
    if (!progress) return true;
    return !progress.completedAt;
  });

  if (activeChecklists.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyEmoji}>✅</Text>
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No tasks yet</Text>
        <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>
          Create checklists in the web app to see them here.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {activeChecklists.map((checklist) => (
        <ChecklistItem
          key={checklist.checklist._id}
          checklist={checklist}
          onTaskPress={(taskId) => handleTaskPress(checklist.checklist._id, taskId)}
          onTaskAction={(taskId, action) => onTaskAction?.(checklist.checklist._id, taskId, action)}
          theme={theme}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  checklistCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  checklistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  checklistName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  checklistProgress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  checklistDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  taskList: {
    gap: 8,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 1,
  },
  taskCheckboxCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  taskCheckmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  taskTitleCompleted: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  taskDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  taskAction: {
    fontSize: 16,
    color: "#792cd4",
    fontWeight: "600",
    marginLeft: 8,
  },
});
