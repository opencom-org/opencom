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
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useBackend } from "../../src/contexts/BackendContext";
import { getAuthRoute } from "../../src/utils/authNavigation";
import { createSubmitLock, runWithSubmitLock } from "../../src/utils/submitLock";

type AuthMode = "password" | "otp";
const INPUT_TEXT_COLOR = "#111827";
const INPUT_PLACEHOLDER_COLOR = "#9ca3af";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const submitLockRef = useRef(createSubmitLock());
  const { signup, sendOTPCode, loginWithOTP, completeSignupProfile } = useAuth();
  const { activeBackend } = useBackend();

  const handlePasswordSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedWorkspaceName = workspaceName.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await signup(
          trimmedEmail,
          password,
          trimmedName,
          trimmedWorkspaceName.length > 0 ? trimmedWorkspaceName : undefined
        );
      } catch (error) {
        Alert.alert("Signup Failed", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleSendOTPForSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail) {
      Alert.alert("Error", "Please enter name and email");
      return;
    }

    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await sendOTPCode(trimmedEmail);
        setOtpSent(true);
        Alert.alert("Code Sent", "Check your email for the sign-up code");
      } catch (error) {
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to send code");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleOTPVerifySignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedOtpCode = otpCode.trim();

    if (!trimmedName || !trimmedEmail || !trimmedOtpCode) {
      Alert.alert("Error", "Please enter name, email, and verification code");
      return;
    }

    await runWithSubmitLock(submitLockRef.current, async () => {
      setIsLoading(true);
      try {
        await loginWithOTP(trimmedEmail, trimmedOtpCode);
        await completeSignupProfile(trimmedName, workspaceName);
      } catch (error) {
        Alert.alert("Signup Failed", error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setOtpSent(false);
    setOtpCode("");
    setPassword("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Opencom</Text>
          <Text style={styles.subtitle}>Create your account</Text>

          <View style={styles.authModeToggle}>
            <TouchableOpacity
              style={[
                styles.authModeButton,
                authMode === "password" && styles.authModeButtonActive,
              ]}
              onPress={() => switchAuthMode("password")}
            >
              <Text
                style={[styles.authModeText, authMode === "password" && styles.authModeTextActive]}
              >
                Password
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authModeButton, authMode === "otp" && styles.authModeButtonActive]}
              onPress={() => switchAuthMode("otp")}
            >
              <Text style={[styles.authModeText, authMode === "otp" && styles.authModeTextActive]}>
                Email Code
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Your name *"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              returnKeyType="next"
            />

            <TextInput
              style={styles.input}
              placeholder="Email *"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType={authMode === "password" ? "next" : otpSent ? "next" : "send"}
              onSubmitEditing={() => {
                if (authMode === "otp" && !otpSent) {
                  void handleSendOTPForSignup();
                }
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Workspace name (optional)"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              value={workspaceName}
              onChangeText={setWorkspaceName}
              returnKeyType={authMode === "password" ? "next" : otpSent ? "next" : "send"}
              onSubmitEditing={() => {
                if (authMode === "otp" && !otpSent) {
                  void handleSendOTPForSignup();
                }
              }}
            />

            {authMode === "password" ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Password *"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    void handlePasswordSignup();
                  }}
                />

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handlePasswordSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {otpSent && (
                  <TextInput
                    style={styles.input}
                    placeholder="Enter verification code"
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    returnKeyType="go"
                    onSubmitEditing={() => {
                      void handleOTPVerifySignup();
                    }}
                  />
                )}

                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={otpSent ? handleOTPVerifySignup : handleSendOTPForSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {otpSent ? "Verify & Create Account" : "Send Code"}
                    </Text>
                  )}
                </TouchableOpacity>

                {otpSent && (
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendOTPForSignup}
                    disabled={isLoading}
                  >
                    <Text style={styles.resendText}>Resend Code</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push(getAuthRoute("login"))}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.changeBackendButton}
            onPress={() => router.replace("/(auth)")}
          >
            <Text style={styles.changeBackendText}>
              Connected to: {activeBackend?.name ?? "Unknown"}
            </Text>
            <Text style={styles.changeBackendLink}>Change Backend</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
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
  authModeToggle: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  authModeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  authModeButtonActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  authModeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  authModeTextActive: {
    color: "#792cd4",
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: INPUT_TEXT_COLOR,
  },
  button: {
    backgroundColor: "#792cd4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  resendText: {
    color: "#792cd4",
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#666",
  },
  linkText: {
    color: "#792cd4",
    fontWeight: "600",
  },
  changeBackendButton: {
    marginTop: 32,
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  changeBackendText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  changeBackendLink: {
    fontSize: 14,
    color: "#792cd4",
    fontWeight: "500",
  },
});
