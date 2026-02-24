import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";

const dayValidator = v.union(
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
  v.literal("sunday")
);

const scheduleItemValidator = v.object({
  day: dayValidator,
  enabled: v.boolean(),
  startTime: v.string(),
  endTime: v.string(),
});

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return (await ctx.db
      .query("officeHours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first()) as Doc<"officeHours"> | null;
  },
});

export const getOrDefault = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("officeHours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      return existing;
    }

    // Return default schedule (Mon-Fri 9am-5pm)
    return {
      workspaceId: args.workspaceId,
      timezone: "America/New_York",
      schedule: [
        { day: "monday" as const, enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "tuesday" as const, enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "wednesday" as const, enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "thursday" as const, enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "friday" as const, enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "saturday" as const, enabled: false, startTime: "09:00", endTime: "17:00" },
        { day: "sunday" as const, enabled: false, startTime: "09:00", endTime: "17:00" },
      ],
      offlineMessage: "We're currently offline. We'll get back to you as soon as possible.",
      expectedReplyTimeMinutes: 60,
    };
  },
});

export const upsert = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    timezone: v.optional(v.string()),
    schedule: v.optional(v.array(scheduleItemValidator)),
    offlineMessage: v.optional(v.string()),
    expectedReplyTimeMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    const existing = await ctx.db
      .query("officeHours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.timezone !== undefined && { timezone: args.timezone }),
        ...(args.schedule !== undefined && { schedule: args.schedule }),
        ...(args.offlineMessage !== undefined && {
          offlineMessage: args.offlineMessage,
        }),
        ...(args.expectedReplyTimeMinutes !== undefined && {
          expectedReplyTimeMinutes: args.expectedReplyTimeMinutes,
        }),
        updatedAt: now,
      });
      return existing._id;
    }

    // Create with defaults
    return await ctx.db.insert("officeHours", {
      workspaceId: args.workspaceId,
      timezone: args.timezone ?? "America/New_York",
      schedule: args.schedule ?? [
        { day: "monday", enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "tuesday", enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "wednesday", enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "thursday", enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "friday", enabled: true, startTime: "09:00", endTime: "17:00" },
        { day: "saturday", enabled: false, startTime: "09:00", endTime: "17:00" },
        { day: "sunday", enabled: false, startTime: "09:00", endTime: "17:00" },
      ],
      offlineMessage: args.offlineMessage,
      expectedReplyTimeMinutes: args.expectedReplyTimeMinutes ?? 60,
      createdAt: now,
      updatedAt: now,
    });
  },
});

type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

const WEEKDAY_TO_DAY: Record<string, DayOfWeek> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
};

function getUtcDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getUTCDay()];
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [rawHours, rawMinutes] = timeStr.split(":").map(Number);
  const hours = Number.isFinite(rawHours) ? rawHours : 0;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  return { hours, minutes };
}

function getWallClockForTimezone(
  date: Date,
  timezone: string
): { dayOfWeek: DayOfWeek; currentTime: { hours: number; minutes: number } } {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: timezone,
    })
      .format(date)
      .toLowerCase();

    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(date);

    const hourPart = parts.find((part) => part.type === "hour")?.value ?? "0";
    const minutePart = parts.find((part) => part.type === "minute")?.value ?? "0";

    return {
      dayOfWeek: WEEKDAY_TO_DAY[weekday] ?? getUtcDayOfWeek(date),
      currentTime: { hours: Number(hourPart), minutes: Number(minutePart) },
    };
  } catch {
    return {
      dayOfWeek: getUtcDayOfWeek(date),
      currentTime: {
        hours: date.getUTCHours(),
        minutes: date.getUTCMinutes(),
      },
    };
  }
}

function isWithinHours(
  currentTime: { hours: number; minutes: number },
  startTime: string,
  endTime: string
): boolean {
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const currentMinutes = currentTime.hours * 60 + currentTime.minutes;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  if (startMinutes === endMinutes) {
    return true;
  }

  // Support overnight schedules such as 22:00-06:00.
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export const isCurrentlyOpen = query({
  args: {
    workspaceId: v.id("workspaces"),
    nowMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const officeHours = await ctx.db
      .query("officeHours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!officeHours) {
      // No office hours configured, assume always open
      return { isOpen: true, offlineMessage: null, expectedReplyTimeMinutes: null };
    }

    const now = new Date(args.nowMs ?? Date.now());
    const { dayOfWeek, currentTime } = getWallClockForTimezone(now, officeHours.timezone || "UTC");

    const todaySchedule = officeHours.schedule.find((s) => s.day === dayOfWeek);

    if (!todaySchedule || !todaySchedule.enabled) {
      return {
        isOpen: false,
        offlineMessage: officeHours.offlineMessage,
        expectedReplyTimeMinutes: null,
      };
    }

    const isOpen = isWithinHours(currentTime, todaySchedule.startTime, todaySchedule.endTime);

    return {
      isOpen,
      offlineMessage: isOpen ? null : officeHours.offlineMessage,
      expectedReplyTimeMinutes: isOpen ? officeHours.expectedReplyTimeMinutes : null,
    };
  },
});

export const getExpectedReplyTime = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const officeHours = await ctx.db
      .query("officeHours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!officeHours) {
      return null;
    }

    const minutes = officeHours.expectedReplyTimeMinutes;
    if (!minutes) {
      return null;
    }

    // Format as human-readable string
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes === 60) {
      return "1 hour";
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} day${days > 1 ? "s" : ""}`;
    }
  },
});
