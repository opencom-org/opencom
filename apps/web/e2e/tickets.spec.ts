import { test, expect } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import {
  createTicketForVisitor,
  seedVisitor,
  updateWorkspaceMemberPermissions,
} from "./helpers/test-data";
import { openWidgetChat } from "./helpers/widget-helpers";
import type { Id } from "@opencom/convex/dataModel";

const getWidgetDemoRoute = (workspaceId?: string) =>
  workspaceId ? `/widget-demo?workspaceId=${workspaceId}` : "/widget-demo";

function createUniqueLabel(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function gotoProtectedTicketRoute(
  page: Page,
  path: string,
  readyLocatorFactory: () => Locator
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoWithAuthRecovery(page, path);

    const readyLocator = readyLocatorFactory();
    const isReady = await readyLocator.isVisible({ timeout: 6000 }).catch(() => false);
    if (isReady) {
      return;
    }

    const authed = await ensureAuthenticatedInPage(page);
    if (!authed) {
      await page.waitForTimeout(500);
    }
  }

  await expect(readyLocatorFactory()).toBeVisible({ timeout: 15000 });
}

async function ensureTicketsPageReady(page: Page): Promise<void> {
  await gotoProtectedTicketRoute(page, "/tickets", () =>
    page.getByRole("heading", { name: /tickets/i }).first()
  );
}

async function openCreateTicketModal(page: Page): Promise<void> {
  await ensureTicketsPageReady(page);

  const newTicketButton = page.getByRole("button", { name: /new ticket|create ticket/i }).first();
  await expect(newTicketButton).toBeVisible({ timeout: 10000 });

  const modalHeading = page.getByRole("heading", { name: /create (new )?ticket/i });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await newTicketButton.click({ timeout: 5000 });
    } catch {
      await newTicketButton.click({ force: true, timeout: 5000 });
    }

    if (await modalHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
  }

  await expect(modalHeading).toBeVisible({ timeout: 10000 });
}

async function createTicketFromModal(
  page: Page,
  subject: string,
  description = "This is an E2E ticket description"
): Promise<void> {
  await openCreateTicketModal(page);

  await page.getByPlaceholder(/brief description of the issue/i).fill(subject);
  const descriptionInput = page.locator(".fixed textarea, [role='dialog'] textarea").first();
  await expect(descriptionInput).toBeVisible({ timeout: 5000 });
  await descriptionInput.fill(description);

  const prioritySelect = page.locator(".fixed select, [role='dialog'] select").first();
  await expect(prioritySelect).toBeVisible({ timeout: 5000 });
  await prioritySelect.selectOption({ label: "High" }).catch(async () => {
    await prioritySelect.selectOption("high");
  });

  const modalHeading = page.getByRole("heading", { name: /create (new )?ticket/i });
  await page.getByRole("button", { name: /create ticket/i }).click();
  await expect(modalHeading).not.toBeVisible({ timeout: 15000 });
}

async function openTicketDetailBySubject(page: Page, subject: string): Promise<void> {
  let ticketLink = page
    .locator("a[href^='/tickets/']:not([href='/tickets/forms'])")
    .filter({ hasText: new RegExp(escapeRegExp(subject), "i") })
    .first();

  let hasTicket = await ticketLink.isVisible({ timeout: 8000 }).catch(() => false);
  if (!hasTicket) {
    await ensureTicketsPageReady(page);
    ticketLink = page
      .locator("a[href^='/tickets/']:not([href='/tickets/forms'])")
      .filter({ hasText: new RegExp(escapeRegExp(subject), "i") })
      .first();
    hasTicket = await ticketLink.isVisible({ timeout: 10000 }).catch(() => false);
  }

  expect(hasTicket).toBe(true);
  await expect(ticketLink).toBeVisible({ timeout: 10000 });
  const detailPath = await ticketLink.getAttribute("href");
  if (detailPath?.startsWith("/tickets/")) {
    await gotoWithAuthRecovery(page, detailPath);
  } else {
    await ticketLink.click();
  }
  await expect(page).toHaveURL(/\/tickets\/[a-z0-9]+/, { timeout: 15000 });
}

async function openTicketFormEditor(page: Page): Promise<void> {
  await gotoProtectedTicketRoute(page, "/tickets/forms", () =>
    page.getByRole("heading", { name: /ticket forms/i }).first()
  );
  await expect(page).toHaveURL(/\/tickets\/forms/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /ticket forms/i }).first()).toBeVisible({
    timeout: 10000,
  });

  const createFormButton = page.getByRole("button", { name: /create form/i }).first();
  await expect(createFormButton).toBeVisible({ timeout: 15000 });
  await createFormButton.click();

  await expect(page.getByPlaceholder(/form name/i).first()).toBeVisible({ timeout: 10000 });
}

async function getStatusFilter(page: Page): Promise<Locator> {
  let statusFilter = page.locator("select").first();
  let hasStatusFilter = await statusFilter.isVisible({ timeout: 5000 }).catch(() => false);

  if (!hasStatusFilter) {
    await ensureTicketsPageReady(page);
    statusFilter = page.locator("select").first();
    hasStatusFilter = await statusFilter.isVisible({ timeout: 10000 }).catch(() => false);
  }

  expect(hasStatusFilter).toBe(true);
  await expect(statusFilter).toBeVisible({ timeout: 10000 });
  return statusFilter;
}

async function openWidgetTicketsTab(page: Page, workspaceId?: string): Promise<Locator> {
  const widgetRoute = getWidgetDemoRoute(workspaceId);
  await gotoWithAuthRecovery(page, widgetRoute);

  let widget: Locator;
  try {
    widget = await openWidgetChat(page);
  } catch {
    await gotoWithAuthRecovery(page, widgetRoute);
    widget = await openWidgetChat(page);
  }

  const ticketsTab = widget.getByRole("button", { name: /^tickets$/i }).first();
  await expect(ticketsTab).toBeVisible({ timeout: 10000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ticketsTab.click({ timeout: 5000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(300);
    }
  }

  await expect(widget.locator(".opencom-tickets-list")).toBeVisible({ timeout: 10000 });
  await expect(widget.locator(".opencom-ticket-create-btn").first()).toBeVisible({
    timeout: 10000,
  });
  return widget;
}

async function createTicketInWidget(
  page: Page,
  subject: string,
  workspaceId?: string
): Promise<Locator> {
  const widget = await openWidgetTicketsTab(page, workspaceId);

  const createButton = widget.locator(".opencom-ticket-create-btn").first();
  await createButton.click();
  await expect(widget.locator(".opencom-ticket-form")).toBeVisible({ timeout: 10000 });

  const subjectInput = widget.locator(".opencom-ticket-form-input").first();
  await expect(subjectInput).toBeVisible({ timeout: 10000 });
  await subjectInput.fill(subject);

  const descriptionInput = widget.locator(".opencom-ticket-form-textarea").first();
  if (await descriptionInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await descriptionInput.fill("Widget ticket created during E2E");
  }

  const submitButton = widget.locator(".opencom-ticket-submit-btn").first();
  await expect(submitButton).toBeVisible({ timeout: 5000 });
  await submitButton.click();

  await expect(widget.locator(".opencom-ticket-detail")).toBeVisible({ timeout: 10000 });
  await expect(widget.locator(".opencom-ticket-detail-subject")).toContainText(subject, {
    timeout: 10000,
  });
  return widget;
}

test.describe("Tickets", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    await ensureAuthenticatedInPage(page);
  });

  test("should display tickets page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");
    await expect(page.getByRole("heading", { name: /tickets/i })).toBeVisible({ timeout: 10000 });
  });

  test("should show empty state when search has no matches", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");
    await page.getByPlaceholder(/search tickets/i).fill(createUniqueLabel("no-match"));
    await expect(page.getByText(/no tickets found/i)).toBeVisible({ timeout: 10000 });
  });

  test("should open create ticket modal", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");
    await openCreateTicketModal(page);

    await expect(page.getByPlaceholder(/brief description of the issue/i)).toBeVisible();
    await expect(page.locator(".fixed textarea, [role='dialog'] textarea").first()).toBeVisible();
    await expect(page.getByText("Priority")).toBeVisible();
  });

  test("should create a new ticket", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");

    const subject = createUniqueLabel("Test Ticket Subject");
    await createTicketFromModal(page, subject);
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 10000 });
  });

  test("should filter tickets by status", async ({ page }) => {
    await ensureTicketsPageReady(page);

    const statusFilter = await getStatusFilter(page);

    await statusFilter.selectOption("submitted");
    await expect(statusFilter).toHaveValue("submitted");
    await statusFilter.selectOption("all");
    await expect(statusFilter).toHaveValue("all");
  });

  test("should navigate to ticket detail page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");

    const subject = createUniqueLabel("Detail View Test Ticket");
    await createTicketFromModal(page, subject, "Testing ticket detail view");
    await openTicketDetailBySubject(page, subject);

    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: new RegExp(escapeRegExp(subject), "i") })
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should update ticket status", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");

    const subject = createUniqueLabel("Status Update Test");
    await createTicketFromModal(page, subject, "Testing status update");
    await openTicketDetailBySubject(page, subject);

    const statusSelect = page
      .locator("label", { hasText: /^Status$/ })
      .first()
      .locator("xpath=..//select");
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.selectOption("in_progress");
    await expect(statusSelect).toHaveValue("in_progress", { timeout: 5000 });
  });

  test("should resolve ticket", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets");

    const subject = createUniqueLabel("Resolve Test Ticket");
    await createTicketFromModal(page, subject, "Testing ticket resolution");
    await openTicketDetailBySubject(page, subject);

    const statusSelect = page
      .locator("label", { hasText: /^Status$/ })
      .first()
      .locator("xpath=..//select");
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.selectOption("resolved");
    await expect(statusSelect).toHaveValue("resolved", { timeout: 5000 });
  });

  test("should navigate to ticket forms page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/tickets/forms");
    await expect(page).toHaveURL(/\/tickets\/forms/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: /ticket forms/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should create a new ticket form", async ({ page }) => {
    await openTicketFormEditor(page);

    const formNameInput = page.getByPlaceholder(/form name/i).first();
    await formNameInput.fill("Customer Support Form");

    const saveButton = page.getByRole("button", { name: /^save$/i }).first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    await expect(page.getByText("Customer Support Form").first()).toBeVisible({ timeout: 10000 });
  });

  test("should add fields to ticket form", async ({ page }) => {
    await openTicketFormEditor(page);

    const fieldCards = page.locator(".max-w-lg .space-y-4 > div");
    const countBefore = await fieldCards.count();

    const shortTextFieldButton = page.getByRole("button", { name: /short text/i }).first();
    await expect(shortTextFieldButton).toBeVisible({ timeout: 5000 });
    await shortTextFieldButton.click();

    await expect(fieldCards).toHaveCount(countBefore + 1, { timeout: 5000 });
    expect(page.url()).toContain("/tickets/forms");
  });

  test("shows permission denied state when conversations.read is missing", async ({
    page,
    testState,
  }) => {
    const workspaceId = testState.workspaceId as Id<"workspaces">;

    try {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, ["conversations.reply"]);
      await gotoWithAuthRecovery(page, "/tickets");

      await expect(page.getByTestId("tickets-page-heading")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tickets-error-state")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tickets-error-state")).toContainText(/permission denied/i);
    } finally {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, []);
    }
  });

  test("shows ticket detail permission denied state when conversations.read is missing", async ({
    page,
    testState,
  }) => {
    const workspaceId = testState.workspaceId as Id<"workspaces">;

    const visitor = await seedVisitor(workspaceId, {
      name: `E2E Ticket Denied Visitor ${Date.now()}`,
      email: `e2e-ticket-denied-${Date.now()}@test.opencom.dev`,
    });
    const ticket = await createTicketForVisitor(workspaceId, visitor.visitorId, {
      subject: `E2E Ticket Denied Detail ${Date.now()}`,
      status: "submitted",
      priority: "normal",
    });

    try {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, ["conversations.reply"]);
      await gotoWithAuthRecovery(page, `/tickets/${ticket.ticketId}`);

      await expect(page.getByTestId("tickets-detail-error-state")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tickets-detail-error-state")).toContainText(
        /permission denied/i
      );
    } finally {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, []);
    }
  });
});

test.describe("Customer Ticket View", () => {
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    await ensureAuthenticatedInPage(page);
  });

  test("should display customer tickets in widget", async ({ page, testState }) => {
    const widget = await openWidgetTicketsTab(page, testState.workspaceId);

    const hasAnyState =
      (await widget
        .locator(".opencom-empty-list")
        .isVisible({ timeout: 1500 })
        .catch(() => false)) ||
      (await widget
        .locator(".opencom-ticket-item")
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false));
    expect(hasAnyState).toBe(true);
  });

  test("should show ticket details in widget", async ({ page, testState }) => {
    const subject = createUniqueLabel("Widget Detail Ticket");
    const widget = await createTicketInWidget(page, subject, testState.workspaceId);

    await expect(widget.locator(".opencom-ticket-detail")).toBeVisible({ timeout: 10000 });
    await expect(widget.locator(".opencom-ticket-detail-subject")).toContainText(subject);
    await expect(widget.locator(".opencom-ticket-status")).toBeVisible();
  });

  test("should allow customer to submit ticket via widget form", async ({ page, testState }) => {
    const subject = createUniqueLabel("Widget Submit Ticket");
    const widget = await createTicketInWidget(page, subject, testState.workspaceId);

    await expect(widget.locator(".opencom-ticket-detail-subject")).toContainText(subject, {
      timeout: 10000,
    });
  });

  test("should allow customer to add comment to ticket", async ({ page, testState }) => {
    const subject = createUniqueLabel("Widget Comment Ticket");
    const widget = await createTicketInWidget(page, subject, testState.workspaceId);

    const comment = createUniqueLabel("This is a test reply from customer");
    const replyInput = widget.locator(".opencom-ticket-reply-input");
    await expect(replyInput).toBeVisible({ timeout: 10000 });
    await replyInput.fill(comment);

    const sendButton = widget.locator(".opencom-ticket-reply-send");
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    await expect(widget.getByText(comment)).toBeVisible({ timeout: 10000 });
  });
});
