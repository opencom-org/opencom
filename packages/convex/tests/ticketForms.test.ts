import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("ticketForms", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testFormId: Id<"ticketForms">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const form = await client.mutation(api.testing.helpers.createTestTicketForm, {
      workspaceId: testWorkspaceId,
      name: "Support Request Form",
      description: "Form for support requests",
      isDefault: false,
    });
    testFormId = form.ticketFormId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("admin ticket form reads are hidden for unauthenticated callers", async () => {
    const forms = await client.query(api.ticketForms.list, {
      workspaceId: testWorkspaceId,
    });
    expect(forms).toEqual([]);

    const form = await client.query(api.ticketForms.get, {
      id: testFormId,
    });
    expect(form).toBeNull();

    const defaultForm = await client.query(api.ticketForms.getDefault, {
      workspaceId: testWorkspaceId,
    });
    expect(defaultForm).toBeNull();
  });

  it("visitor default ticket form lookup remains available", async () => {
    const visitorForm = await client.query(api.ticketForms.getDefaultForVisitor, {
      workspaceId: testWorkspaceId,
    });

    expect(visitorForm?._id).toBe(testFormId);
  });

  it("ticket form writes require authentication", async () => {
    await expect(
      client.mutation(api.ticketForms.create, {
        workspaceId: testWorkspaceId,
        name: "New Form",
        fields: [
          {
            id: "subject",
            type: "text",
            label: "Subject",
            required: true,
          },
        ],
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.ticketForms.update, {
        id: testFormId,
        name: "Updated Form",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.ticketForms.remove, {
        id: testFormId,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
