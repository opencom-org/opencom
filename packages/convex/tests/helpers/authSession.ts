import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type SignInResponse =
  | {
      status: "success";
      value?: {
        tokens?: {
          token: string;
          refreshToken: string;
        } | null;
      };
    }
  | {
      status: "error";
      errorMessage: string;
    };

type AuthenticatedWorkspace = {
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  email: string;
};

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signUpAndGetToken(): Promise<{ token: string; email: string }> {
  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }

  const suffix = randomSuffix();
  const email = `auth-${suffix}@test.opencom.dev`;
  const password = `Opencom!${suffix}`;

  const response = await fetch(`${convexUrl}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "auth:signIn",
      format: "json",
      args: {
        provider: "password",
        params: {
          flow: "signUp",
          email,
          password,
          name: "Auth Test Admin",
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`auth:signIn failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as SignInResponse;
  if (payload.status !== "success") {
    throw new Error(`auth:signIn error: ${payload.errorMessage}`);
  }

  const token = payload.value?.tokens?.token;
  if (!token) {
    throw new Error("auth:signIn did not return a JWT token");
  }

  return { token, email };
}

export async function authenticateClientForWorkspace(
  client: ConvexClient
): Promise<AuthenticatedWorkspace> {
  const { token, email } = await signUpAndGetToken();
  client.setAuth(async () => token);

  const current = await client.query(api.auth.currentUser, {});
  const workspaceId = current?.user?.workspaceId;
  const userId = current?.user?._id;
  if (!workspaceId || !userId) {
    throw new Error("Failed to resolve authenticated workspace from auth:currentUser");
  }

  return { workspaceId, userId, email };
}
