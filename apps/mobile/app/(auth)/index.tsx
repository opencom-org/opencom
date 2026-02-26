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
  const hostedBackendUrl = defaultBackendUrl?.trim() ?? "";
  const hasHostedBackendOption = hostedBackendUrl.length > 0;
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

  const handleUseHostedBackend = async () => {
    if (!hasHostedBackendOption) {
      return;
    }

    setUrl(hostedBackendUrl);
    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await connectToBackend(hostedBackendUrl);
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

          {hasHostedBackendOption && (
            <View style={styles.hostedCard}>
              <Text style={styles.hostedTitle}>No custom backend yet?</Text>
              <Text style={styles.hostedDescription}>
                You can start with the default hosted Opencom backend now and switch to your own
                backend later.
              </Text>
              <TouchableOpacity
                style={[styles.hostedButton, isLoading && styles.buttonDisabled]}
                onPress={() => {
                  void handleUseHostedBackend();
                }}
                disabled={isLoading}
              >
                <Text style={styles.hostedButtonText}>Use Opencom Hosted</Text>
              </TouchableOpacity>
              <Text style={styles.hostedUrl} numberOfLines={1}>
                {hostedBackendUrl}
              </Text>
            </View>
          )}

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
  hostedCard: {
    marginTop: 16,
    backgroundColor: "#f9f5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  hostedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5b21b6",
  },
  hostedDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6b21a8",
  },
  hostedButton: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8b4fe",
    paddingVertical: 10,
    alignItems: "center",
  },
  hostedButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b21a8",
  },
  hostedUrl: {
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
