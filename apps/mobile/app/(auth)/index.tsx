import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { useBackend } from "../../src/contexts/BackendContext";
import type { StoredBackend } from "@opencom/types";
import { createSubmitLock, runWithSubmitLock } from "../../src/utils/submitLock";

const INPUT_TEXT_COLOR = "#111827";
const INPUT_PLACEHOLDER_COLOR = "#9ca3af";

export default function BackendSelectionScreen() {
  const { recentBackends, selectBackend, defaultBackendUrl } = useBackend();
  const configuredDefaultBackendUrl = defaultBackendUrl?.trim() ?? "";
  const hasDefaultBackendOption = configuredDefaultBackendUrl.length > 0;
  const [url, setUrl] = useState(defaultBackendUrl ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const submitLockRef = useRef(createSubmitLock());

  const connectToBackend = async (backendUrl: string) => {
    const result = await selectBackend(backendUrl);
    if (result.success) {
      router.replace("/(auth)/login");
      return;
    }

    Alert.alert("Connection Failed", result.error ?? "Could not connect to backend");
  };

  const handleConnect = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      Alert.alert("Error", "Please enter a backend URL");
      return;
    }

    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await connectToBackend(trimmedUrl);
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleSelectRecent = async (backend: StoredBackend) => {
    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await connectToBackend(backend.url);
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleUseDefaultBackend = async () => {
    if (!hasDefaultBackendOption) {
      return;
    }

    setUrl(configuredDefaultBackendUrl);
    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await connectToBackend(configuredDefaultBackendUrl);
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const renderRecentBackend = ({ item }: { item: StoredBackend }) => (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => handleSelectRecent(item)}
      disabled={isLoading}
    >
      <Text style={styles.recentName}>{item.name}</Text>
      <Text style={styles.recentUrl}>{item.url}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Opencom</Text>
        <Text style={styles.subtitle}>Connect to your workspace</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://your-instance.convex.cloud"
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => {
              void handleConnect();
            }}
          />
          <Text style={styles.helpText}>Enter the URL of your Opencom backend server</Text>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>

        {hasDefaultBackendOption && (
          <View style={styles.defaultBackendSection}>
            <TouchableOpacity
              style={[styles.defaultBackendButton, isLoading && styles.buttonDisabled]}
              onPress={() => {
                void handleUseDefaultBackend();
              }}
              disabled={isLoading}
            >
              <Text style={styles.defaultBackendButtonText}>Use Default Backend</Text>
              <Text style={styles.defaultBackendUrl} numberOfLines={1}>
                {configuredDefaultBackendUrl}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {recentBackends.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent Backends</Text>
            <FlatList
              data={recentBackends}
              renderItem={renderRecentBackend}
              keyExtractor={(item) => item.url}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: INPUT_TEXT_COLOR,
  },
  helpText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  defaultBackendSection: {
    marginTop: 24,
  },
  defaultBackendButton: {
    backgroundColor: "#f9f5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  defaultBackendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5b21b6",
  },
  defaultBackendUrl: {
    fontSize: 11,
    color: "#7c3aed",
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: "#792cd4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  recentSection: {
    marginTop: 32,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  recentItem: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  recentName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  recentUrl: {
    fontSize: 12,
    color: "#666",
  },
});
