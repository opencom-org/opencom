import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TEAM_MEMBERS_SETTINGS_PATH = resolve(
  process.cwd(),
  "src/app/settings/useTeamMembersSettings.ts"
);
const EMAIL_CAMPAIGN_PAGE_PATH = resolve(
  process.cwd(),
  "src/app/campaigns/email/[id]/page.tsx"
);

describe("convex ref hardening guards", () => {
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
});
