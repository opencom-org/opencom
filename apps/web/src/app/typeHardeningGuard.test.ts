import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_SRC_DIR = resolve(APP_DIR, "..");

const WEB_CONVEX_ADAPTER_PATH = resolve(WEB_SRC_DIR, "lib/convex/hooks.ts");
const CONVEX_PROVIDER_PATH = resolve(WEB_SRC_DIR, "components/convex-provider.tsx");
const APPROVED_TEST_BOUNDARY_FILES = [
  resolve(APP_DIR, "settings/MessengerSettingsSection.test.tsx"),
  resolve(APP_DIR, "typeHardeningGuard.test.ts"),
];
const APPROVED_DIRECT_CONVEX_BOUNDARY_FILES = [
  WEB_CONVEX_ADAPTER_PATH,
  CONVEX_PROVIDER_PATH,
  ...APPROVED_TEST_BOUNDARY_FILES,
];

const WRAPPER_LAYER_FILES = [
  "app/articles/hooks/useArticleCollectionsConvex.ts",
  "app/articles/hooks/useArticleEditorConvex.ts",
  "app/articles/hooks/useArticlesAdminConvex.ts",
  "app/campaigns/hooks/useCampaignsPageConvex.ts",
  "app/campaigns/hooks/useCarouselEditorConvex.ts",
  "app/campaigns/hooks/useEmailCampaignEditorConvex.ts",
  "app/campaigns/hooks/usePushCampaignEditorConvex.ts",
  "app/campaigns/hooks/useSeriesEditorConvex.ts",
  "app/checklists/hooks/useChecklistBuilderConvex.ts",
  "app/checklists/hooks/useChecklistsPageConvex.ts",
  "app/help/hooks/useHelpCenterConvex.ts",
  "app/inbox/hooks/useInboxConversationListPaneConvex.ts",
  "app/inbox/hooks/useInboxConvex.ts",
  "app/onboarding/hooks/useOnboardingConvex.ts",
  "app/outbound/hooks/useOutboundMessageEditorConvex.ts",
  "app/outbound/hooks/useOutboundMessagesPageConvex.ts",
  "app/reports/hooks/useReportsConvex.ts",
  "app/segments/hooks/useSegmentsPageConvex.ts",
  "app/settings/hooks/useMessengerSettingsConvex.ts",
  "app/settings/hooks/useSettingsPageConvex.ts",
  "app/settings/hooks/useSettingsSectionsConvex.ts",
  "app/snippets/hooks/useSnippetsPageConvex.ts",
  "app/surveys/hooks/useSurveysConvex.ts",
  "app/tickets/hooks/useTicketsConvex.ts",
  "app/tooltips/hooks/useTooltipsConvex.ts",
  "app/tours/hooks/useToursConvex.ts",
  "app/visitors/hooks/useVisitorsConvex.ts",
  "components/hooks/useAppSidebarConvex.ts",
  "components/hooks/useAudienceRuleBuilderConvex.ts",
  "components/hooks/useSuggestionsPanelConvex.ts",
  "components/hooks/useWorkspaceSelectorConvex.ts",
  "contexts/hooks/useAuthConvex.ts",
].map((path) => resolve(WEB_SRC_DIR, path));

const MIGRATED_WEB_CONSUMERS = [
  ["app/articles/[id]/page.tsx", "useArticleEditorConvex"],
  ["app/articles/collections/page.tsx", "useArticleCollectionsConvex"],
  ["app/articles/page.tsx", "useArticlesAdminConvex"],
  ["app/campaigns/carousels/[id]/page.tsx", "useCarouselEditorConvex"],
  ["app/campaigns/email/[id]/page.tsx", "useEmailCampaignEditorConvex"],
  ["app/campaigns/page.tsx", "useCampaignsPageConvex"],
  ["app/campaigns/push/[id]/page.tsx", "usePushCampaignEditorConvex"],
  ["app/campaigns/series/[id]/page.tsx", "useSeriesEditorConvex"],
  ["app/checklists/[id]/page.tsx", "useChecklistBuilderConvex"],
  ["app/checklists/page.tsx", "useChecklistsPageConvex"],
  ["app/help/[slug]/page.tsx", "useHelpArticlePageConvex"],
  ["app/help/page.tsx", "useHelpCenterPageConvex"],
  ["app/inbox/InboxConversationListPane.tsx", "useInboxConversationListPaneConvex"],
  ["app/inbox/page.tsx", "useInboxConvex"],
  ["app/onboarding/page.tsx", "useOnboardingConvex"],
  ["app/outbound/[id]/page.tsx", "useOutboundMessageEditorController"],
  ["app/outbound/page.tsx", "useOutboundMessagesPageConvex"],
  ["app/reports/ai/page.tsx", "useAiReportConvex"],
  ["app/reports/conversations/page.tsx", "useConversationsReportConvex"],
  ["app/reports/csat/page.tsx", "useCsatReportConvex"],
  ["app/reports/page.tsx", "useReportsPageConvex"],
  ["app/reports/team/page.tsx", "useTeamReportConvex"],
  ["app/segments/page.tsx", "useSegmentsListConvex"],
  ["app/settings/AIAgentSection.tsx", "useAIAgentSectionConvex"],
  ["app/settings/AuditLogViewer.tsx", "useAuditLogViewerConvex"],
  ["app/settings/AutomationSettingsSection.tsx", "useAutomationSettingsSectionConvex"],
  ["app/settings/HomeSettingsSection.tsx", "useHomeSettingsSectionConvex"],
  ["app/settings/MessengerSettingsSection.tsx", "useMessengerSettingsConvex"],
  ["app/settings/MobileDevicesSection.tsx", "useMobileDevicesSectionConvex"],
  ["app/settings/NotificationSettingsSection.tsx", "useNotificationSettingsSectionConvex"],
  ["app/settings/SecurityIdentitySettingsCard.tsx", "useSecurityIdentitySettingsCardConvex"],
  ["app/settings/SecuritySettingsSection.tsx", "useSecuritySettingsSectionConvex"],
  ["app/settings/SignedSessionsSettings.tsx", "useSignedSessionsSettingsConvex"],
  ["app/settings/page.tsx", "useSettingsPageController"],
  ["app/settings/useTeamMembersSettings.ts", "useTeamMembersSettingsConvex"],
  ["app/snippets/page.tsx", "useSnippetsPageConvex"],
  ["app/surveys/[id]/page.tsx", "useSurveyBuilderConvex"],
  ["app/surveys/page.tsx", "useSurveysPageConvex"],
  ["app/tickets/[id]/page.tsx", "useTicketDetailConvex"],
  ["app/tickets/forms/page.tsx", "useTicketFormsPageConvex"],
  ["app/tickets/page.tsx", "useTicketsPageConvex"],
  ["app/tooltips/page.tsx", "useTooltipsConvex"],
  ["app/tours/[id]/page.tsx", "useTourEditorConvex"],
  ["app/tours/page.tsx", "useToursPageConvex"],
  ["app/visitors/[id]/page.tsx", "useVisitorDetailConvex"],
  ["app/visitors/page.tsx", "useVisitorsPageConvex"],
  ["components/AppSidebar.tsx", "useAppSidebarConvex"],
  ["components/AudienceRuleBuilder.tsx", "useAudienceRuleBuilderConvex"],
  ["components/SuggestionsPanel.tsx", "useSuggestionsPanelConvex"],
  ["components/WorkspaceSelector.tsx", "useWorkspaceSelectorConvex"],
  ["contexts/AuthContext.tsx", "useAuthConvex"],
] as const;

const COMPONENT_SCOPED_CONVEX_REF_PATTERNS = [
  /^\s{2,}(const|let)\s+\w+\s*=\s*(makeFunctionReference|web(?:Query|Mutation|Action)Ref|widget(?:Query|Mutation|Action)Ref)(?:<|\()/,
  /use(?:Query|Mutation|Action)\(\s*(makeFunctionReference|web(?:Query|Mutation|Action)Ref|widget(?:Query|Mutation|Action)Ref)(?:<|\()/,
];

const DIRECT_CONVEX_IMPORT_PATTERN = /from ["']convex\/react["']/;
const DIRECT_REF_FACTORY_PATTERN = /\bmakeFunctionReference(?:\s*<[\s\S]*?>)?\s*\(/;
const WEB_ADAPTER_HOOK_PATTERN = /\buseWeb(?:Query|Mutation|Action)\b/;
const WEB_ADAPTER_REF_PATTERN = /\bweb(?:Query|Mutation|Action)Ref\b/;

function collectSourceFiles(dir: string, includeTests = true): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath, includeTests);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (
      !includeTests &&
      (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx"))
    ) {
      return [];
    }

    const extension = extname(entry.name);
    return extension === ".ts" || extension === ".tsx" ? [entryPath] : [];
  });
}

function isApprovedDirectConvexBoundary(filePath: string): boolean {
  return APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.includes(filePath);
}

function findUnexpectedWebDirectConvexBoundaries(): string[] {
  return collectSourceFiles(WEB_SRC_DIR).flatMap((filePath) => {
    if (isApprovedDirectConvexBoundary(filePath)) {
      return [];
    }

    const source = readFileSync(filePath, "utf8");
    const violations: string[] = [];

    if (DIRECT_CONVEX_IMPORT_PATTERN.test(source)) {
      violations.push(`${relative(WEB_SRC_DIR, filePath)}: direct convex/react import`);
    }

    if (DIRECT_REF_FACTORY_PATTERN.test(source)) {
      violations.push(`${relative(WEB_SRC_DIR, filePath)}: direct makeFunctionReference call`);
    }

    return violations;
  });
}

function findComponentScopedConvexRefs(dir: string): string[] {
  return collectSourceFiles(dir, false).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return source.split("\n").flatMap((line, index) =>
      COMPONENT_SCOPED_CONVEX_REF_PATTERNS.some((pattern) => pattern.test(line))
        ? [`${relative(WEB_SRC_DIR, filePath)}:${index + 1}`]
        : []
    );
  });
}

describe("convex ref hardening guards", () => {
  it("keeps web React files free of component-scoped convex ref factories", () => {
    expect(findComponentScopedConvexRefs(WEB_SRC_DIR)).toEqual([]);
  });

  it("keeps direct convex imports and ref factories limited to approved boundaries", () => {
    expect(findUnexpectedWebDirectConvexBoundaries()).toEqual([]);
  });

  it("keeps the approved March 11, 2026 direct Convex boundaries explicit", () => {
    expect(
      APPROVED_DIRECT_CONVEX_BOUNDARY_FILES.map((filePath) => relative(WEB_SRC_DIR, filePath))
    ).toEqual([
      "lib/convex/hooks.ts",
      "components/convex-provider.tsx",
      "app/settings/MessengerSettingsSection.test.tsx",
      "app/typeHardeningGuard.test.ts",
    ]);
  });

  it("keeps migrated web consumers on local wrapper or controller hooks", () => {
    for (const [relativePath, marker] of MIGRATED_WEB_CONSUMERS) {
      const source = readFileSync(resolve(WEB_SRC_DIR, relativePath), "utf8");

      expect(source).not.toContain('from "convex/react"');
      expect(source).not.toContain("makeFunctionReference(");
      expect(source).toContain(marker);
    }
  });

  it("keeps web adapter escape hatches centralized in wrapper files", () => {
    const adapterSource = readFileSync(WEB_CONVEX_ADAPTER_PATH, "utf8");

    expect(adapterSource).toContain("export function webQueryRef");
    expect(adapterSource).toContain("export function webMutationRef");
    expect(adapterSource).toContain("export function webActionRef");
    expect(adapterSource).toContain("export function useWebQuery");
    expect(adapterSource).toContain("export function useWebMutation");
    expect(adapterSource).toContain("export function useWebAction");

    for (const filePath of WRAPPER_LAYER_FILES) {
      const source = readFileSync(filePath, "utf8");

      expect(WEB_ADAPTER_HOOK_PATTERN.test(source)).toBe(true);
      expect(WEB_ADAPTER_REF_PATTERN.test(source)).toBe(true);
    }
  });
});
