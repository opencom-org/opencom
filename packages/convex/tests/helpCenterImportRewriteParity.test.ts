import { describe, expect, it } from "vitest";
import {
  rewriteAssetReferencesForExport,
  rewriteMarkdownImageReferences,
} from "../convex/helpCenterImports/referenceRewrite";

describe("help center import/export rewrite parity", () => {
  it("rewrites markdown and html image references from fixture cases", () => {
    const fixtures: Array<{
      name: string;
      markdownPath: string;
      content: string;
      assetReferenceByPath: Map<string, string>;
      expectedContent: string;
      expectedUnresolved: string[];
    }> = [
      {
        name: "rewrites markdown + html relative images",
        markdownPath: "docs/guides/install.md",
        content: [
          "![Diagram](./images/diagram.png)",
          "<img alt=\"Chart\" src=\"../assets/chart.png\" />",
        ].join("\n"),
        assetReferenceByPath: new Map([
          ["docs/guides/images/diagram.png", "oc-asset://diagram-1"],
          ["docs/assets/chart.png", "oc-asset://chart-1"],
        ]),
        expectedContent: [
          "![Diagram](oc-asset://diagram-1)",
          "<img alt=\"Chart\" src=\"oc-asset://chart-1\" />",
        ].join("\n"),
        expectedUnresolved: [],
      },
      {
        name: "keeps wrapped paths and title suffixes",
        markdownPath: "docs/guides/install.md",
        content: "![Preview](<../assets/diagram one.png> \"Large\")",
        assetReferenceByPath: new Map([
          ["docs/assets/diagram one.png", "oc-asset://diagram-with-space"],
        ]),
        expectedContent: "![Preview](<oc-asset://diagram-with-space> \"Large\")",
        expectedUnresolved: [],
      },
      {
        name: "reports unresolved references with file context",
        markdownPath: "docs/guides/install.md",
        content: [
          "![Missing](../images/not-found.png)",
          "<img src=\"../images/not-found.png\" />",
          "![Also Missing](images/other-missing.png)",
          "![External](https://example.com/static.png)",
        ].join("\n"),
        assetReferenceByPath: new Map(),
        expectedContent: [
          "![Missing](../images/not-found.png)",
          "<img src=\"../images/not-found.png\" />",
          "![Also Missing](images/other-missing.png)",
          "![External](https://example.com/static.png)",
        ].join("\n"),
        expectedUnresolved: [
          "docs/guides/install.md: ../images/not-found.png",
          "docs/guides/install.md: images/other-missing.png",
        ],
      },
    ];

    for (const fixture of fixtures) {
      const rewritten = rewriteMarkdownImageReferences(
        fixture.content,
        fixture.markdownPath,
        fixture.assetReferenceByPath
      );

      expect(rewritten.content, fixture.name).toBe(fixture.expectedContent);
      expect(rewritten.unresolvedReferences, fixture.name).toEqual(fixture.expectedUnresolved);
    }
  });

  it("rewrites exported asset references to portable relative paths", () => {
    const markdownPath = "guides/nested/with-image.md";
    const content =
      "![One](oc-asset://asset-1)\n![Two](oc-asset://asset-2)\n![Missing](oc-asset://missing)";
    const exported = rewriteAssetReferencesForExport(
      content,
      markdownPath,
      new Map([
        ["asset-1", "_assets/images/one.png"],
        ["asset-2", "_assets/guides/two.png"],
      ])
    );

    expect(exported).toContain("![One](../../_assets/images/one.png)");
    expect(exported).toContain("![Two](../../_assets/guides/two.png)");
    expect(exported).toContain("![Missing](oc-asset://missing)");
  });

  it("preserves re-import fidelity across import -> export -> import rewrite round trip", () => {
    const markdownPath = "guides/with-image.md";
    const original = "# Guide\n\n![Diagram](images/diagram.png)\n";

    const firstImport = rewriteMarkdownImageReferences(
      original,
      markdownPath,
      new Map([["guides/images/diagram.png", "oc-asset://asset-a"]])
    );

    expect(firstImport.unresolvedReferences).toEqual([]);
    expect(firstImport.content).toContain("oc-asset://asset-a");

    const exported = rewriteAssetReferencesForExport(
      firstImport.content,
      markdownPath,
      new Map([["asset-a", "_assets/guides/images/diagram.png"]])
    );

    expect(exported).toContain("../_assets/guides/images/diagram.png");
    expect(exported).not.toContain("oc-asset://asset-a");

    const secondImport = rewriteMarkdownImageReferences(
      exported,
      markdownPath,
      new Map([["_assets/guides/images/diagram.png", "oc-asset://asset-b"]])
    );

    expect(secondImport.unresolvedReferences).toEqual([]);
    expect(secondImport.content).toContain("oc-asset://asset-b");
  });
});
