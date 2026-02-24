import { ConvexClient } from "convex/browser";
import { Id } from "../../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./authSession";
import { createTestSessionToken, createTestVisitor, createTestWorkspace } from "./testHelpers";

export interface AuthenticatedAgentContext {
  client: ConvexClient;
  workspaceId: Id<"workspaces">;
  userId: Id<"users">;
  email: string;
}

export interface VisitorSessionContext {
  visitorId: Id<"visitors">;
  sessionToken: string;
}

export interface VisitorSessionBundle {
  primary: VisitorSessionContext;
  alternate: VisitorSessionContext;
  crossWorkspace: {
    workspaceId: Id<"workspaces">;
    context: VisitorSessionContext;
  };
}

function requireConvexUrl(): string {
  const convexUrl = process.env.CONVEX_URL?.trim();
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }
  return convexUrl;
}

export async function createAuthenticatedAgentContext(): Promise<AuthenticatedAgentContext> {
  const client = new ConvexClient(requireConvexUrl());
  const auth = await authenticateClientForWorkspace(client);
  return {
    client,
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    email: auth.email,
  };
}

export async function createVisitorSessionBundle(
  client: ConvexClient,
  workspaceId: Id<"workspaces">
): Promise<VisitorSessionBundle> {
  const primaryVisitor = await createTestVisitor(client, {
    workspaceId,
    email: `primary-${Date.now()}@test.opencom.dev`,
  });
  const primarySession = await createTestSessionToken(client, {
    visitorId: primaryVisitor.visitorId,
    workspaceId,
  });

  const alternateVisitor = await createTestVisitor(client, {
    workspaceId,
    email: `alternate-${Date.now()}@test.opencom.dev`,
  });
  const alternateSession = await createTestSessionToken(client, {
    visitorId: alternateVisitor.visitorId,
    workspaceId,
  });

  const crossWorkspace = await createTestWorkspace(client, `cross-${Date.now()}`);
  const crossVisitor = await createTestVisitor(client, {
    workspaceId: crossWorkspace.workspaceId,
    email: `cross-${Date.now()}@test.opencom.dev`,
  });
  const crossSession = await createTestSessionToken(client, {
    visitorId: crossVisitor.visitorId,
    workspaceId: crossWorkspace.workspaceId,
  });

  return {
    primary: {
      visitorId: primaryVisitor.visitorId,
      sessionToken: primarySession.sessionToken,
    },
    alternate: {
      visitorId: alternateVisitor.visitorId,
      sessionToken: alternateSession.sessionToken,
    },
    crossWorkspace: {
      workspaceId: crossWorkspace.workspaceId,
      context: {
        visitorId: crossVisitor.visitorId,
        sessionToken: crossSession.sessionToken,
      },
    },
  };
}
