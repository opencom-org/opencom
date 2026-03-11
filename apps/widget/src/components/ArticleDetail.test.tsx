import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleDetail } from "./ArticleDetail";

function renderSubject(
  overrides?: Partial<React.ComponentProps<typeof ArticleDetail>>
) {
  return render(
    <ArticleDetail
      article={null}
      isLoading={false}
      isLargeScreen={false}
      isCollapsingLargeScreen={false}
      onToggleLargeScreen={vi.fn()}
      onBack={vi.fn()}
      onClose={vi.fn()}
      onStartConversation={vi.fn()}
      {...overrides}
    />
  );
}

describe("ArticleDetail", () => {
  it("shows a loading state while a selected widget article is still resolving", () => {
    renderSubject({ isLoading: true });

    expect(screen.getByText("Loading article...")).toBeInTheDocument();
  });

  it("shows an unavailable state when a selected widget article cannot be loaded", () => {
    renderSubject({ article: null, isLoading: false });

    expect(screen.getByText("Article unavailable")).toBeInTheDocument();
  });

  it("renders article content when the selected article is available", () => {
    renderSubject({
      article: {
        title: "Refund policy",
        content: "Use the refund form to submit your request.",
      },
    });

    expect(screen.getByText("Refund policy")).toBeInTheDocument();
    expect(screen.getByText("Use the refund form to submit your request.")).toBeInTheDocument();
  });
});
