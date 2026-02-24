import { test, expect } from "./fixtures";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  createConversationForVisitor,
  createInboxConversationFixture,
  createTicketForVisitor,
  seedVisitor,
  updateWorkspaceMemberPermissions,
} from "./helpers/test-data";
import { gotoWithAuthRecovery, refreshAuthState } from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import type { Locator, Page } from "@playwright/test";
import { formatHumanVisitorId } from "../src/lib/visitorIdentity";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function requireWorkspaceAndUser(): { workspaceId: Id<"workspaces">; userEmail: string } {
  const state = getTestState();
  if (!state?.workspaceId || !state.email) {
    throw new Error("Missing workspaceId/email in apps/web/e2e/.e2e-state.json");
  }
  return { workspaceId: state.workspaceId as Id<"workspaces">, userEmail: state.email };
}

function isAuthRoute(page: Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function gotoProtectedRoute(page: Page, path: string, readyLocator: Locator): Promise<void> {
  await gotoWithAuthRecovery(page, path);
  await expect(readyLocator).toBeVisible({ timeout: 15000 });
  expect(isAuthRoute(page)).toBe(false);
}

test.describe.serial("Visitors workspace", () => {
  let workspaceId: Id<"workspaces">;
  let userEmail: string;

  test.beforeAll(() => {
    const context = requireWorkspaceAndUser();
    workspaceId = context.workspaceId;
    userEmail = context.userEmail;
  });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();

    await page.addInitScript((workspaceIdValue: string) => {
      window.localStorage.setItem(
        "opencom_active_workspace",
        JSON.stringify({ _id: workspaceIdValue })
      );
    }, workspaceId);

    await cleanupTestData(workspaceId);
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
    await gotoProtectedRoute(page, "/visitors", page.getByTestId("visitors-page-heading"));
  });

  test.afterEach(async () => {
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test("lists, searches, and opens visitor detail with linked records", async ({ page }) => {
    test.setTimeout(120000);

    const searchableVisitor = await seedVisitor(workspaceId, {
      name: "E2E Visitor Searchable",
      email: "e2e-searchable@test.opencom.dev",
      externalUserId: "ext-e2e-visitor-123",
      customAttributes: { plan: "enterprise", lifecycle: "active" },
      location: {
        city: "Austin",
        region: "Texas",
        country: "United States",
        countryCode: "US",
      },
      device: {
        browser: "Chrome",
        os: "macOS",
        deviceType: "desktop",
      },
    });

    const sparseVisitor = await seedVisitor(workspaceId, {
      name: "E2E Visitor Sparse",
      email: "e2e-sparse@test.opencom.dev",
      externalUserId: "ext-e2e-sparse-456",
      customAttributes: {},
      location: {},
      device: {},
    });

    const seededConversation = await createConversationForVisitor(
      workspaceId,
      searchableVisitor.visitorId,
      {
        status: "open",
        initialMessage: "Need help with pricing plan details.",
      }
    );

    await createTicketForVisitor(workspaceId, searchableVisitor.visitorId, {
      conversationId: seededConversation.conversationId,
      subject: "Billing plan clarification",
      description: "Customer requested details about enterprise billing cadence.",
      status: "submitted",
      priority: "high",
    });

    const anonymousFixture = await createInboxConversationFixture(workspaceId, {
      visitorName: "",
      visitorEmail: "",
      initialMessages: [
        { content: "Anonymous visitor seeded for identity fallback", senderType: "visitor" },
      ],
    });
    const anonymousIdentity = formatHumanVisitorId(String(anonymousFixture.visitorId));

    await gotoProtectedRoute(page, "/visitors", page.getByTestId("visitors-page-heading"));
    await expect(page.getByTestId("visitors-page-heading")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("visitors-list")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("visitors-search-help")).toContainText(/internal visitor id/i);
    await expect(page.getByTestId(`visitors-name-${anonymousFixture.visitorId}`)).toHaveText(
      anonymousIdentity,
      {
        timeout: 10000,
      }
    );
    await expect(page.getByTestId(`visitors-email-${anonymousFixture.visitorId}`)).toHaveText(
      anonymousIdentity,
      {
        timeout: 10000,
      }
    );

    await page.getByTestId("visitors-search-input").fill("ext-e2e-visitor-123");
    await expect(page.getByText("E2E Visitor Searchable")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E Visitor Sparse")).toHaveCount(0);

    await page.getByTestId("visitors-search-input").fill(String(searchableVisitor.visitorId));
    await expect(page.getByTestId(`visitors-row-${searchableVisitor.visitorId}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId(`visitors-row-${sparseVisitor.visitorId}`)).toHaveCount(0);

    await page.getByTestId("visitors-search-input").fill("");
    await expect(page.getByText("E2E Visitor Sparse")).toBeVisible({ timeout: 10000 });

    await expect(page.getByTestId(`visitors-row-${searchableVisitor.visitorId}`)).toBeVisible({
      timeout: 10000,
    });
    await gotoProtectedRoute(
      page,
      `/visitors/${searchableVisitor.visitorId}`,
      page.getByTestId("visitor-detail-heading")
    );
    await expect(page).toHaveURL(new RegExp(`/visitors/${searchableVisitor.visitorId}$`), {
      timeout: 15000,
    });
    await expect(page.getByTestId("visitor-detail-heading")).toContainText(
      "E2E Visitor Searchable"
    );
    await expect(page.getByTestId("visitor-profile-email")).toHaveText(
      "e2e-searchable@test.opencom.dev"
    );
    await expect(page.getByTestId("visitor-custom-attribute-plan")).toHaveText("enterprise");
    await expect(
      page.getByTestId(`visitor-linked-conversation-${seededConversation.conversationId}`)
    ).toBeVisible();
    await expect(page.getByTestId("visitor-linked-tickets-panel")).toContainText(
      "Billing plan clarification"
    );

    await gotoProtectedRoute(
      page,
      `/visitors/${sparseVisitor.visitorId}`,
      page.getByTestId("visitor-detail-heading")
    );
    await expect(page.getByTestId("visitor-context-panel")).toContainText(/Unknown/i);

    await gotoProtectedRoute(
      page,
      `/visitors/${anonymousFixture.visitorId}`,
      page.getByTestId("visitor-detail-heading")
    );
    await expect(page.getByTestId("visitor-detail-heading")).toHaveText(anonymousIdentity, {
      timeout: 10000,
    });
  });

  test("shows permission denied state when users.read is missing", async ({ page }) => {
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, ["conversations.read"]);

    await gotoProtectedRoute(page, "/visitors", page.getByTestId("visitors-page-heading"));
    await expect(page.getByTestId("visitors-error-state")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("visitors-error-state")).toContainText(/permission denied/i);
  });
});
