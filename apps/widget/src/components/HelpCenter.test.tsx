import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { HelpCenter } from "./HelpCenter";

const collectionId = "collection_hosted" as Id<"collections">;

const publishedArticles = [
  {
    _id: "article_hosted" as Id<"articles">,
    title: "Hosted Quick Start",
    content: "# Hosted Quick Start\n\nFollow these setup steps.",
    collectionId,
    order: 1,
  },
  {
    _id: "article_uncategorized" as Id<"articles">,
    title: "Uncategorized Guide",
    content: [
      "---",
      'title: "Uncategorized Guide"',
      'slug: "uncategorized-guide"',
      "---",
      "",
      "This article preview should not include frontmatter keys.",
    ].join("\n"),
    order: 2,
  },
];

describe("HelpCenter", () => {
  it("shows collections first and strips frontmatter in article previews", () => {
    render(
      <HelpCenter
        articleSearchQuery=""
        onSearchChange={vi.fn()}
        articleSearchResults={undefined}
        publishedArticles={publishedArticles}
        collections={[
          {
            _id: collectionId,
            name: "Hosted Onboarding",
          },
        ]}
        onSelectArticle={vi.fn()}
      />
    );

    expect(screen.getByText("2 collections")).toBeInTheDocument();
    expect(screen.queryByText("Hosted Quick Start")).not.toBeInTheDocument();
    expect(screen.queryByText("Uncategorized Guide")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Uncategorized/i }));

    expect(screen.getByText("Uncategorized Guide")).toBeInTheDocument();
    expect(screen.getByText(/preview should not include frontmatter/i)).toBeInTheDocument();
    expect(screen.queryByText(/slug:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/title:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Collections/i })).toBeInTheDocument();
  });

  it("drills into a selected collection", () => {
    render(
      <HelpCenter
        articleSearchQuery=""
        onSearchChange={vi.fn()}
        articleSearchResults={undefined}
        publishedArticles={publishedArticles}
        collections={[
          {
            _id: collectionId,
            name: "Hosted Onboarding",
          },
        ]}
        onSelectArticle={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Hosted Onboarding/i }));

    expect(screen.getByText("Hosted Quick Start")).toBeInTheDocument();
    expect(screen.queryByText("Uncategorized Guide")).not.toBeInTheDocument();
  });
});
