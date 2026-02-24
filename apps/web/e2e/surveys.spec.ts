import { test, expect } from "./fixtures";
import type { Download, Page } from "@playwright/test";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import { seedSurvey, updateWorkspaceMemberPermissions } from "./helpers/test-data";
import { waitForWidgetLoad } from "./helpers/widget-helpers";
import type { Id } from "@opencom/convex/dataModel";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function requireTestContext(): { workspaceId: Id<"workspaces">; userEmail: string } {
  const state = getTestState();
  if (!state?.workspaceId || !state.email) {
    throw new Error("Expected workspaceId/email in E2E test state.");
  }
  return {
    workspaceId: state.workspaceId as Id<"workspaces">,
    userEmail: state.email,
  };
}

async function ensureAuthenticated(page: Page): Promise<void> {
  const refreshed = await refreshAuthState();
  expect(refreshed).toBe(true);

  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
}

async function createAndConfigureSurvey(
  page: Page,
  workspaceId: Id<"workspaces">
): Promise<Id<"surveys">> {
  const surveyName = `e2e_test_survey_${Date.now()}`;
  const seeded = await seedSurvey(workspaceId, {
    name: surveyName,
    status: "active",
    format: "small",
    questionType: "nps",
    triggerType: "immediate",
  });

  await gotoWithAuthRecovery(page, `/surveys/${seeded.surveyId}`);
  await expect(page).toHaveURL(new RegExp(`/surveys/${seeded.surveyId}$`), { timeout: 15000 });

  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
  await gotoWithAuthRecovery(page, `/surveys/${seeded.surveyId}`);
  await expect(page).toHaveURL(new RegExp(`/surveys/${seeded.surveyId}$`), { timeout: 15000 });

  return seeded.surveyId;
}

async function openSurveyDetail(page: Page, surveyId: Id<"surveys">): Promise<void> {
  await gotoWithAuthRecovery(page, `/surveys/${surveyId}`);
  await expect(page).toHaveURL(new RegExp(`/surveys/${surveyId}$`), { timeout: 15000 });
  await expect(page).not.toHaveURL(AUTH_ROUTE_RE);
}

async function openAnalyticsTab(page: Page): Promise<void> {
  await page.getByTestId("survey-tab-analytics").click();
  await expect(page.getByText("Survey Response Export")).toBeVisible({ timeout: 10000 });
}

async function submitSurveyViaWidget(page: Page, workspaceId: string): Promise<void> {
  await gotoWithAuthRecovery(page, `/widget-demo?workspaceId=${workspaceId}`);
  await expect(page).not.toHaveURL(AUTH_ROUTE_RE);
  const widget = await waitForWidgetLoad(page, 20000);
  await widget.locator(".opencom-launcher").first().click();
  await expect(widget.locator(".opencom-chat").first()).toBeVisible({ timeout: 10000 });

  const survey = page.locator(".oc-survey-small, .oc-survey-large").first();
  await expect(survey).toBeVisible({ timeout: 20000 });
  await survey.getByRole("button", { name: "9", exact: true }).click();
  await survey.getByRole("button", { name: /^submit$/i }).click();
  const doneButton = survey.getByRole("button", { name: /^done$/i });
  const hasDoneStep = await doneButton.isVisible({ timeout: 10000 }).catch(() => false);
  if (hasDoneStep) {
    await doneButton.click({ force: true });
  }
}

async function assertAnalyticsCapturedResponse(page: Page): Promise<void> {
  await expect(page.getByTestId("survey-analytics-completed")).toBeVisible({ timeout: 10000 });
  const completedText = (await page.getByTestId("survey-analytics-completed").textContent()) ?? "0";
  expect(Number(completedText.trim())).toBeGreaterThan(0);

  const responseRateText =
    (await page.getByTestId("survey-analytics-response-rate").textContent()) ?? "0%";
  expect(Number(responseRateText.replace("%", "").trim())).toBeGreaterThan(0);
}

async function readDownloadedCsv(download: Download): Promise<string> {
  const downloadPath = path.join(
    os.tmpdir(),
    `opencom-survey-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.csv`
  );
  await download.saveAs(downloadPath);
  return fs.readFile(downloadPath, "utf8");
}

test.describe.serial("Web Admin - Survey Lifecycle", () => {
  test.describe.configure({ timeout: 120000 });

  let workspaceId: Id<"workspaces">;
  let userEmail: string;

  test.beforeAll(() => {
    const context = requireTestContext();
    workspaceId = context.workspaceId;
    userEmail = context.userEmail;
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test.afterEach(async () => {
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test("creates/configures survey, delivers in widget, and records analytics", async ({ page }) => {
    const surveyId = await createAndConfigureSurvey(page, workspaceId);

    await submitSurveyViaWidget(page, workspaceId);
    await ensureAuthenticated(page);
    await openSurveyDetail(page, surveyId);
    await openAnalyticsTab(page);
    await assertAnalyticsCapturedResponse(page);
  });

  test("exports survey responses and shows permission denied without data.export", async ({
    page,
  }) => {
    const surveyId = await createAndConfigureSurvey(page, workspaceId);
    await submitSurveyViaWidget(page, workspaceId);

    await ensureAuthenticated(page);
    await openSurveyDetail(page, surveyId);
    await openAnalyticsTab(page);
    await assertAnalyticsCapturedResponse(page);

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByTestId("survey-export-csv-button").click(),
    ]);

    expect(download.suggestedFilename()).toContain(`survey-${surveyId}-responses.csv`);
    const csv = await readDownloadedCsv(download);
    expect(csv).toContain("responseId");
    expect(csv).toContain("answer:");

    await updateWorkspaceMemberPermissions(workspaceId, userEmail, ["settings.workspace"]);
    await openSurveyDetail(page, surveyId);
    await openAnalyticsTab(page);

    const deniedDownloadPromise = page
      .waitForEvent("download", { timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    await page.getByTestId("survey-export-csv-button").click();
    await expect(page.getByTestId("survey-export-error")).toContainText(/permission denied/i, {
      timeout: 10000,
    });
    expect(await deniedDownloadPromise).toBe(false);
  });
});
