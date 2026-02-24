#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_HEADERS = [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Strict-Transport-Security",
];

const REQUIRED_CSP_DIRECTIVES = [
  "default-src",
  "base-uri",
  "frame-ancestors",
  "form-action",
  "object-src",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
];

function fail(message) {
  console.error(`[security-headers-check] ${message}`);
  process.exit(1);
}

function normalizeHeaderMap(headers) {
  const map = new Map();
  for (const header of headers) {
    if (!header || typeof header !== "object" || !header.key) {
      continue;
    }
    map.set(String(header.key).toLowerCase(), String(header.value ?? ""));
  }
  return map;
}

async function validateWebNextConfig() {
  const webConfigPath = path.join(repoRoot, "apps", "web", "next.config.js");
  let nextConfig;
  try {
    nextConfig = require(webConfigPath);
  } catch (error) {
    fail(`Unable to load apps/web/next.config.js: ${error.message}`);
  }

  if (!nextConfig || typeof nextConfig.headers !== "function") {
    fail("apps/web/next.config.js must export an async headers() function.");
  }

  const headerEntries = await nextConfig.headers();
  if (!Array.isArray(headerEntries) || headerEntries.length === 0) {
    fail("apps/web headers() returned no header entries.");
  }

  const globalEntry = headerEntries.find((entry) => entry && entry.source === "/:path*");
  if (!globalEntry || !Array.isArray(globalEntry.headers)) {
    fail("apps/web headers() must define a global '/:path*' header policy.");
  }

  const headerMap = normalizeHeaderMap(globalEntry.headers);
  for (const requiredKey of REQUIRED_HEADERS) {
    if (!headerMap.has(requiredKey.toLowerCase())) {
      fail(`apps/web header policy missing required header: ${requiredKey}`);
    }
  }

  const csp = headerMap.get("content-security-policy");
  if (!csp) {
    fail("apps/web Content-Security-Policy header value is empty.");
  }

  const directives = csp
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/)[0].toLowerCase());

  for (const directive of REQUIRED_CSP_DIRECTIVES) {
    if (!directives.includes(directive)) {
      fail(`apps/web CSP missing required directive: ${directive}`);
    }
  }

  const scriptDirective = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("script-src"));

  if (!scriptDirective) {
    fail("apps/web CSP missing script-src directive.");
  }

  if (!scriptDirective.includes("'self'")) {
    fail("apps/web CSP script-src must include 'self'.");
  }

  if (scriptDirective.includes(" *") || scriptDirective.endsWith("*")) {
    fail("apps/web CSP script-src must not use wildcard sources.");
  }
}

function validateLandingRequirements() {
  const landingPolicyPath = path.join(
    repoRoot,
    "apps",
    "landing",
    "security-headers.requirements.json"
  );

  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(landingPolicyPath, "utf8"));
  } catch (error) {
    fail(`Unable to parse apps/landing/security-headers.requirements.json: ${error.message}`);
  }

  if (!policy || !Array.isArray(policy.requiredHeaders)) {
    fail("Landing security header requirements must include requiredHeaders[].");
  }

  const keys = new Set(
    policy.requiredHeaders
      .filter((item) => item && typeof item.key === "string")
      .map((item) => item.key.toLowerCase())
  );

  for (const requiredKey of REQUIRED_HEADERS) {
    if (!keys.has(requiredKey.toLowerCase())) {
      fail(`Landing header requirements missing key: ${requiredKey}`);
    }
  }
}

(async () => {
  await validateWebNextConfig();
  validateLandingRequirements();
  console.log("[security-headers-check] OK: web and landing header requirements validated.");
})().catch((error) => {
  fail(error?.message || String(error));
});
