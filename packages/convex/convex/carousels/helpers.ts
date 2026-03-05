import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { requirePermission } from "../permissions";
import { resolveVisitorFromSession } from "../widgetSessions";

export type CarouselButton = {
  text: string;
  action: "url" | "dismiss" | "next" | "deeplink";
  url?: string;
  deepLink?: string;
};

export type CarouselScreen = {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: CarouselButton[];
};

const STATUS_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["active", "archived"]),
  active: new Set(["paused", "archived"]),
  paused: new Set(["active", "archived"]),
  archived: new Set(),
};

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDeepLink(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/.+/i.test(value);
}

export function normalizeCarouselScreens(rawScreens: unknown): CarouselScreen[] {
  if (!Array.isArray(rawScreens)) {
    return [];
  }

  return rawScreens
    .map((rawScreen, index) => {
      const screen =
        typeof rawScreen === "object" && rawScreen !== null
          ? (rawScreen as Record<string, unknown>)
          : {};

      const normalizedButtons = Array.isArray(screen.buttons)
        ? screen.buttons
            .map((rawButton) => {
              const button =
                typeof rawButton === "object" && rawButton !== null
                  ? (rawButton as Record<string, unknown>)
                  : {};
              const action = button.action;
              if (
                action !== "url" &&
                action !== "dismiss" &&
                action !== "next" &&
                action !== "deeplink"
              ) {
                return null;
              }
              const text = normalizeOptionalString(button.text);
              if (!text) {
                return null;
              }
              const normalizedButton: CarouselButton = {
                text,
                action,
              };
              const normalizedUrl = normalizeOptionalString(button.url);
              const normalizedDeepLink = normalizeOptionalString(button.deepLink);
              if (normalizedUrl) {
                normalizedButton.url = normalizedUrl;
              }
              if (normalizedDeepLink) {
                normalizedButton.deepLink = normalizedDeepLink;
              }
              return normalizedButton;
            })
            .filter((button): button is CarouselButton => button !== null)
        : [];

      const id = normalizeOptionalString(screen.id) ?? `screen-${index + 1}`;
      return {
        id,
        title: normalizeOptionalString(screen.title),
        body: normalizeOptionalString(screen.body),
        imageUrl: normalizeOptionalString(screen.imageUrl),
        buttons: normalizedButtons.length ? normalizedButtons : undefined,
      } satisfies CarouselScreen;
    })
    .filter((screen) => Boolean(screen.id));
}

export function validateCarouselScreens(rawScreens: unknown): CarouselScreen[] {
  const screens = normalizeCarouselScreens(rawScreens);
  if (!screens.length) {
    throw new Error("Carousel requires at least one screen.");
  }

  screens.forEach((screen, screenIndex) => {
    if (!screen.title && !screen.body) {
      throw new Error(`Screen ${screenIndex + 1} must include a title or body.`);
    }

    (screen.buttons ?? []).forEach((button, buttonIndex) => {
      if (button.action === "url") {
        if (!button.url || !isValidHttpUrl(button.url)) {
          throw new Error(
            `Screen ${screenIndex + 1}, button ${buttonIndex + 1} requires a valid http(s) URL.`
          );
        }
      }

      if (button.action === "deeplink") {
        if (!button.deepLink || !isValidDeepLink(button.deepLink)) {
          throw new Error(
            `Screen ${screenIndex + 1}, button ${buttonIndex + 1} requires a valid deep link URL.`
          );
        }
      }
    });
  });

  return screens;
}

export function assertValidStatusTransition(currentStatus: string, nextStatus: string): void {
  if (currentStatus === nextStatus) {
    throw new Error(`Carousel is already ${currentStatus}.`);
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  if (!allowedTransitions?.has(nextStatus)) {
    throw new Error(`Cannot transition carousel from ${currentStatus} to ${nextStatus}.`);
  }
}

export function assertCarouselDeliverable(carousel: Doc<"carousels">): void {
  if (carousel.status !== "active") {
    throw new Error("Carousel is not active.");
  }

  validateCarouselScreens(carousel.screens);
}

export async function findExistingTerminalImpression(
  ctx: { db: any },
  visitorId: Id<"visitors">,
  carouselId: Id<"carousels">
): Promise<Doc<"carouselImpressions"> | null> {
  return await ctx.db
    .query("carouselImpressions")
    .withIndex("by_visitor_carousel", (q: any) =>
      q.eq("visitorId", visitorId).eq("carouselId", carouselId)
    )
    .filter((q: any) =>
      q.or(q.eq(q.field("action"), "completed"), q.eq(q.field("action"), "dismissed"))
    )
    .first();
}

export async function hasTerminalImpression(
  ctx: { db: any },
  visitorId: Id<"visitors">,
  carouselId: Id<"carousels">
): Promise<boolean> {
  const existing = await findExistingTerminalImpression(ctx, visitorId, carouselId);
  return !!existing;
}

export async function resolveCarouselVisitorAccess(
  ctx: QueryCtx | MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
  }
): Promise<Id<"visitors">> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  let resolvedVisitorId = args.visitorId;

  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "conversations.read");
    if (!resolvedVisitorId) {
      throw new Error("visitorId is required for authenticated carousel access");
    }
  } else {
    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    if (args.visitorId && args.visitorId !== resolved.visitorId) {
      throw new Error("Not authorized for requested visitor");
    }
    resolvedVisitorId = resolved.visitorId;
  }

  const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
  if (!visitor || visitor.workspaceId !== args.workspaceId) {
    throw new Error("Visitor not found in workspace");
  }

  return resolvedVisitorId!;
}
