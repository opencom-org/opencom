export const OPENCOM_GITHUB_REPO_URL = "https://github.com/opencom-org/opencom";
export const OPENCOM_GITHUB_DOCS_URL = `${OPENCOM_GITHUB_REPO_URL}/tree/main/docs`;

const OPENCOM_WEB_APP_URL =
  process.env.NEXT_PUBLIC_OPENCOM_WEB_APP_URL ?? "https://app.opencom.dev";

const HOSTED_BACKEND_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://outstanding-stork-558.eu-west-1.convex.cloud";

export const OPENCOM_HOSTED_ONBOARDING_URL = `${OPENCOM_WEB_APP_URL.replace(/\/$/, "")}/?backendurl=${HOSTED_BACKEND_URL}&onboarding=hosted`;
