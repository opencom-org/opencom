import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_SRC_DIR = resolve(APP_DIR, "..");

const TEAM_MEMBERS_SETTINGS_PATH = resolve(APP_DIR, "settings/useTeamMembersSettings.ts");
const WEB_CONVEX_ADAPTER_PATH = resolve(APP_DIR, "../lib/convex/hooks.ts");
const SETTINGS_PAGE_PATH = resolve(APP_DIR, "settings/page.tsx");
const SETTINGS_PAGE_CONVEX_PATH = resolve(APP_DIR, "settings/hooks/useSettingsPageConvex.ts");
const SETTINGS_PAGE_CONTROLLER_PATH = resolve(APP_DIR, "settings/hooks/useSettingsPageController.ts");
const MESSENGER_SETTINGS_SECTION_PATH = resolve(APP_DIR, "settings/MessengerSettingsSection.tsx");
const MESSENGER_SETTINGS_CONVEX_PATH = resolve(
  APP_DIR,
  "settings/hooks/useMessengerSettingsConvex.ts"
);
const INBOX_PAGE_PATH = resolve(APP_DIR, "inbox/page.tsx");
const INBOX_CONVEX_PATH = resolve(APP_DIR, "inbox/hooks/useInboxConvex.ts");
const ARTICLES_PAGE_PATH = resolve(APP_DIR, "articles/page.tsx");
const ARTICLES_CONVEX_PATH = resolve(APP_DIR, "articles/hooks/useArticlesAdminConvex.ts");
const ARTICLE_EDITOR_PAGE_PATH = resolve(APP_DIR, "articles/[id]/page.tsx");
const ARTICLE_EDITOR_CONVEX_PATH = resolve(
  APP_DIR,
  "articles/hooks/useArticleEditorConvex.ts"
);
const ARTICLE_COLLECTIONS_PAGE_PATH = resolve(APP_DIR, "articles/collections/page.tsx");
const ARTICLE_COLLECTIONS_CONVEX_PATH = resolve(
  APP_DIR,
  "articles/hooks/useArticleCollectionsConvex.ts"
);
const CHECKLISTS_PAGE_PATH = resolve(APP_DIR, "checklists/page.tsx");
const CHECKLISTS_CONVEX_PATH = resolve(APP_DIR, "checklists/hooks/useChecklistsPageConvex.ts");
const CHECKLIST_BUILDER_PAGE_PATH = resolve(APP_DIR, "checklists/[id]/page.tsx");
const CHECKLIST_BUILDER_CONVEX_PATH = resolve(
  APP_DIR,
  "checklists/hooks/useChecklistBuilderConvex.ts"
);
const CAMPAIGNS_PAGE_PATH = resolve(APP_DIR, "campaigns/page.tsx");
const CAMPAIGNS_CONVEX_PATH = resolve(APP_DIR, "campaigns/hooks/useCampaignsPageConvex.ts");
const PUSH_CAMPAIGN_PAGE_PATH = resolve(APP_DIR, "campaigns/push/[id]/page.tsx");
const PUSH_CAMPAIGN_CONVEX_PATH = resolve(
  APP_DIR,
  "campaigns/hooks/usePushCampaignEditorConvex.ts"
);
const CAROUSEL_PAGE_PATH = resolve(APP_DIR, "campaigns/carousels/[id]/page.tsx");
const CAROUSEL_CONVEX_PATH = resolve(
  APP_DIR,
  "campaigns/hooks/useCarouselEditorConvex.ts"
);
const SERIES_PAGE_PATH = resolve(APP_DIR, "campaigns/series/[id]/page.tsx");
const SERIES_CONVEX_PATH = resolve(APP_DIR, "campaigns/hooks/useSeriesEditorConvex.ts");
const TOOLTIPS_PAGE_PATH = resolve(APP_DIR, "tooltips/page.tsx");
const TOOLTIPS_CONVEX_PATH = resolve(APP_DIR, "tooltips/hooks/useTooltipsConvex.ts");
const OUTBOUND_PAGE_PATH = resolve(APP_DIR, "outbound/[id]/page.tsx");
const OUTBOUND_CONTROLLER_PATH = resolve(
  APP_DIR,
  "outbound/hooks/useOutboundMessageEditorController.ts"
);
const OUTBOUND_CONVEX_PATH = resolve(
  APP_DIR,
  "outbound/hooks/useOutboundMessageEditorConvex.ts"
);
const EMAIL_CAMPAIGN_PAGE_PATH = resolve(APP_DIR, "campaigns/email/[id]/page.tsx");

const COMPONENT_SCOPED_CONVEX_REF_PATTERNS = [
  /^\s{2,}(const|let)\s+\w+\s*=\s*(makeFunctionReference|web(?:Query|Mutation|Action)Ref|widget(?:Query|Mutation|Action)Ref)(?:<|\()/,
  /use(?:Query|Mutation|Action)\(\s*(makeFunctionReference|web(?:Query|Mutation|Action)Ref|widget(?:Query|Mutation|Action)Ref)(?:<|\()/,
];

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    if (!entry.isFile()) {
      return [];
    }

    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
      return [];
    }

    const extension = extname(entry.name);
    return extension === ".ts" || extension === ".tsx" ? [entryPath] : [];
  });
}

function findComponentScopedConvexRefs(dir: string): string[] {
  return collectSourceFiles(dir).flatMap((filePath) => {
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

  it("keeps settings team-members on fixed refs without generic name helpers", () => {
    const source = readFileSync(TEAM_MEMBERS_SETTINGS_PATH, "utf8");

    expect(source).not.toContain("function getActionRef(name: string)");
    expect(source).not.toContain("function getMutationRef(name: string)");
    expect(source).not.toMatch(/\sas\s+[A-Za-z0-9_]+Fn/g);
    expect(source).toContain("INVITE_TO_WORKSPACE_REF");
    expect(source).toContain("UPDATE_ROLE_REF");
  });

  it("keeps email campaign mutations free of page-level any/unknown refs", () => {
    const source = readFileSync(EMAIL_CAMPAIGN_PAGE_PATH, "utf8");

    expect(source).not.toMatch(/makeFunctionReference<"mutation",\s*any,\s*unknown>/);
    expect(source).toContain("type UpdateCampaignArgs");
    expect(source).toContain("type SendCampaignResult");
  });

  it("keeps migrated settings and inbox UI files on local convex wrappers", () => {
    const settingsPageSource = readFileSync(SETTINGS_PAGE_PATH, "utf8");
    const settingsPageControllerSource = readFileSync(SETTINGS_PAGE_CONTROLLER_PATH, "utf8");
    const messengerSettingsSectionSource = readFileSync(MESSENGER_SETTINGS_SECTION_PATH, "utf8");
    const inboxPageSource = readFileSync(INBOX_PAGE_PATH, "utf8");
    const articlesPageSource = readFileSync(ARTICLES_PAGE_PATH, "utf8");
    const articleEditorPageSource = readFileSync(ARTICLE_EDITOR_PAGE_PATH, "utf8");
    const articleCollectionsPageSource = readFileSync(ARTICLE_COLLECTIONS_PAGE_PATH, "utf8");
    const checklistsPageSource = readFileSync(CHECKLISTS_PAGE_PATH, "utf8");
    const checklistBuilderPageSource = readFileSync(CHECKLIST_BUILDER_PAGE_PATH, "utf8");
    const campaignsPageSource = readFileSync(CAMPAIGNS_PAGE_PATH, "utf8");
    const pushCampaignPageSource = readFileSync(PUSH_CAMPAIGN_PAGE_PATH, "utf8");
    const carouselPageSource = readFileSync(CAROUSEL_PAGE_PATH, "utf8");
    const seriesPageSource = readFileSync(SERIES_PAGE_PATH, "utf8");
    const tooltipsPageSource = readFileSync(TOOLTIPS_PAGE_PATH, "utf8");
    const outboundPageSource = readFileSync(OUTBOUND_PAGE_PATH, "utf8");
    const outboundControllerSource = readFileSync(OUTBOUND_CONTROLLER_PATH, "utf8");

    expect(settingsPageSource).not.toContain('from "convex/react"');
    expect(settingsPageSource).not.toContain("makeFunctionReference(");
    expect(settingsPageSource).toContain("useSettingsPageController");
    expect(settingsPageControllerSource).toContain("useSettingsPageConvex");
    expect(settingsPageControllerSource).toContain("useTeamMembersSettings");

    expect(messengerSettingsSectionSource).not.toContain('from "convex/react"');
    expect(messengerSettingsSectionSource).not.toContain("makeFunctionReference(");
    expect(messengerSettingsSectionSource).toContain("useMessengerSettingsConvex");

    expect(inboxPageSource).not.toContain('from "convex/react"');
    expect(inboxPageSource).not.toContain("makeFunctionReference(");
    expect(inboxPageSource).toContain("useInboxConvex");

    expect(articlesPageSource).not.toContain('from "convex/react"');
    expect(articlesPageSource).not.toContain("makeFunctionReference(");
    expect(articlesPageSource).toContain("useArticlesAdminConvex");

    expect(articleEditorPageSource).not.toContain('from "convex/react"');
    expect(articleEditorPageSource).not.toContain("makeFunctionReference(");
    expect(articleEditorPageSource).toContain("useArticleEditorConvex");

    expect(articleCollectionsPageSource).not.toContain('from "convex/react"');
    expect(articleCollectionsPageSource).not.toContain("makeFunctionReference(");
    expect(articleCollectionsPageSource).toContain("useArticleCollectionsConvex");

    expect(checklistsPageSource).not.toContain('from "convex/react"');
    expect(checklistsPageSource).not.toContain("makeFunctionReference(");
    expect(checklistsPageSource).toContain("useChecklistsPageConvex");

    expect(checklistBuilderPageSource).not.toContain('from "convex/react"');
    expect(checklistBuilderPageSource).not.toContain("makeFunctionReference(");
    expect(checklistBuilderPageSource).toContain("useChecklistBuilderConvex");

    expect(campaignsPageSource).not.toContain('from "convex/react"');
    expect(campaignsPageSource).not.toContain("makeFunctionReference(");
    expect(campaignsPageSource).toContain("useCampaignsPageConvex");

    expect(pushCampaignPageSource).not.toContain('from "convex/react"');
    expect(pushCampaignPageSource).not.toContain("makeFunctionReference(");
    expect(pushCampaignPageSource).toContain("usePushCampaignEditorConvex");

    expect(carouselPageSource).not.toContain('from "convex/react"');
    expect(carouselPageSource).not.toContain("makeFunctionReference(");
    expect(carouselPageSource).toContain("useCarouselEditorConvex");

    expect(seriesPageSource).not.toContain('from "convex/react"');
    expect(seriesPageSource).not.toContain("makeFunctionReference(");
    expect(seriesPageSource).toContain("useSeriesEditorConvex");

    expect(tooltipsPageSource).not.toContain('from "convex/react"');
    expect(tooltipsPageSource).not.toContain("makeFunctionReference(");
    expect(tooltipsPageSource).not.toContain("function getQueryRef(name: string)");
    expect(tooltipsPageSource).not.toContain("function getMutationRef(name: string)");
    expect(tooltipsPageSource).toContain("useTooltipsConvex");

    expect(outboundPageSource).not.toContain('from "convex/react"');
    expect(outboundPageSource).not.toContain("makeFunctionReference(");
    expect(outboundPageSource).toContain("useOutboundMessageEditorController");
    expect(outboundControllerSource).toContain("useOutboundMessageEditorConvex");
  });

  it("keeps web convex escape hatches centralized in the adapter and wrapper layer", () => {
    const adapterSource = readFileSync(WEB_CONVEX_ADAPTER_PATH, "utf8");
    const settingsPageConvexSource = readFileSync(SETTINGS_PAGE_CONVEX_PATH, "utf8");
    const messengerSettingsConvexSource = readFileSync(MESSENGER_SETTINGS_CONVEX_PATH, "utf8");
    const inboxConvexSource = readFileSync(INBOX_CONVEX_PATH, "utf8");
    const articlesConvexSource = readFileSync(ARTICLES_CONVEX_PATH, "utf8");
    const articleEditorConvexSource = readFileSync(ARTICLE_EDITOR_CONVEX_PATH, "utf8");
    const articleCollectionsConvexSource = readFileSync(ARTICLE_COLLECTIONS_CONVEX_PATH, "utf8");
    const checklistsConvexSource = readFileSync(CHECKLISTS_CONVEX_PATH, "utf8");
    const checklistBuilderConvexSource = readFileSync(CHECKLIST_BUILDER_CONVEX_PATH, "utf8");
    const campaignsConvexSource = readFileSync(CAMPAIGNS_CONVEX_PATH, "utf8");
    const pushCampaignConvexSource = readFileSync(PUSH_CAMPAIGN_CONVEX_PATH, "utf8");
    const carouselConvexSource = readFileSync(CAROUSEL_CONVEX_PATH, "utf8");
    const seriesConvexSource = readFileSync(SERIES_CONVEX_PATH, "utf8");
    const tooltipsConvexSource = readFileSync(TOOLTIPS_CONVEX_PATH, "utf8");
    const outboundConvexSource = readFileSync(OUTBOUND_CONVEX_PATH, "utf8");

    expect(adapterSource).toContain("export function webQueryRef");
    expect(adapterSource).toContain("export function webMutationRef");
    expect(adapterSource).toContain("export function webActionRef");
    expect(adapterSource).toContain("export function useWebQuery");
    expect(adapterSource).toContain("export function useWebMutation");
    expect(adapterSource).toContain("export function useWebAction");

    expect(settingsPageConvexSource).toContain("useWebQuery");
    expect(settingsPageConvexSource).toContain("useWebMutation");
    expect(messengerSettingsConvexSource).toContain("useWebQuery");
    expect(messengerSettingsConvexSource).toContain("useWebMutation");
    expect(inboxConvexSource).toContain("useWebQuery");
    expect(inboxConvexSource).toContain("useWebMutation");
    expect(inboxConvexSource).toContain("useWebAction");
    expect(articlesConvexSource).toContain("useWebQuery");
    expect(articlesConvexSource).toContain("useWebMutation");
    expect(articleEditorConvexSource).toContain("useWebQuery");
    expect(articleEditorConvexSource).toContain("useWebMutation");
    expect(articleCollectionsConvexSource).toContain("useWebQuery");
    expect(articleCollectionsConvexSource).toContain("useWebMutation");
    expect(checklistsConvexSource).toContain("useWebQuery");
    expect(checklistsConvexSource).toContain("useWebMutation");
    expect(checklistBuilderConvexSource).toContain("useWebQuery");
    expect(checklistBuilderConvexSource).toContain("useWebMutation");
    expect(campaignsConvexSource).toContain("useWebQuery");
    expect(campaignsConvexSource).toContain("useWebMutation");
    expect(pushCampaignConvexSource).toContain("useWebQuery");
    expect(pushCampaignConvexSource).toContain("useWebMutation");
    expect(carouselConvexSource).toContain("useWebQuery");
    expect(carouselConvexSource).toContain("useWebMutation");
    expect(seriesConvexSource).toContain("useWebQuery");
    expect(seriesConvexSource).toContain("useWebMutation");
    expect(tooltipsConvexSource).toContain("useWebQuery");
    expect(tooltipsConvexSource).toContain("useWebMutation");
    expect(outboundConvexSource).toContain("useWebQuery");
    expect(outboundConvexSource).toContain("useWebMutation");
  });
});
