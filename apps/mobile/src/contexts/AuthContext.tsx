import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { useBackend } from "./BackendContext";
import { parseStoredWorkspaceId, resolveActiveWorkspaceId } from "../utils/workspaceSelection";

interface User {
  _id: Id<"users">;
  email: string;
  name?: string;
  workspaceId: Id<"workspaces">;
  role: "owner" | "admin" | "agent" | "viewer";
  avatarUrl?: string;
}

interface Workspace {
  _id: Id<"workspaces">;
  name: string;
  role: "owner" | "admin" | "agent" | "viewer";
  allowedOrigins?: string[];
}

type HomePath = "/workspace" | "/onboarding" | "/inbox";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  defaultHomePath: HomePath;
  requiresWorkspaceSelection: boolean;
  isHomeRouteLoading: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: Id<"workspaces"> | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithOTP: (email: string, code: string) => Promise<void>;
  sendOTPCode: (email: string) => Promise<void>;
  signup: (email: string, password: string, name: string, workspaceName?: string) => Promise<void>;
  completeSignupProfile: (name: string, workspaceName?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: Id<"workspaces">) => Promise<void>;
  completeWorkspaceSelection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const ACTIVE_WORKSPACE_STORAGE_PREFIX = "opencom_mobile_active_workspace";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { activeBackend } = useBackend();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<Id<"workspaces"> | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [requiresWorkspaceSelection, setRequiresWorkspaceSelection] = useState(false);

  // Convex Auth hooks
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();

  // Query current user from Convex Auth session
  const convexAuthUser = useQuery(api.auth.currentUser);
  const switchWorkspaceMutation = useMutation(api.auth.switchWorkspace);
  const completeSignupProfileMutation = useMutation(api.auth.completeSignupProfile);
  const unregisterAllPushTokensMutation = useMutation(api.pushTokens.unregisterAllForCurrentUser);

  // Derive state from query
  const user = useMemo(() => (convexAuthUser?.user as User | null) ?? null, [convexAuthUser]);
  const workspaces = useMemo(
    () => (convexAuthUser?.workspaces as Workspace[] | undefined) ?? [],
    [convexAuthUser]
  );
  const workspaceIds = useMemo(() => workspaces.map((workspace) => workspace._id), [workspaces]);
  const workspaceIdsKey = useMemo(() => workspaceIds.join(","), [workspaceIds]);
  const workspaceStorageKey = useMemo(() => {
    if (!user?._id) {
      return null;
    }
    const backendScope = activeBackend?.url ?? "default";
    return `${ACTIVE_WORKSPACE_STORAGE_PREFIX}:${backendScope}:${user._id}`;
  }, [activeBackend?.url, user?._id]);

  useEffect(() => {
    let cancelled = false;

    const hydrateActiveWorkspace = async () => {
      if (!user || workspaceIds.length === 0) {
        setActiveWorkspaceId(null);
        setRequiresWorkspaceSelection(false);
        setIsWorkspaceLoading(false);
        return;
      }

      setIsWorkspaceLoading(true);
      try {
        const storedWorkspaceId = parseStoredWorkspaceId(
          workspaceStorageKey ? await AsyncStorage.getItem(workspaceStorageKey) : null
        );
        const resolvedWorkspaceId = resolveActiveWorkspaceId({
          storedWorkspaceId,
          userWorkspaceId: user.workspaceId,
          availableWorkspaceIds: workspaceIds,
        });
        const shouldPromptWorkspaceSelection = !storedWorkspaceId && workspaceIds.length > 1;

        if (cancelled) {
          return;
        }

        setActiveWorkspaceId(resolvedWorkspaceId);
        setRequiresWorkspaceSelection(shouldPromptWorkspaceSelection);
        if (workspaceStorageKey) {
          if (resolvedWorkspaceId) {
            await AsyncStorage.setItem(workspaceStorageKey, resolvedWorkspaceId);
          } else {
            await AsyncStorage.removeItem(workspaceStorageKey);
          }
        }
      } catch (error) {
        console.error("Failed to restore active workspace", error);
        const fallbackWorkspaceId = resolveActiveWorkspaceId({
          storedWorkspaceId: null,
          userWorkspaceId: user.workspaceId,
          availableWorkspaceIds: workspaceIds,
        });
        if (cancelled) {
          return;
        }
        setActiveWorkspaceId(fallbackWorkspaceId);
        setRequiresWorkspaceSelection(workspaceIds.length > 1);
      } finally {
        if (!cancelled) {
          setIsWorkspaceLoading(false);
        }
      }
    };

    if (convexAuthUser === undefined) {
      return () => {
        cancelled = true;
      };
    }

    void hydrateActiveWorkspace();

    return () => {
      cancelled = true;
    };
  }, [convexAuthUser, user, workspaceIds, workspaceIdsKey, workspaceStorageKey]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace._id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const workspaceIdForHomeRouting = activeWorkspace?._id ?? user?.workspaceId ?? null;
  const isAuthenticated = !!user;
  const shouldRequireWorkspaceSelection = requiresWorkspaceSelection && workspaces.length > 1;
  const shouldResolveHostedOnboarding =
    isAuthenticated && !!workspaceIdForHomeRouting && !shouldRequireWorkspaceSelection;
  const hostedOnboardingState = useQuery(
    api.workspaces.getHostedOnboardingState,
    shouldResolveHostedOnboarding && workspaceIdForHomeRouting
      ? { workspaceId: workspaceIdForHomeRouting }
      : "skip"
  );
  const isHomeRouteLoading = shouldResolveHostedOnboarding && hostedOnboardingState === undefined;
  const defaultHomePath: HomePath = shouldRequireWorkspaceSelection
    ? "/workspace"
    : hostedOnboardingState && !hostedOnboardingState.isWidgetVerified
      ? "/onboarding"
      : "/inbox";
  const isLoading = convexAuthUser === undefined || (!!user && isWorkspaceLoading);

  const login = useCallback(
    async (email: string, password: string) => {
      await convexSignIn("password", { email, password, flow: "signIn" });
    },
    [convexSignIn]
  );

  const loginWithOTP = useCallback(
    async (email: string, code: string) => {
      await convexSignIn("resend-otp", { email, code });
    },
    [convexSignIn]
  );

  const sendOTPCode = useCallback(
    async (email: string) => {
      await convexSignIn("resend-otp", { email });
    },
    [convexSignIn]
  );

  const signup = useCallback(
    async (email: string, password: string, name: string, workspaceName?: string) => {
      const normalizedWorkspaceName = workspaceName?.trim();
      const signUpParams: {
        email: string;
        password: string;
        name: string;
        flow: "signUp";
        workspaceName?: string;
      } = {
        email,
        password,
        name,
        flow: "signUp",
      };
      if (normalizedWorkspaceName && normalizedWorkspaceName.length > 0) {
        signUpParams.workspaceName = normalizedWorkspaceName;
      }
      await convexSignIn("password", signUpParams);
    },
    [convexSignIn]
  );

  const completeSignupProfile = useCallback(
    async (name: string, workspaceName?: string) => {
      const normalizedName = name.trim();
      const normalizedWorkspaceName = workspaceName?.trim();
      const payload: { name?: string; workspaceName?: string } = {};

      if (normalizedName) {
        payload.name = normalizedName;
      }
      if (normalizedWorkspaceName && normalizedWorkspaceName.length > 0) {
        payload.workspaceName = normalizedWorkspaceName;
      }

      if (Object.keys(payload).length === 0) {
        return;
      }

      await completeSignupProfileMutation(payload);
    },
    [completeSignupProfileMutation]
  );

  const logout = useCallback(async () => {
    try {
      await unregisterAllPushTokensMutation({});
    } catch (error) {
      console.warn("Failed to unregister push tokens during logout", error);
    }
    await convexSignOut();
    setActiveWorkspaceId(null);
    setRequiresWorkspaceSelection(false);
    if (workspaceStorageKey) {
      await AsyncStorage.removeItem(workspaceStorageKey);
    }
  }, [convexSignOut, unregisterAllPushTokensMutation, workspaceStorageKey]);

  const switchWorkspace = useCallback(
    async (workspaceId: Id<"workspaces">) => {
      if (activeWorkspaceId === workspaceId) {
        return;
      }

      await switchWorkspaceMutation({ workspaceId });
      setActiveWorkspaceId(workspaceId);
      setRequiresWorkspaceSelection(false);

      if (workspaceStorageKey) {
        await AsyncStorage.setItem(workspaceStorageKey, workspaceId);
      }
    },
    [activeWorkspaceId, switchWorkspaceMutation, workspaceStorageKey]
  );

  const completeWorkspaceSelection = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setRequiresWorkspaceSelection(false);
    const workspaceToPersist = activeWorkspaceId ?? user?.workspaceId ?? null;
    if (!workspaceStorageKey) {
      return;
    }

    if (workspaceToPersist) {
      await AsyncStorage.setItem(workspaceStorageKey, workspaceToPersist);
    } else {
      await AsyncStorage.removeItem(workspaceStorageKey);
    }
  }, [activeWorkspaceId, isAuthenticated, user?.workspaceId, workspaceStorageKey]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    defaultHomePath,
    requiresWorkspaceSelection,
    isHomeRouteLoading,
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?._id ?? null,
    login,
    loginWithOTP,
    sendOTPCode,
    signup,
    completeSignupProfile,
    logout,
    switchWorkspace,
    completeWorkspaceSelection,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    const fallback: AuthContextType = {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      defaultHomePath: "/inbox",
      requiresWorkspaceSelection: false,
      isHomeRouteLoading: false,
      workspaces: [],
      activeWorkspace: null,
      activeWorkspaceId: null,
      login: async () => {
        throw new Error("No AuthProvider");
      },
      loginWithOTP: async () => {
        throw new Error("No AuthProvider");
      },
      sendOTPCode: async () => {
        throw new Error("No AuthProvider");
      },
      signup: async () => {
        throw new Error("No AuthProvider");
      },
      completeSignupProfile: async () => {
        throw new Error("No AuthProvider");
      },
      logout: async () => {
        throw new Error("No AuthProvider");
      },
      switchWorkspace: async () => {
        throw new Error("No AuthProvider");
      },
      completeWorkspaceSelection: async () => {
        throw new Error("No AuthProvider");
      },
    };
    return fallback;
  }
  return context;
}
