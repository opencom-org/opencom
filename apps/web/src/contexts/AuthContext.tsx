"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

interface User {
  _id: Id<"users">;
  email: string;
  name?: string;
  workspaceId: Id<"workspaces">;
  role: "owner" | "admin" | "agent" | "viewer";
}

interface Workspace {
  _id: Id<"workspaces">;
  name: string;
  role: "owner" | "admin" | "agent" | "viewer";
  allowedOrigins?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  defaultHomePath: "/onboarding" | "/inbox";
  isHomeRouteLoading: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  needsWorkspaceSelection: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOTP: (email: string, code: string) => Promise<void>;
  sendOTPCode: (email: string) => Promise<void>;
  signup: (email: string, password: string, name: string, workspaceName?: string) => Promise<void>;
  completeSignupProfile: (name: string, workspaceName?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: Id<"workspaces">) => Promise<void>;
  selectInitialWorkspace: (workspaceId: Id<"workspaces">) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACTIVE_WORKSPACE_KEY = "opencom_active_workspace";

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [needsWorkspaceSelection, setNeedsWorkspaceSelection] = useState(false);

  // Convex Auth hooks
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();

  // Query current user from Convex Auth session
  const convexAuthUser = useQuery(api.auth.currentUser);

  // Workspace mutation
  const switchWorkspaceMutation = useMutation(api.auth.switchWorkspace);
  const completeSignupProfileMutation = useMutation(api.auth.completeSignupProfile);

  // Derive state from query
  const user = useMemo(() => (convexAuthUser?.user as User | null) ?? null, [convexAuthUser]);
  const workspaces = useMemo(
    () => (convexAuthUser?.workspaces ?? []) as Workspace[],
    [convexAuthUser]
  );
  const isLoading = convexAuthUser === undefined;
  const isAuthenticated = !!user;
  const workspaceIdForHomeRouting = activeWorkspace?._id ?? user?.workspaceId ?? null;
  const hostedOnboardingState = useQuery(
    api.workspaces.getHostedOnboardingState,
    workspaceIdForHomeRouting ? { workspaceId: workspaceIdForHomeRouting } : "skip"
  );
  const isHomeRouteLoading =
    isAuthenticated && !!workspaceIdForHomeRouting && hostedOnboardingState === undefined;
  const defaultHomePath: "/onboarding" | "/inbox" =
    hostedOnboardingState && !hostedOnboardingState.isWidgetVerified ? "/onboarding" : "/inbox";

  const restoreStoredWorkspace = useCallback((): Workspace | null => {
    const storedActiveWorkspace = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    if (!storedActiveWorkspace) {
      return null;
    }

    try {
      const parsed = JSON.parse(storedActiveWorkspace) as { _id?: string };
      return workspaces.find((workspace) => workspace._id === parsed._id) ?? null;
    } catch {
      return null;
    }
  }, [workspaces]);

  // Handle workspace selection when user data loads
  useEffect(() => {
    if (convexAuthUser && workspaces.length > 0) {
      // Try to restore active workspace from localStorage
      const restoredWorkspace = restoreStoredWorkspace();
      if (restoredWorkspace) {
        setActiveWorkspace(restoredWorkspace);
        setNeedsWorkspaceSelection(false);
        return;
      }

      // Default to first workspace or show selection
      if (workspaces.length === 1) {
        setActiveWorkspace(workspaces[0]);
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspaces[0]));
        setNeedsWorkspaceSelection(false);
      } else {
        setNeedsWorkspaceSelection(true);
      }
    } else if (convexAuthUser === null) {
      // Not authenticated
      setActiveWorkspace(null);
      setNeedsWorkspaceSelection(false);
    }
  }, [convexAuthUser, restoreStoredWorkspace, workspaces]);

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
    await convexSignOut();
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
    setActiveWorkspace(null);
    setNeedsWorkspaceSelection(false);
  }, [convexSignOut]);

  const switchWorkspace = useCallback(
    async (workspaceId: Id<"workspaces">) => {
      await switchWorkspaceMutation({ workspaceId });

      const workspace = workspaces.find((w) => w._id === workspaceId);
      if (workspace) {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspace));
        setActiveWorkspace(workspace);
      }
    },
    [workspaces, switchWorkspaceMutation]
  );

  const selectInitialWorkspace = useCallback(
    (workspaceId: Id<"workspaces">) => {
      const workspace = workspaces.find((w) => w._id === workspaceId);
      if (workspace) {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspace));
        setActiveWorkspace(workspace);
        setNeedsWorkspaceSelection(false);
      }
    },
    [workspaces]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        defaultHomePath,
        isHomeRouteLoading,
        workspaces,
        activeWorkspace,
        needsWorkspaceSelection,
        login,
        loginWithOTP,
        sendOTPCode,
        signup,
        completeSignupProfile,
        logout,
        switchWorkspace,
        selectInitialWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}
