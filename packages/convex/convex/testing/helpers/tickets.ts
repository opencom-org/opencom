import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const createTestTicket = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    subject: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("in_progress"),
        v.literal("waiting_on_customer"),
        v.literal("resolved")
      )
    ),
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const ticketId = await ctx.db.insert("tickets", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      conversationId: args.conversationId,
      subject: args.subject,
      description: args.description,
      status: args.status || "submitted",
      priority: args.priority || "normal",
      assigneeId: args.assigneeId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { ticketId };
  },
});

/**
 * Creates a test ticket form in the specified workspace.
 */
const createTestTicketForm = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const ticketFormId = await ctx.db.insert("ticketForms", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      fields: [
        {
          id: "subject",
          type: "text",
          label: "Subject",
          required: true,
        },
        {
          id: "description",
          type: "textarea",
          label: "Description",
          required: false,
        },
      ],
      isDefault: args.isDefault || false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { ticketFormId };
  },
});

// ============================================================================
// Auth-bypassing operation helpers for tests
// These mirror auth-protected API functions but skip auth checks.
// Only available via api.testing.helpers.* for test environments.
// ============================================================================

/**
 * Creates a collection directly (bypasses auth on collections.create).
 */

export const ticketTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestTicket,
  createTestTicketForm,
} as const;
