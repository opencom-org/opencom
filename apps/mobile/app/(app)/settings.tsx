import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useBackend } from "../../src/contexts/BackendContext";
import { useNotifications } from "../../src/contexts/NotificationContext";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@opencom/convex";
import { useEffect, useState } from "react";
import type { Id } from "@opencom/convex/dataModel";

export default function SettingsScreen() {
  const { user, logout, workspaces, activeWorkspace, activeWorkspaceId, switchWorkspace } =
    useAuth();
  const { activeBackend, clearBackend } = useBackend();
  const {
    expoPushToken,
    registrationStatus,
    lastError: pushRegistrationError,
  } = useNotifications();
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [isInviting, setIsInviting] = useState(false);
  const [signupMode, setSignupMode] = useState<"invite-only" | "domain-allowlist">("invite-only");
  const [allowedDomains, setAllowedDomains] = useState("");
  const [isSavingSignup, setIsSavingSignup] = useState(false);
  const [signupModalVisible, setSignupModalVisible] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<Id<"workspaces"> | null>(null);
  const myNotificationPreferences = useQuery(
    api.notificationSettings.getMyPreferences,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip"
  );

  const workspace = useQuery(
    api.workspaces.get,
    activeWorkspaceId ? { id: activeWorkspaceId } : "skip"
  );

  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip"
  );
  const pushTokens = useQuery(
    api.pushTokens.getByUser,
    user?._id ? { userId: user._id as Id<"users"> } : "skip"
  );

  const updateAllowedOrigins = useMutation(api.workspaces.updateAllowedOrigins);
  const inviteToWorkspace = useAction(api.workspaceMembers.inviteToWorkspace);
  const updateRole = useMutation(api.workspaceMembers.updateRole);
  const removeMember = useMutation(api.workspaceMembers.remove);
  const updateSignupSettings = useMutation(api.workspaces.updateSignupSettings);
  const updateMyNotificationPreferences = useMutation(api.notificationSettings.updateMyPreferences);

  const isAdmin = activeWorkspace?.role === "admin" || activeWorkspace?.role === "owner";

  useEffect(() => {
    if (myNotificationPreferences) {
      setNotificationsMuted(myNotificationPreferences.muted);
    }
  }, [myNotificationPreferences]);

  const handleSaveSignupSettings = async () => {
    if (!activeWorkspaceId) return;
    setIsSavingSignup(true);
    try {
      const domains = allowedDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      await updateSignupSettings({
        workspaceId: activeWorkspaceId,
        signupMode,
        allowedDomains: signupMode === "domain-allowlist" ? domains : [],
      });
      Alert.alert("Success", "Signup settings saved!");
      setSignupModalVisible(false);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save signup settings");
    } finally {
      setIsSavingSignup(false);
    }
  };

  const handleAddOrigin = async () => {
    if (!newOrigin.trim() || !activeWorkspaceId) return;
    const currentOrigins = workspace?.allowedOrigins || [];
    if (currentOrigins.includes(newOrigin.trim())) {
      Alert.alert("Already exists", "This origin is already in the list.");
      return;
    }
    try {
      await updateAllowedOrigins({
        workspaceId: activeWorkspaceId,
        allowedOrigins: [...currentOrigins, newOrigin.trim()],
      });
      setNewOrigin("");
    } catch (error) {
      console.error("Failed to add origin:", error);
      Alert.alert("Error", "Failed to add origin.");
    }
  };

  const handleRemoveOrigin = (origin: string) => {
    if (!activeWorkspaceId) return;
    Alert.alert("Remove Origin", `Remove ${origin} from allowed origins?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const currentOrigins = workspace?.allowedOrigins || [];
          try {
            await updateAllowedOrigins({
              workspaceId: activeWorkspaceId,
              allowedOrigins: currentOrigins.filter((o: string) => o !== origin),
            });
          } catch (error) {
            console.error("Failed to remove origin:", error);
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch (error) {
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  const handleChangeBackend = () => {
    Alert.alert(
      "Change Backend",
      "This will log you out and return to the backend selection screen. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Backend",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              await clearBackend();
              router.replace("/(auth)");
            } catch (error) {
              console.error("Change backend error:", error);
            }
          },
        },
      ]
    );
  };

  const handleOpenOnboardingGuide = () => {
    router.push("/(app)/onboarding" as never);
  };

  const handleInvite = async () => {
    if (
      // !token ||
      !activeWorkspaceId ||
      !inviteEmail.trim()
    )
      return;

    setIsInviting(true);
    try {
      const result = await inviteToWorkspace({
        // token,
        workspaceId: activeWorkspaceId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        baseUrl: "https://app.opencom.app",
      });

      if (result.status === "added") {
        Alert.alert("Success", "User added to workspace!");
      } else {
        Alert.alert("Success", "Invitation sent!");
      }
      setInviteEmail("");
      setInviteRole("agent");
      setInviteModalVisible(false);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId: Id<"workspaces">) => {
    if (workspaceId === activeWorkspaceId || isSwitchingWorkspace) {
      return;
    }

    setIsSwitchingWorkspace(true);
    setPendingWorkspaceId(workspaceId);
    try {
      await switchWorkspace(workspaceId);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to switch workspace");
    } finally {
      setPendingWorkspaceId(null);
      setIsSwitchingWorkspace(false);
    }
  };

  const handleRoleChange = (
    membershipId: Id<"workspaceMembers">,
    memberName: string,
    currentRole: "admin" | "agent" | "owner" | "viewer"
  ) => {
    // if (!token) return;

    Alert.alert("Change Role", `Change ${memberName}'s role?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: currentRole === "admin" ? "Make Agent" : "Make Admin",
        onPress: async () => {
          try {
            await updateRole({
              // token,
              membershipId,
              role: currentRole === "admin" ? "agent" : "admin",
            });
          } catch (error) {
            Alert.alert("Error", error instanceof Error ? error.message : "Failed to update role");
          }
        },
      },
    ]);
  };

  const handleToggleNotificationsMuted = async (nextValue: boolean) => {
    if (!activeWorkspaceId) {
      setNotificationsMuted(nextValue);
      return;
    }

    setNotificationsMuted(nextValue);
    try {
      await updateMyNotificationPreferences({
        workspaceId: activeWorkspaceId,
        muted: nextValue,
      });
    } catch (error) {
      setNotificationsMuted(!nextValue);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Failed to update notification preference"
      );
    }
  };

  const handleRemoveMember = (membershipId: Id<"workspaceMembers">, memberName: string) => {
    // if (!token) return;

    Alert.alert("Remove Member", `Remove ${memberName} from this workspace?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMember({
              //token,
              membershipId,
            });
          } catch (error) {
            Alert.alert(
              "Error",
              error instanceof Error ? error.message : "Failed to remove member"
            );
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user?.name || "Not set"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Role</Text>
            <Text style={styles.value}>{activeWorkspace?.role ?? user?.role}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Mute all notifications</Text>
            <Switch
              value={notificationsMuted}
              onValueChange={(value) => {
                void handleToggleNotificationsMuted(value);
              }}
              trackColor={{ false: "#e5e5e5", true: "#792cd4" }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Push registration</Text>
            <Text style={styles.value}>{registrationStatus}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Registered tokens</Text>
            <Text style={styles.value}>{pushTokens ? String(pushTokens.length) : "..."}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Expo token</Text>
            <Text style={styles.value} numberOfLines={1}>
              {expoPushToken ? `${expoPushToken.slice(0, 24)}...` : "Not available"}
            </Text>
          </View>
          {pushRegistrationError ? (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Push error</Text>
                <Text style={styles.value} numberOfLines={2}>
                  {pushRegistrationError}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workspace</Text>
        <View style={styles.card}>
          {workspaces.length > 0 && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{activeWorkspace?.name ?? "Unavailable"}</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              if (activeWorkspaceId) {
                await Clipboard.setStringAsync(activeWorkspaceId);
                Alert.alert(
                  "Copied!",
                  "Workspace ID copied to clipboard.\n\nUse this in your widget configuration."
                );
              }
            }}
          >
            <View style={styles.workspaceIdContainer}>
              <Text style={styles.label}>Workspace ID</Text>
              <Text style={styles.workspaceIdHint}>Tap to copy for widget setup</Text>
            </View>
            <Text style={styles.workspaceIdValue} numberOfLines={1}>
              {activeWorkspaceId ? `${activeWorkspaceId.slice(0, 8)}...` : "N/A"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {workspaces.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workspace Switcher</Text>
          <View style={styles.card}>
            {workspaces.map((workspaceOption, index) => (
              <View key={workspaceOption._id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => void handleSwitchWorkspace(workspaceOption._id)}
                  disabled={isSwitchingWorkspace || workspaceOption._id === activeWorkspaceId}
                >
                  <Text style={styles.label}>{workspaceOption.name}</Text>
                  <Text
                    style={[
                      styles.workspaceStatusText,
                      workspaceOption._id === activeWorkspaceId && styles.workspaceStatusTextActive,
                    ]}
                  >
                    {workspaceOption._id === activeWorkspaceId
                      ? "Active"
                      : pendingWorkspaceId === workspaceOption._id
                        ? "Switching..."
                        : "Switch"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allowed Origins</Text>
        <Text style={styles.sectionHint}>
          Restrict which websites can use your widget. Leave empty to allow all.
        </Text>
        <View style={styles.card}>
          {workspace?.allowedOrigins && workspace.allowedOrigins.length > 0 ? (
            workspace.allowedOrigins.map((origin, index) => (
              <View key={origin}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.originRow}>
                  <Text style={styles.originText} numberOfLines={1}>
                    {origin}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveOrigin(origin)}>
                    <Text style={styles.removeOriginText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.row}>
              <Text style={styles.emptyText}>No restrictions (all origins allowed)</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.addOriginRow}>
            <TextInput
              style={styles.originInput}
              value={newOrigin}
              onChangeText={setNewOrigin}
              placeholder="https://example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity style={styles.addButton} onPress={handleAddOrigin}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team Members</Text>
        <View style={styles.card}>
          {members && members.length > 0 ? (
            members.map((member, index) => (
              <View key={member._id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name || member.email}</Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={[styles.roleBadge, member.role === "admin" && styles.adminBadge]}
                      onPress={() =>
                        isAdmin &&
                        member.userId !== user?._id &&
                        handleRoleChange(
                          member._id,
                          (member.name || member.email) ?? "",
                          member.role
                        )
                      }
                      disabled={!isAdmin || member.userId === user?._id}
                    >
                      <Text style={[styles.roleText, member.role === "admin" && styles.adminText]}>
                        {member.role}
                      </Text>
                    </TouchableOpacity>
                    {isAdmin && member.userId !== user?._id && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() =>
                          handleRemoveMember(member._id, (member.name || member.email) ?? "")
                        }
                      >
                        <Text style={styles.removeButtonText}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.row}>
              <Text style={styles.emptyText}>No team members</Text>
            </View>
          )}
          {isAdmin && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.inviteRow}
                onPress={() => setInviteModalVisible(true)}
              >
                <Text style={styles.inviteButtonText}>+ Invite Team Member</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite Team Member</Text>
            <TextInput
              style={styles.modalInput}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="colleague@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === "agent" && styles.roleOptionSelected]}
                onPress={() => setInviteRole("agent")}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    inviteRole === "agent" && styles.roleOptionTextSelected,
                  ]}
                >
                  Agent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, inviteRole === "admin" && styles.roleOptionSelected]}
                onPress={() => setInviteRole("admin")}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    inviteRole === "admin" && styles.roleOptionTextSelected,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setInviteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalInviteButton, isInviting && styles.modalButtonDisabled]}
                onPress={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}
              >
                <Text style={styles.modalInviteText}>
                  {isInviting ? "Sending..." : "Send Invite"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signup Settings Modal */}
      <Modal
        visible={signupModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSignupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Signup Settings</Text>
            <Text style={styles.sectionHint}>Control how new users can join this workspace.</Text>

            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  signupMode === "invite-only" && styles.roleOptionSelected,
                ]}
                onPress={() => setSignupMode("invite-only")}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    signupMode === "invite-only" && styles.roleOptionTextSelected,
                  ]}
                >
                  Invite Only
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  signupMode === "domain-allowlist" && styles.roleOptionSelected,
                ]}
                onPress={() => setSignupMode("domain-allowlist")}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    signupMode === "domain-allowlist" && styles.roleOptionTextSelected,
                  ]}
                >
                  Domain Allowlist
                </Text>
              </TouchableOpacity>
            </View>

            {signupMode === "domain-allowlist" && (
              <TextInput
                style={styles.modalInput}
                value={allowedDomains}
                onChangeText={setAllowedDomains}
                placeholder="example.com, company.org"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setSignupModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalInviteButton, isSavingSignup && styles.modalButtonDisabled]}
                onPress={handleSaveSignupSettings}
                disabled={isSavingSignup}
              >
                <Text style={styles.modalInviteText}>{isSavingSignup ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Signup Settings Section - Admin Only */}
      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signup Settings</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Signup Mode</Text>
              <Text style={styles.value}>
                {workspace?.signupMode === "domain-allowlist" ? "Domain Allowlist" : "Invite Only"}
              </Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.inviteRow}
              onPress={() => {
                setSignupMode(workspace?.signupMode ?? "invite-only");
                setAllowedDomains((workspace?.allowedDomains ?? []).join(", "));
                setSignupModalVisible(true);
              }}
            >
              <Text style={styles.inviteButtonText}>Configure Signup Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Onboarding</Text>
        <Text style={styles.sectionHint}>
          Revisit install instructions and verification for this workspace.
        </Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleOpenOnboardingGuide}>
            <Text style={styles.onboardingGuideText}>Open onboarding guide</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Connected to</Text>
            <Text style={styles.value} numberOfLines={1}>
              {activeBackend?.name ?? "Unknown"}
            </Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleChangeBackend}>
            <Text style={styles.changeBackendText}>Change Backend</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Opencom v0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: 13,
    color: "#888",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e5e5",
    marginLeft: 16,
  },
  label: {
    fontSize: 16,
    color: "#333",
  },
  value: {
    fontSize: 16,
    color: "#666",
  },
  workspaceIdContainer: {
    flex: 1,
  },
  workspaceIdHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  workspaceIdValue: {
    fontSize: 14,
    color: "#792cd4",
    fontFamily: "monospace",
    maxWidth: 100,
  },
  workspaceStatusText: {
    fontSize: 14,
    color: "#792cd4",
    fontWeight: "500",
  },
  workspaceStatusTextActive: {
    color: "#15803d",
  },
  logoutButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 16,
  },
  footerText: {
    color: "#999",
    fontSize: 14,
  },
  originRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  originText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    fontFamily: "monospace",
  },
  removeButton: {
    padding: 4,
  },
  removeOriginText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
  },
  addOriginRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  originInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: "#792cd4",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  memberEmail: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  memberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#e5e5e5",
  },
  adminBadge: {
    backgroundColor: "#dbeafe",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
  },
  adminText: {
    color: "#792cd4",
  },
  removeButtonText: {
    color: "#ef4444",
    fontSize: 20,
    fontWeight: "600",
  },
  inviteRow: {
    padding: 16,
    alignItems: "center",
  },
  inviteButtonText: {
    color: "#792cd4",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  roleOption: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    alignItems: "center",
  },
  roleOptionSelected: {
    borderColor: "#792cd4",
    backgroundColor: "#dbeafe",
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  roleOptionTextSelected: {
    color: "#792cd4",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  modalInviteButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#792cd4",
    alignItems: "center",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalInviteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  changeBackendText: {
    color: "#792cd4",
    fontSize: 16,
    fontWeight: "500",
  },
  onboardingGuideText: {
    color: "#792cd4",
    fontSize: 16,
    fontWeight: "500",
  },
});
