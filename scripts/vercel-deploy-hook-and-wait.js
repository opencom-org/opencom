#!/usr/bin/env node

const { setTimeout: sleep } = require("node:timers/promises");

const READY_STATE = "READY";
const FAILURE_STATES = new Set(["ERROR", "CANCELED"]);
const ACTIVE_STATES = new Set(["INITIALIZING", "QUEUED", "BUILDING", "DEPLOYING"]);

function fail(message) {
  console.error(`[vercel-deploy] ${message}`);
  process.exit(1);
}

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`Invalid positive integer for ${name}: ${raw}`);
  }
  return parsed;
}

function parseCreatedAt(createdAt) {
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt;
  }
  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function summarizeDeployment(deployment) {
  const id = deployment.uid || deployment.id || "unknown";
  const state = deployment.readyState || deployment.state || "UNKNOWN";
  const url = deployment.url ? `https://${deployment.url}` : "(no url)";
  return `${id} state=${state} url=${url}`;
}

async function triggerDeployHook(hookUrl, projectName) {
  const response = await fetch(hookUrl, { method: "POST" });
  const body = await response.text();

  if (!response.ok) {
    fail(
      `Deploy hook trigger failed for ${projectName}: ${response.status} ${response.statusText}\n${body}`
    );
  }

  if (!body) {
    console.log(`[vercel-deploy] Triggered deploy hook for ${projectName}.`);
    return;
  }

  try {
    const parsed = JSON.parse(body);
    console.log(`[vercel-deploy] Trigger response for ${projectName}: ${JSON.stringify(parsed)}`);
  } catch {
    console.log(`[vercel-deploy] Trigger response for ${projectName}: ${body}`);
  }
}

async function listDeployments({ token, projectId }) {
  const query = new URLSearchParams({
    projectId,
    target: "production",
    limit: "20",
  });
  const url = `https://api.vercel.com/v6/deployments?${query.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.text();
  if (!response.ok) {
    fail(`Failed to query Vercel deployments: ${response.status} ${response.statusText}\n${body}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    fail(`Failed to parse Vercel deployments response: ${error.message}`);
  }

  if (!parsed || !Array.isArray(parsed.deployments)) {
    fail("Vercel deployments response did not include a deployments array.");
  }

  return parsed.deployments;
}

function pickCandidate({ deployments, startedAt, githubSha, seenDeploymentId }) {
  const recentWindowStart = startedAt - 5 * 60 * 1000;
  const sorted = [...deployments].sort((a, b) => parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt));

  if (seenDeploymentId) {
    const seen = sorted.find((deployment) => (deployment.uid || deployment.id) === seenDeploymentId);
    if (seen) {
      return seen;
    }
  }

  const matchingSha = sorted.find((deployment) => {
    const createdAt = parseCreatedAt(deployment.createdAt);
    const commitSha = deployment?.meta?.githubCommitSha;
    return createdAt >= recentWindowStart && commitSha === githubSha;
  });
  if (matchingSha) {
    return matchingSha;
  }

  const recent = sorted.find((deployment) => parseCreatedAt(deployment.createdAt) >= recentWindowStart);
  return recent || null;
}

async function waitForReadyState({
  token,
  projectId,
  projectName,
  githubSha,
  timeoutSeconds,
  pollIntervalSeconds,
}) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutSeconds * 1000;
  let seenDeploymentId = "";
  let lastLoggedState = "";

  while (Date.now() < deadline) {
    const deployments = await listDeployments({ token, projectId });
    const candidate = pickCandidate({ deployments, startedAt, githubSha, seenDeploymentId });

    if (!candidate) {
      console.log(`[vercel-deploy] ${projectName}: waiting for deployment to appear...`);
      await sleep(pollIntervalSeconds * 1000);
      continue;
    }

    const deploymentId = candidate.uid || candidate.id || "";
    const state = candidate.readyState || candidate.state || "UNKNOWN";
    const logLabel = `${deploymentId}:${state}`;

    seenDeploymentId = deploymentId;

    if (logLabel !== lastLoggedState) {
      console.log(`[vercel-deploy] ${projectName}: ${summarizeDeployment(candidate)}`);
      lastLoggedState = logLabel;
    }

    if (state === READY_STATE) {
      console.log(`[vercel-deploy] ${projectName}: deployment is READY.`);
      return;
    }

    if (FAILURE_STATES.has(state)) {
      fail(`${projectName}: deployment failed (${summarizeDeployment(candidate)})`);
    }

    if (!ACTIVE_STATES.has(state)) {
      console.log(
        `[vercel-deploy] ${projectName}: deployment in unexpected state "${state}", still waiting...`
      );
    }

    await sleep(pollIntervalSeconds * 1000);
  }

  fail(`${projectName}: timed out waiting for deployment to reach READY state.`);
}

async function main() {
  const hookUrl = readRequiredEnv("VERCEL_DEPLOY_HOOK_URL");
  const projectId = readRequiredEnv("VERCEL_PROJECT_ID");
  const token = readRequiredEnv("VERCEL_TOKEN");
  const githubSha = readRequiredEnv("GITHUB_SHA");
  const projectName = process.env.VERCEL_PROJECT_NAME || projectId;
  const timeoutSeconds = readIntEnv("VERCEL_DEPLOY_TIMEOUT_SECONDS", 1200);
  const pollIntervalSeconds = readIntEnv("VERCEL_DEPLOY_POLL_INTERVAL_SECONDS", 10);

  await triggerDeployHook(hookUrl, projectName);
  await waitForReadyState({
    token,
    projectId,
    projectName,
    githubSha,
    timeoutSeconds,
    pollIntervalSeconds,
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack || error.message : String(error));
});
