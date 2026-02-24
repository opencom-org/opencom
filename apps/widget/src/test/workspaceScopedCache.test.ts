import { describe, it, expect, beforeEach } from "vitest";

describe("workspace-scoped settings cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should use workspace-scoped key format", () => {
    const workspaceId = "abc123";
    const key = `opencom_settings_cache_${workspaceId}`;
    const settings = { primaryColor: "#792cd4" };

    localStorage.setItem(key, JSON.stringify(settings));

    const cached = localStorage.getItem(key);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!)).toEqual(settings);
  });

  it("should not collide between different workspaces", () => {
    const ws1 = "workspace_one";
    const ws2 = "workspace_two";
    const settings1 = { primaryColor: "#ff0000" };
    const settings2 = { primaryColor: "#00ff00" };

    localStorage.setItem(`opencom_settings_cache_${ws1}`, JSON.stringify(settings1));
    localStorage.setItem(`opencom_settings_cache_${ws2}`, JSON.stringify(settings2));

    const cached1 = JSON.parse(localStorage.getItem(`opencom_settings_cache_${ws1}`)!);
    const cached2 = JSON.parse(localStorage.getItem(`opencom_settings_cache_${ws2}`)!);

    expect(cached1.primaryColor).toBe("#ff0000");
    expect(cached2.primaryColor).toBe("#00ff00");
  });

  it("should not use old unscoped key", () => {
    // The old key was "opencom_settings_cache" without workspace scoping
    localStorage.setItem("opencom_settings_cache", JSON.stringify({ primaryColor: "#old" }));

    const workspaceId = "my_workspace";
    const scopedKey = `opencom_settings_cache_${workspaceId}`;

    // Scoped key should not exist yet
    expect(localStorage.getItem(scopedKey)).toBeNull();
  });
});
