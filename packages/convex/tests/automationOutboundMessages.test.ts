import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import type { Id } from "../convex/_generated/dataModel";

const modules = import.meta.glob("../convex/**/*.ts");

describe("automation outbound messages", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    vi.useFakeTimers();
    t = convexTest(schema, modules);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function seedWorkspace() {
    return t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Test Workspace",
        automationApiEnabled: true,
        createdAt: now,
      });
      const userId = await ctx.db.insert("users", {
        email: "admin@test.com",
        workspaceId,
        role: "admin",
        createdAt: now,
      });
      const credentialId = await ctx.db.insert("automationCredentials", {
        workspaceId,
        name: "Test Key",
        secretHash: "testhash123",
        secretPrefix: "osk_test",
        scopes: ["outbound.read", "outbound.write"],
        status: "active",
        actorName: "test-bot",
        createdBy: userId,
        createdAt: now,
      });
      return { workspaceId, userId, credentialId };
    });
  }

  async function seedSecondWorkspace() {
    return t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Other Workspace",
        automationApiEnabled: true,
        createdAt: now,
      });
      return { workspaceId };
    });
  }

  // ── CRUD lifecycle ─────────────────────────────────────────────────

  it("create → get → update → list → delete lifecycle", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // Create
    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Welcome Chat",
        content: { text: "Hello visitor!" },
      }
    );
    expect(created.id).toBeDefined();

    // Get
    const fetched = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      {
        workspaceId,
        outboundMessageId: created.id,
      }
    );
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Welcome Chat");
    expect(fetched!.status).toBe("draft");
    expect(fetched!.content).toEqual({ text: "Hello visitor!" });

    // Update
    const updated = await t.mutation(
      internal.automationApiInternals.updateOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        outboundMessageId: created.id,
        name: "Updated Welcome",
        content: { text: "Hey there!" },
      }
    );
    expect(updated.id).toBe(created.id);

    // Verify update
    const refetched = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      {
        workspaceId,
        outboundMessageId: created.id,
      }
    );
    expect(refetched!.name).toBe("Updated Welcome");
    expect(refetched!.content).toEqual({ text: "Hey there!" });

    // List
    const list = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      {
        workspaceId,
        limit: 10,
      }
    );
    expect(list.data).toHaveLength(1);
    expect(list.data[0].id).toBe(created.id);
    expect(list.hasMore).toBe(false);

    // Delete
    const deleted = await t.mutation(
      internal.automationApiInternals.deleteOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        outboundMessageId: created.id,
      }
    );
    expect(deleted.id).toBe(created.id);

    // Verify deleted
    const gone = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      {
        workspaceId,
        outboundMessageId: created.id,
      }
    );
    expect(gone).toBeNull();
  });

  // ── Workspace isolation ────────────────────────────────────────────

  it("workspace isolation prevents cross-workspace get/update/delete", async () => {
    const wsA = await seedWorkspace();
    const wsB = await seedSecondWorkspace();

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId: wsA.workspaceId,
        credentialId: wsA.credentialId,
        name: "WS-A Message",
        content: { text: "Hello from A" },
      }
    );

    // Workspace B cannot get it
    const fromB = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      {
        workspaceId: wsB.workspaceId,
        outboundMessageId: created.id,
      }
    );
    expect(fromB).toBeNull();

    // Workspace B cannot update it
    await expect(
      t.mutation(
        internal.automationApiInternals.updateOutboundMessageForAutomation,
        {
          workspaceId: wsB.workspaceId,
          outboundMessageId: created.id,
          name: "Hacked",
        }
      )
    ).rejects.toThrow("Outbound message not found");

    // Workspace B cannot delete it
    await expect(
      t.mutation(
        internal.automationApiInternals.deleteOutboundMessageForAutomation,
        {
          workspaceId: wsB.workspaceId,
          outboundMessageId: created.id,
        }
      )
    ).rejects.toThrow("Outbound message not found");
  });

  it("workspace isolation prevents cross-workspace activate/pause", async () => {
    const wsA = await seedWorkspace();
    const wsB = await seedSecondWorkspace();

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId: wsA.workspaceId,
        credentialId: wsA.credentialId,
        name: "WS-A Activate Test",
        content: { text: "A only" },
      }
    );

    // Workspace B cannot activate it
    await expect(
      t.mutation(
        internal.automationApiInternals.activateOutboundMessageForAutomation,
        {
          workspaceId: wsB.workspaceId,
          outboundMessageId: created.id,
        }
      )
    ).rejects.toThrow("Outbound message not found");

    // Activate in correct workspace, then try cross-workspace pause
    await t.mutation(
      internal.automationApiInternals.activateOutboundMessageForAutomation,
      {
        workspaceId: wsA.workspaceId,
        credentialId: wsA.credentialId,
        outboundMessageId: created.id,
      }
    );

    await expect(
      t.mutation(
        internal.automationApiInternals.pauseOutboundMessageForAutomation,
        {
          workspaceId: wsB.workspaceId,
          outboundMessageId: created.id,
        }
      )
    ).rejects.toThrow("Outbound message not found");
  });

  // ── Activate / pause lifecycle ─────────────────────────────────────

  it("activate and pause lifecycle transitions", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Lifecycle Test",
        content: { text: "Test" },
      }
    );

    // Should start as draft
    let msg = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      { workspaceId, outboundMessageId: created.id }
    );
    expect(msg!.status).toBe("draft");

    // Activate
    const activated = await t.mutation(
      internal.automationApiInternals.activateOutboundMessageForAutomation,
      { workspaceId, credentialId, outboundMessageId: created.id }
    );
    expect(activated.status).toBe("active");

    msg = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      { workspaceId, outboundMessageId: created.id }
    );
    expect(msg!.status).toBe("active");

    // Pause
    const paused = await t.mutation(
      internal.automationApiInternals.pauseOutboundMessageForAutomation,
      { workspaceId, credentialId, outboundMessageId: created.id }
    );
    expect(paused.status).toBe("paused");

    msg = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      { workspaceId, outboundMessageId: created.id }
    );
    expect(msg!.status).toBe("paused");

    // Re-activate
    const reactivated = await t.mutation(
      internal.automationApiInternals.activateOutboundMessageForAutomation,
      { workspaceId, credentialId, outboundMessageId: created.id }
    );
    expect(reactivated.status).toBe("active");
  });

  // ── Chat-only enforcement ──────────────────────────────────────────

  it("only exposes chat-type messages, not banner/post", async () => {
    const { workspaceId } = await seedWorkspace();

    // Insert a banner message directly
    const bannerId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("outboundMessages", {
        workspaceId,
        type: "banner",
        name: "Banner Message",
        content: { title: "Sale!", body: "50% off" },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    // Get returns null for non-chat type
    const fetched = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      { workspaceId, outboundMessageId: bannerId }
    );
    expect(fetched).toBeNull();

    // List excludes non-chat types
    const list = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 10 }
    );
    expect(list.data).toHaveLength(0);

    // Update throws for non-chat type
    await expect(
      t.mutation(
        internal.automationApiInternals.updateOutboundMessageForAutomation,
        { workspaceId, outboundMessageId: bannerId, name: "Nope" }
      )
    ).rejects.toThrow("Outbound message not found");
  });

  // ── List pagination ────────────────────────────────────────────────

  it("paginates list results correctly", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // Create 3 messages with different timestamps
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1000);
      await t.mutation(
        internal.automationApiInternals.createOutboundMessageForAutomation,
        {
          workspaceId,
          credentialId,
          name: `Message ${i + 1}`,
          content: { text: `Content ${i + 1}` },
        }
      );
    }

    // First page: limit 2
    const page1 = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 2 }
    );
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();
    // Descending order — most recent first
    expect(page1.data[0].name).toBe("Message 3");
    expect(page1.data[1].name).toBe("Message 2");

    // Second page
    const page2 = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 2, cursor: page1.nextCursor! }
    );
    expect(page2.data).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
    expect(page2.data[0].name).toBe("Message 1");
  });

  it("paginates correctly when multiple messages share the same updatedAt", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // Create 5 messages at the exact same timestamp (no timer advance)
    vi.advanceTimersByTime(1000);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = await t.mutation(
        internal.automationApiInternals.createOutboundMessageForAutomation,
        {
          workspaceId,
          credentialId,
          name: `Same-ts ${i + 1}`,
          content: { text: `Content ${i + 1}` },
        }
      );
      ids.push(String(result.id));
    }

    // Page through with limit=2
    const allNames: string[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 5; page++) {
      const result = await t.query(
        internal.automationApiInternals.listOutboundMessagesForAutomation,
        { workspaceId, limit: 2, cursor }
      );
      for (const item of result.data) {
        allNames.push(item.name);
      }
      if (!result.hasMore) break;
      cursor = result.nextCursor!;
    }

    // All 5 messages should appear exactly once
    expect(allNames).toHaveLength(5);
    expect(new Set(allNames).size).toBe(5);
    for (let i = 1; i <= 5; i++) {
      expect(allNames).toContain(`Same-ts ${i}`);
    }
  });

  // ── List updatedSince filter ───────────────────────────────────────

  it("filters list by updatedSince", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // Create first message at t=1000
    vi.advanceTimersByTime(1000);
    await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Old Message",
        content: { text: "old" },
      }
    );
    const cutoff = Date.now();

    // Create second message at t=2000
    vi.advanceTimersByTime(1000);
    await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "New Message",
        content: { text: "new" },
      }
    );

    // updatedSince = cutoff should only return the newer message
    const filtered = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 10, updatedSince: cutoff }
    );
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0].name).toBe("New Message");

    // Without filter should return both
    const all = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 10 }
    );
    expect(all.data).toHaveLength(2);
  });

  // ── List status filter ─────────────────────────────────────────────

  it("filters list by status", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // Create two messages
    vi.advanceTimersByTime(1000);
    await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Draft Message",
        content: { text: "draft" },
      }
    );

    vi.advanceTimersByTime(1000);
    const msg2 = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Active Message",
        content: { text: "active" },
      }
    );

    // Activate the second one
    await t.mutation(
      internal.automationApiInternals.activateOutboundMessageForAutomation,
      { workspaceId, credentialId, outboundMessageId: msg2.id }
    );

    // Filter by active
    const activeList = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 10, status: "active" }
    );
    expect(activeList.data).toHaveLength(1);
    expect(activeList.data[0].name).toBe("Active Message");

    // Filter by draft
    const draftList = await t.query(
      internal.automationApiInternals.listOutboundMessagesForAutomation,
      { workspaceId, limit: 10, status: "draft" }
    );
    expect(draftList.data).toHaveLength(1);
    expect(draftList.data[0].name).toBe("Draft Message");
  });

  // ── Targeting validation ───────────────────────────────────────────

  it("accepts valid targeting rules on create", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    const validTargeting = {
      type: "group" as const,
      operator: "and" as const,
      conditions: [
        {
          type: "condition" as const,
          property: { source: "system" as const, key: "country" },
          operator: "equals" as const,
          value: "US",
        },
      ],
    };

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Targeted Chat",
        content: { text: "Hello US visitors" },
        targeting: validTargeting,
      }
    );
    expect(created.id).toBeDefined();

    const fetched = await t.query(
      internal.automationApiInternals.getOutboundMessageForAutomation,
      { workspaceId, outboundMessageId: created.id }
    );
    expect(fetched!.targeting).toEqual(validTargeting);
  });

  it("accepts valid targeting rules on update", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "No Target",
        content: { text: "Hello" },
      }
    );

    const validTargeting = {
      type: "condition" as const,
      property: { source: "system" as const, key: "browser" },
      operator: "equals" as const,
      value: "Chrome",
    };

    const updated = await t.mutation(
      internal.automationApiInternals.updateOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        outboundMessageId: created.id,
        targeting: validTargeting,
      }
    );
    expect(updated.id).toBe(created.id);
  });

  it("rejects invalid targeting rules on create", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    // A condition missing required "property" field — passes Convex validator
    // (since it's a union) but fails the business logic validateAudienceRule check
    const invalidTargeting = {
      type: "group" as const,
      operator: "and" as const,
      conditions: [
        {
          type: "condition" as const,
          // missing property, operator, value
        },
      ],
    };

    await expect(
      t.mutation(
        internal.automationApiInternals.createOutboundMessageForAutomation,
        {
          workspaceId,
          credentialId,
          name: "Bad Target",
          content: { text: "Hello" },
          targeting: invalidTargeting as any,
        }
      )
    ).rejects.toThrow();
  });

  it("rejects invalid targeting rules on update", async () => {
    const { workspaceId, credentialId } = await seedWorkspace();

    const created = await t.mutation(
      internal.automationApiInternals.createOutboundMessageForAutomation,
      {
        workspaceId,
        credentialId,
        name: "Target Update Test",
        content: { text: "Hello" },
      }
    );

    const invalidTargeting = {
      type: "group" as const,
      operator: "and" as const,
      conditions: [
        {
          type: "condition" as const,
        },
      ],
    };

    await expect(
      t.mutation(
        internal.automationApiInternals.updateOutboundMessageForAutomation,
        {
          workspaceId,
          credentialId,
          outboundMessageId: created.id,
          targeting: invalidTargeting as any,
        }
      )
    ).rejects.toThrow();
  });
});
