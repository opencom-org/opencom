import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { BackendProvider, useBackend } from "../src/contexts/BackendContext";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useMemo, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const asyncStorageAdapter = {
  getItem: async (key: string) => {
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

function AuthNavigationGuard({ children }: { children: React.ReactNode }) {
  const {
    isAuthenticated,
    isLoading: authLoading,
    defaultHomePath,
    isHomeRouteLoading,
  } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (authLoading || isHomeRouteLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onBackendScreen = inAuthGroup && segments.length <= 1;
    const inAppGroup = segments[0] === "(app)";
    const onAppRoot = inAppGroup && segments.length === 1;
    const currentAppRoute = (segments[1] ?? "") as string;
    const onWorkspaceRoute = inAppGroup && currentAppRoute === "workspace";
    const onOnboardingRoute = inAppGroup && currentAppRoute === "onboarding";
    const onHomeEntryRoute = inAppGroup && (onAppRoot || currentAppRoute === "index");

    const homeRoute =
      defaultHomePath === "/workspace"
        ? "/workspace"
        : defaultHomePath === "/onboarding"
          ? "/onboarding"
          : "/inbox";

    if (isAuthenticated && inAuthGroup && !onBackendScreen) {
      // User is authenticated but on login/signup screen - redirect to home.
      router.replace(homeRoute as never);
    } else if (isAuthenticated && defaultHomePath === "/workspace" && !onWorkspaceRoute) {
      // If a first-time user has multiple workspaces, force explicit workspace choice first.
      router.replace("/workspace" as never);
    } else if (
      isAuthenticated &&
      defaultHomePath === "/onboarding" &&
      onHomeEntryRoute &&
      !onOnboardingRoute
    ) {
      // Keep onboarding as the app entry point until widget verification completes.
      router.replace("/onboarding" as never);
    } else if (isAuthenticated && defaultHomePath !== "/workspace" && onWorkspaceRoute) {
      // Workspace selection is complete; route to the new default home.
      router.replace(homeRoute as never);
    } else if (!isAuthenticated && !inAuthGroup) {
      // User is not authenticated and trying to access app - redirect to login
      router.replace("/(auth)/login");
    }
  }, [authLoading, defaultHomePath, isAuthenticated, isHomeRouteLoading, segments]);

  return <>{children}</>;
}

function AppContent() {
  const { convexUrl, isLoading: backendLoading, activeBackend } = useBackend();
  const segments = useSegments();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  const convex = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  useEffect(() => {
    if (backendLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onBackendScreen = inAuthGroup && segments.length <= 1;

    if (!activeBackend && !onBackendScreen) {
      router.replace("/(auth)");
    }

    setIsNavigationReady(true);
  }, [backendLoading, activeBackend, segments]);

  if (backendLoading || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#792cd4" />
      </View>
    );
  }

  const content = (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );

  if (!convex) {
    return content;
  }

  return (
    <ConvexAuthProvider client={convex} storage={asyncStorageAdapter}>
      <AuthProvider>
        <AuthNavigationGuard>{content}</AuthNavigationGuard>
      </AuthProvider>
    </ConvexAuthProvider>
  );
}

export default function RootLayout() {
  return (
    <BackendProvider>
      <AppContent />
    </BackendProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
