import { test, expect } from "@playwright/test";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";
import { getPublicWorkspaceContext, updateHelpCenterAccessPolicy } from "./helpers/test-data";
import type { Id } from "@opencom/convex/dataModel";

const BACKEND_URL = resolveE2EBackendUrl();
const hasAdminSecret = Boolean(process.env.TEST_ADMIN_SECRET);
const ENCODED_BACKEND_URL = encodeURIComponent(BACKEND_URL);

function withBackendQuery(pathname: string): string {
  return pathname.includes("?")
    ? `${pathname}&backendUrl=${ENCODED_BACKEND_URL}`
    : `${pathname}?backendUrl=${ENCODED_BACKEND_URL}`;
}

function getBackendState(nowIso: string) {
  return JSON.stringify({
    backends: [
      {
        url: BACKEND_URL,
        name: "Default Workspace",
        convexUrl: BACKEND_URL,
        lastUsed: nowIso,
      },
    ],
    activeBackend: BACKEND_URL,
  });
}

test.describe("Web Admin - Public Pages (Help Center)", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((backendState) => {
      localStorage.setItem("opencom_backends", backendState);
    }, getBackendState(new Date().toISOString()));

    if (hasAdminSecret) {
      const workspace = await getPublicWorkspaceContext();
      if (workspace) {
        await updateHelpCenterAccessPolicy(workspace._id as Id<"workspaces">, "public");
      }
    }
  });

  test("should access public help center without authentication", async ({ page }) => {
    await page.goto(withBackendQuery("/help"));

    await expect(page).toHaveURL(/\/help/);
    await expect(page).not.toHaveURL(/login|signup/);
    await expect(page.getByRole("heading", { name: /help center/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should render public help center content without auth", async ({ page }) => {
    await page.goto(withBackendQuery("/help"));

    await expect(
      page.getByRole("heading", { name: /no articles yet|all articles/i }).first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show article not found for invalid public slug", async ({ page }) => {
    await page.goto(withBackendQuery("/help/draft-article-test-12345"));

    await expect(page.getByRole("heading", { name: /article not found/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/back to help center/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should show explicit restricted boundary when public access is disabled", async ({
    page,
  }) => {
    if (!hasAdminSecret) {
      test.skip(true, "TEST_ADMIN_SECRET is required");
    }
    const workspace = await getPublicWorkspaceContext();
    test.skip(!workspace, "A public workspace context is required");

    await updateHelpCenterAccessPolicy(workspace!._id as Id<"workspaces">, "restricted");

    await page.goto(withBackendQuery("/help"));
    await expect(page.getByRole("heading", { name: /help center is private/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible({ timeout: 10000 });

    await page.goto(withBackendQuery("/help/some-article-slug"));
    await expect(page.getByRole("heading", { name: /help center is private/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
