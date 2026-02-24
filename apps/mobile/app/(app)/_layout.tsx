import { Redirect, Stack } from "expo-router";
import { useBackend } from "../../src/contexts/BackendContext";
import { NotificationProvider } from "../../src/contexts/NotificationContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";

export default function AppLayout() {
  const { activeBackend, isLoading: backendLoading } = useBackend();

  if (backendLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#792cd4" />
      </View>
    );
  }

  if (!activeBackend) {
    return <Redirect href="/(auth)" />;
  }

  return <AppLayoutContent />;
}

function AppLayoutContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#792cd4" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <NotificationProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Inbox", headerShown: true }} />
        <Stack.Screen name="conversation/[id]" options={{ title: "Conversation" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
