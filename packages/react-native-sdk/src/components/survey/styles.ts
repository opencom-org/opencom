import { StyleSheet } from "react-native";

export const surveyStyles = StyleSheet.create({
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
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  dismissText: {
    color: "#374151",
    fontSize: 18,
  },
  progressContainer: {
    height: 4,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 24,
    marginTop: 60,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  stepContainer: {
    alignItems: "center",
  },
  thankYouContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  questionHeader: {
    width: "100%",
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  questionDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  required: {
    color: "#EF4444",
  },
  questionContent: {
    width: "100%",
    marginBottom: 32,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scaleContainer: {
    width: "100%",
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  scaleLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  scaleButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  scaleButton: {
    minWidth: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  scaleButtonText: {
    fontSize: 14,
    color: "#374151",
  },
  scaleButtonTextSelected: {
    color: "#FFFFFF",
  },
  starsContainer: {
    width: "100%",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  starIcon: {
    fontSize: 36,
  },
  emojiContainer: {
    width: "100%",
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  emojiButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  emoji: {
    fontSize: 32,
  },
  choicesContainer: {
    width: "100%",
    gap: 8,
  },
  choiceButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  choiceIndicator: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radio: {
    borderRadius: 10,
  },
  checkbox: {
    borderRadius: 4,
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  choiceText: {
    fontSize: 14,
    color: "#374151",
  },
  textContainer: {
    width: "100%",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
});
