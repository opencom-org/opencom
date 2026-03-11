import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT_DIR = resolve(MOBILE_SRC_DIR, "..");
const MOBILE_APP_DIR = resolve(MOBILE_ROOT_DIR, "app");

const MOBILE_CONVEX_ADAPTER_PATH = resolve(MOBILE_SRC_DIR, "lib/convex/hooks.ts");
const MOBILE_PROVIDER_BOUNDARY_PATH = resolve(MOBILE_ROOT_DIR, "app/_layout.tsx");
const APPROVED_DIRECT_CONVEX_BOUNDARY_FILES = [
  MOBILE_CONVEX_ADAPTER_PATH,
  MOBILE_PROVIDER_BOUNDARY_PATH,
  resolve(MOBILE_SRC_DIR, "typeHardeningGuard.test.ts"),
];

const WRAPPER_LAYER_FILES = [
  "hooks/convex/useAuthConvex.ts",
  "hooks/convex/useConversationConvex.ts",
  "hooks/convex/useInboxConvex.ts",
  "hooks/convex/useNotificationRegistrationConvex.ts",
  "hooks/convex/useOnboardingConvex.ts",
  "hooks/convex/useSettingsConvex.ts",
].map((path) => resolve(MOBILE_SRC_DIR, path));

const MIGRATED_MOBILE_CONSUMERS = [
  ["src/contexts/AuthContext.tsx", ["useAuthContextConvex", "useAuthHomeRouteConvex"]],
  ["src/contexts/NotificationContext.tsx", ["useNotificationRegistrationConvex"]],
  ["app/(app)/conversation/[id].tsx", ["useConversationConvex"]],
  ["app/(app)/index.tsx", ["useInboxConvex", "useVisitorPresenceConvex"]],
  ["app/(app)/onboarding.tsx", ["useOnboardingConvex"]],
  ["app/(app)/settings.tsx", ["useSettingsConvex"]],
] as const;

const DIRECT_CONVEX_IMPORT_PATTERN = /from ["']convex\/react["']/;
const DIRECT_REF_FACTORY_PATTERN = /\bmakeFunctionReference(?:\s*<[\s\S]*?>)?\s*\(/;
const MOBILE_ADAPTER_HOOK_PATTERN = /\buseMobile(?:Query|Mutation|Action)\b/;
const MOBILE_ADAPTER_REF_PATTERN = /\bmobile(?:Query|Mutation|Action)Ref\b/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    const extension = extname(entry.name);
    return extension === ".ts" || extension === ".tsx" ? [entryPath] : [];
  });
}

function isApprovedDirectConvexBoundary(filePath: string): boolean {
  return APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.includes(filePath);
}

function findUnexpectedMobileDirectConvexBoundaries(): string[] {
  return [...collectSourceFiles(MOBILE_APP_DIR), ...collectSourceFiles(MOBILE_SRC_DIR)].flatMap(
    (filePath) => {
      if (isApprovedDirectConvexBoundary(filePath)) {
        return [];
      }

      const source = readFileSync(filePath, "utf8");
      const violations: string[] = [];

      if (DIRECT_CONVEX_IMPORT_PATTERN.test(source)) {
        violations.push(`${relative(MOBILE_ROOT_DIR, filePath)}: direct convex/react import`);
      }

      if (DIRECT_REF_FACTORY_PATTERN.test(source)) {
        violations.push(
          `${relative(MOBILE_ROOT_DIR, filePath)}: direct makeFunctionReference call`
        );
      }

      return violations;
    }
  );
}

describe("mobile convex ref hardening guards", () => {
  it("keeps direct convex imports and ref factories limited to approved boundaries", () => {
    expect(findUnexpectedMobileDirectConvexBoundaries()).toEqual([]);
  });

  it("keeps the approved direct Convex boundaries explicit", () => {
    expect(
      APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.map((filePath) => relative(MOBILE_ROOT_DIR, filePath))
    ).toEqual(["src/lib/convex/hooks.ts", "app/_layout.tsx", "src/typeHardeningGuard.test.ts"]);
  });

  it("provides a mobile-local Convex adapter layer for typed wrapper hooks", () => {
    const source = readFileSync(MOBILE_CONVEX_ADAPTER_PATH, "utf8");

    expect(source).toContain("export function mobileQueryRef");
    expect(source).toContain("export function mobileMutationRef");
    expect(source).toContain("export function mobileActionRef");
    expect(source).toContain("export function useMobileQuery");
    expect(source).toContain("export function useMobileMutation");
    expect(source).toContain("export function useMobileAction");
    expect(source).toContain("function toMobileQueryArgs");
    expect(source).toContain("OptionalRestArgsOrSkip");
  });

  it("keeps wrapper-layer escape hatches in mobile-local wrapper files", () => {
    for (const filePath of WRAPPER_LAYER_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(MOBILE_ADAPTER_HOOK_PATTERN.test(source)).toBe(true);
      expect(MOBILE_ADAPTER_REF_PATTERN.test(source)).toBe(true);
    }
  });

  it("keeps migrated mobile consumers on local wrapper hooks", () => {
    for (const [relativePath, markers] of MIGRATED_MOBILE_CONSUMERS) {
      const source = readFileSync(resolve(MOBILE_ROOT_DIR, relativePath), "utf8");

      expect(source).not.toContain('from "convex/react"');
      expect(source).not.toContain("makeFunctionReference(");

      for (const marker of markers) {
        expect(source).toContain(marker);
      }
    }
  });
});
