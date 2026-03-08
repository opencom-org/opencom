import { test, expect } from "@playwright/test";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";

const BACKEND_URL = resolveE2EBackendUrl();
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
  });

  // `/help` resolves the deployment's default public workspace when no workspace is specified.
  // In a multi-workspace environment, forcing one workspace to `restricted` does not deterministically
  // make the global public route private, so that boundary is covered by backend policy tests instead.

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
});
