"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  SetupError,
  mergeEnvFileContent,
  parseEnvContent,
  readEnvFile,
  runSetup,
  runUpdateEnv,
} = require("../local-convex-setup");

async function createTempRepo() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencom-local-setup-"));
  await fs.mkdir(path.join(rootDir, "packages/convex"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "packages/react-native-sdk/example"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "apps/web"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "apps/widget"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "apps/mobile"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "apps/landing"), { recursive: true });
  return rootDir;
}

function createHarness({
  rootDir,
  initialConvexEnv = "",
  backendEnv = {},
  setupState = { hasUsers: false, hasWorkspaces: false },
  workspaces = [],
  authError = "",
  requireWorkspaceCreation = false,
}) {
  const commands = [];
  const envStore = { ...backendEnv };
  const tokenValue = "token-local-bootstrap";
  let activeWorkspaceId = workspaces[0]?._id || null;
  let authAttempts = 0;

  async function ensureConvexEnvFile(contents) {
    await fs.writeFile(path.join(rootDir, "packages/convex/.env.local"), contents, "utf8");
  }

  async function getFileContents(relativePath) {
    return fs.readFile(path.join(rootDir, relativePath), "utf8");
  }

  const runtime = {
    rootDir,
    output: {
      isTTY: false,
      write() {},
    },
    ui: {
      async ask() {
        return "";
      },
      async askSecret() {
        return "";
      },
      async confirm() {
        return true;
      },
      async select(_question, options, defaultIndex) {
        return options[defaultIndex].value;
      },
      async close() {},
    },
    log() {},
    warn() {},
    error() {},
    generateAuthSecret() {
      return "generated-auth-secret";
    },
    async exists(filePath) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    async readFile(filePath, encoding = "utf8") {
      return fs.readFile(filePath, encoding);
    },
    async writeFile(filePath, contents) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents, "utf8");
    },
    async runCommand(command, args) {
      commands.push([command, ...args]);
      const joined = `${command} ${args.join(" ")}`;

      if (joined === "pnpm install") {
        return { stdout: "", stderr: "", code: 0 };
      }

      if (
        joined === "pnpm --filter @opencom/convex exec convex dev --once" ||
        joined === "pnpm --filter @opencom/convex exec convex dev --once --configure"
      ) {
        await ensureConvexEnvFile(
          [
            initialConvexEnv,
            'CONVEX_DEPLOYMENT="dev:opencom-test"',
            'CONVEX_URL="https://opencom-test.convex.cloud"',
          ]
            .filter(Boolean)
            .join("\n") + "\n"
        );
        return { stdout: "", stderr: "", code: 0 };
      }

      if (
        command === "pnpm" &&
        args[0] === "--filter" &&
        args[1] === "@opencom/convex" &&
        args[2] === "exec" &&
        args[3] === "convex" &&
        args[4] === "env" &&
        args[5] === "get"
      ) {
        const key = args[6];
        if (envStore[key]) {
          return { stdout: `${envStore[key]}\n`, stderr: "", code: 0 };
        }
        const error = new Error(`missing env ${key}`);
        error.stdout = "";
        error.stderr = `Environment variable ${key} is not set.`;
        throw error;
      }

      if (
        command === "pnpm" &&
        args[0] === "--filter" &&
        args[1] === "@opencom/convex" &&
        args[2] === "exec" &&
        args[3] === "convex" &&
        args[4] === "env" &&
        args[5] === "set"
      ) {
        envStore[args[6]] = args[7];
        return { stdout: "", stderr: "", code: 0 };
      }

      throw new Error(`Unexpected command: ${joined}`);
    },
    async fetchImpl(_url, init) {
      const request = JSON.parse(init.body);

      if (request.path === "setup:checkExistingSetup") {
        return new Response(JSON.stringify(setupState), { status: 200 });
      }

      if (request.path === "auth:signIn") {
        authAttempts += 1;
        if (authError) {
          return new Response(JSON.stringify({ status: "error", errorMessage: authError }), {
            status: 200,
          });
        }

        if (request.args.params.flow === "signUp" && workspaces.length === 0) {
          workspaces.push({
            _id: "workspace_bootstrap",
            name: request.args.params.workspaceName || "Bootstrap Workspace",
            role: "admin",
          });
          activeWorkspaceId = "workspace_bootstrap";
        }

        return new Response(
          JSON.stringify({
            status: "success",
            value: {
              tokens: {
                token: tokenValue,
                refreshToken: "refresh-token",
              },
            },
          }),
          { status: 200 }
        );
      }

      if (request.path === "auth:currentUser") {
        if (requireWorkspaceCreation && !workspaces.length) {
          return new Response(
            JSON.stringify({
              user: {
                _id: "user_1",
                workspaceId: null,
              },
              workspaces: [],
            }),
            { status: 200 }
          );
        }

        return new Response(
          JSON.stringify({
            user: {
              _id: "user_1",
              email: authAttempts > 0 ? "admin@example.com" : "unknown@example.com",
              workspaceId: activeWorkspaceId,
            },
            workspaces,
          }),
          { status: 200 }
        );
      }

      if (request.path === "workspaces:create") {
        const created = {
          _id: "workspace_created",
          name: request.args.name,
          role: "owner",
        };
        workspaces.push(created);
        activeWorkspaceId = created._id;
        return new Response(JSON.stringify(created._id), { status: 200 });
      }

      if (request.path === "auth:switchWorkspace") {
        activeWorkspaceId = request.args.workspaceId;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      throw new Error(`Unexpected fetch path: ${request.path}`);
    },
  };

  return {
    commands,
    envStore,
    getFileContents,
    runtime,
  };
}

test("clean-environment setup configures deployment, auth env, and local files", async () => {
  const rootDir = await createTempRepo();
  const harness = createHarness({
    rootDir,
    backendEnv: {},
    setupState: { hasUsers: false, hasWorkspaces: false },
    workspaces: [],
  });

  await runSetup(
    {
      adminEmail: "admin@example.com",
      adminPassword: "Opencom!123",
      adminName: "Admin User",
      workspaceName: "Fresh Workspace",
      nonInteractive: true,
      skipDev: true,
    },
    harness.runtime
  );

  assert.equal(harness.envStore.AUTH_SECRET, "generated-auth-secret");
  assert.equal(harness.envStore.SITE_URL, "http://localhost:3000");
  assert.ok(
    harness.commands.some((command) => command.join(" ") === "pnpm install"),
    "expected pnpm install to run"
  );
  assert.ok(
    harness.commands.some(
      (command) => command.join(" ") === "pnpm --filter @opencom/convex exec convex dev --once"
    ),
    "expected convex dev --once to run"
  );

  const webEnv = await readEnvFile(path.join(rootDir, "apps/web/.env.local"));
  const convexEnv = await readEnvFile(path.join(rootDir, "packages/convex/.env.local"));

  assert.equal(webEnv.NEXT_PUBLIC_CONVEX_URL, "https://opencom-test.convex.cloud");
  assert.equal(webEnv.NEXT_PUBLIC_TEST_WORKSPACE_ID, "workspace_bootstrap");
  assert.equal(convexEnv.CONVEX_DEPLOYMENT, "dev:opencom-test");
  assert.equal(convexEnv.CONVEX_URL, "https://opencom-test.convex.cloud");
  assert.equal(convexEnv.WORKSPACE_ID, "workspace_bootstrap");
  assert.equal(convexEnv.E2E_BACKEND_URL, "https://opencom-test.convex.cloud");
});

test("rerun setup reuses existing deployment and preserves unrelated env entries", async () => {
  const rootDir = await createTempRepo();
  await fs.writeFile(
    path.join(rootDir, "packages/convex/.env.local"),
    [
      "# Keep this comment",
      'CUSTOM_KEEP="yes"',
      'CONVEX_DEPLOYMENT="dev:existing"',
      'CONVEX_URL="https://existing.convex.cloud"',
    ].join("\n") + "\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "apps/web/.env.local"),
    ["# Existing web comment", 'MANUAL_FLAG="keep-me"', 'NEXT_PUBLIC_CONVEX_URL="stale"'].join(
      "\n"
    ) + "\n",
    "utf8"
  );

  const harness = createHarness({
    rootDir,
    backendEnv: {
      AUTH_SECRET: "already-configured",
      SITE_URL: "http://localhost:3000",
    },
    setupState: { hasUsers: true, hasWorkspaces: true },
    workspaces: [
      { _id: "workspace_active", name: "Active Workspace", role: "admin" },
      { _id: "workspace_other", name: "Other Workspace", role: "agent" },
    ],
  });

  await runSetup(
    {
      adminEmail: "admin@example.com",
      adminPassword: "Opencom!123",
      nonInteractive: true,
      skipDev: true,
    },
    harness.runtime
  );

  assert.ok(
    !harness.commands.some(
      (command) => command.join(" ") === "pnpm --filter @opencom/convex exec convex dev --once"
    ),
    "expected existing deployment to be reused without reconfiguration"
  );

  const convexContent = await harness.getFileContents("packages/convex/.env.local");
  const webContent = await harness.getFileContents("apps/web/.env.local");
  const webEnv = parseEnvContent(webContent);

  assert.match(convexContent, /# Keep this comment/);
  assert.match(convexContent, /CUSTOM_KEEP="yes"/);
  assert.match(webContent, /# Existing web comment/);
  assert.match(webContent, /MANUAL_FLAG="keep-me"/);
  assert.equal(webEnv.NEXT_PUBLIC_TEST_WORKSPACE_ID, "workspace_active");
  assert.equal(webEnv.NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL, "https://existing.convex.cloud");
});

test("setup surfaces actionable errors when auth sign-in fails", async () => {
  const rootDir = await createTempRepo();
  const harness = createHarness({
    rootDir,
    initialConvexEnv: [
      'CONVEX_DEPLOYMENT="dev:existing"',
      'CONVEX_URL="https://existing.convex.cloud"',
    ].join("\n"),
    backendEnv: {
      AUTH_SECRET: "already-configured",
      SITE_URL: "http://localhost:3000",
    },
    setupState: { hasUsers: true, hasWorkspaces: true },
    workspaces: [{ _id: "workspace_active", name: "Active Workspace", role: "admin" }],
    authError: "Invalid credentials",
  });

  await assert.rejects(
    () =>
      runSetup(
        {
          adminEmail: "admin@example.com",
          adminPassword: "wrong-password",
          nonInteractive: true,
          skipDev: true,
        },
        harness.runtime
      ),
    (error) => {
      assert.ok(error instanceof SetupError);
      assert.match(error.summary, /Invalid credentials/i);
      assert.match(error.why, /Convex Auth password sign-in\/sign-up path/i);
      assert.ok(error.fix.some((step) => /existing admin account/i.test(step)));
      return true;
    }
  );
});

test("update-env writes all local targets without deleting unrelated keys or comments", async () => {
  const rootDir = await createTempRepo();
  await fs.writeFile(
    path.join(rootDir, "apps/landing/.env.local"),
    ["# Manual landing note", 'NEXT_PUBLIC_WIDGET_URL="https://cdn.example/widget.js"'].join("\n") +
      "\n",
    "utf8"
  );

  const runtime = {
    rootDir,
    output: {
      isTTY: false,
      write() {},
    },
    ui: {
      async close() {},
    },
    log() {},
    warn() {},
    error() {},
    async exists(filePath) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    async readFile(filePath, encoding = "utf8") {
      return fs.readFile(filePath, encoding);
    },
    async writeFile(filePath, contents) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, contents, "utf8");
    },
  };

  await runUpdateEnv(
    {
      convexUrl: "https://manual.convex.cloud",
      workspaceId: "workspace_sync",
      nonInteractive: true,
    },
    runtime
  );

  const landingContent = await fs.readFile(path.join(rootDir, "apps/landing/.env.local"), "utf8");
  const landingEnv = parseEnvContent(landingContent);
  const widgetEnv = await readEnvFile(path.join(rootDir, "apps/widget/.env.local"));
  const convexEnv = await readEnvFile(path.join(rootDir, "packages/convex/.env.local"));

  assert.match(landingContent, /# Manual landing note/);
  assert.match(landingContent, /NEXT_PUBLIC_WIDGET_URL="https:\/\/cdn.example\/widget.js"/);
  assert.equal(landingEnv.NEXT_PUBLIC_CONVEX_URL, "https://manual.convex.cloud");
  assert.equal(landingEnv.NEXT_PUBLIC_WORKSPACE_ID, "workspace_sync");
  assert.equal(widgetEnv.VITE_WORKSPACE_ID, "workspace_sync");
  assert.equal(convexEnv.E2E_BACKEND_URL, "https://manual.convex.cloud");
  assert.equal(convexEnv.WORKSPACE_ID, "workspace_sync");
});

test("mergeEnvFileContent updates managed keys in place and appends missing ones once", () => {
  const merged = mergeEnvFileContent(
    ["# Existing", 'KEEP_ME="1"', 'NEXT_PUBLIC_CONVEX_URL="old"'].join("\n") + "\n",
    {
      NEXT_PUBLIC_CONVEX_URL: "https://fresh.convex.cloud",
      NEXT_PUBLIC_TEST_WORKSPACE_ID: "workspace_123",
    },
    "Managed block"
  );

  const env = parseEnvContent(merged);
  assert.match(merged, /# Existing/);
  assert.match(merged, /KEEP_ME="1"/);
  assert.equal(env.NEXT_PUBLIC_CONVEX_URL, "https://fresh.convex.cloud");
  assert.equal(env.NEXT_PUBLIC_TEST_WORKSPACE_ID, "workspace_123");
  assert.equal((merged.match(/Managed block/g) || []).length, 1);
});
