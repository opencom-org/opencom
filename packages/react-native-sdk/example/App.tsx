/**
 * Opencom SDK Example App
 *
 * This example demonstrates the simplified `<Opencom />` component that provides
 * a full-featured messenger experience with minimal setup.
 *
 * The Opencom component handles:
 * - Launcher button (floating action button)
 * - Full messenger UI with tabs (Messages, Help, Tickets, Tasks)
 * - User identification (via props or email capture prompt)
 * - Outbound messages
 * - Deep linking
 */
import React, { useRef, useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, TextInput } from "react-native";
import Constants from "expo-constants";
import { Opencom, type OpencomRef, type OpencomUser } from "@opencom/react-native-sdk";

// Configuration from environment variables
const config = {
  workspaceId:
    Constants.expoConfig?.extra?.workspaceId ?? process.env.EXPO_PUBLIC_WORKSPACE_ID ?? "",
  convexUrl: Constants.expoConfig?.extra?.convexUrl ?? process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
};

export default function App() {
  // Ref for imperative control of the messenger
  const opencomRef = useRef<OpencomRef>(null);

  // User state (in a real app, this would come from your auth system)
  const [user, setUser] = useState<OpencomUser | undefined>(undefined);
  const [emailInput, setEmailInput] = useState("");

  // Handle user login
  const handleLogin = () => {
    if (emailInput.trim()) {
      setUser({ email: emailInput.trim() });
      setEmailInput("");
    }
  };

  // Handle user logout
  const handleLogout = async () => {
    await opencomRef.current?.logout();
    setUser(undefined);
  };

  // Validate configuration
  if (!config.workspaceId || !config.convexUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Missing Configuration</Text>
          <Text style={styles.errorText}>
            Please set EXPO_PUBLIC_WORKSPACE_ID and EXPO_PUBLIC_CONVEX_URL
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Opencom
      ref={opencomRef}
      config={config}
      user={user}
      // Optional: HMAC for secure identity verification
      // userHash="your-hmac-hash"
      enableMessages={true}
      enableHelpCenter={true}
      enableTickets={true}
      enableChecklists={true}
      onOpen={() => console.log("Messenger opened")}
      onClose={() => console.log("Messenger closed")}
      onUserIdentified={(u) => console.log("User identified:", u.email)}
    >
      {/* Your app content goes here */}
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Your App</Text>
          <Text style={styles.subtitle}>Tap the chat button to open Opencom</Text>

          {/* User identification section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>User Identification</Text>
            {user ? (
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{user.email}</Text>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.loginForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter email to identify"
                  placeholderTextColor="#999"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                  <Text style={styles.loginButtonText}>Identify User</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Imperative API demo */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Imperative API</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={() => opencomRef.current?.present()}
              >
                <Text style={styles.apiButtonText}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={() => opencomRef.current?.presentHelpCenter()}
              >
                <Text style={styles.apiButtonText}>Help</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.apiButton}
                onPress={() => opencomRef.current?.presentTickets()}
              >
                <Text style={styles.apiButtonText}>Tickets</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Opencom>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loginForm: {
    gap: 12,
  },
  input: {
    height: 44,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  loginButton: {
    height: 44,
    backgroundColor: "#792cd4",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  userInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userEmail: {
    fontSize: 16,
    color: "#1F2937",
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
  },
  logoutButtonText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  apiButton: {
    flex: 1,
    height: 40,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  apiButtonText: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#DC2626",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
