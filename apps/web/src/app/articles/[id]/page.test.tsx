import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const {
  apiMock,
  useAuthMock,
  useParamsMock,
  useQueryMock,
  useMutationMock,
  updateArticleMock,
  publishArticleMock,
  unpublishArticleMock,
  archiveArticleMock,
  generateAssetUploadUrlMock,
  saveAssetMock,
  deleteAssetMock,
} = vi.hoisted(() => ({
  apiMock: {
    articles: {
      get: "articles.get",
      listAssets: "articles.listAssets",
      update: "articles.update",
      publish: "articles.publish",
      unpublish: "articles.unpublish",
      archive: "articles.archive",
      generateAssetUploadUrl: "articles.generateAssetUploadUrl",
      saveAsset: "articles.saveAsset",
      deleteAsset: "articles.deleteAsset",
    },
    collections: {
      listHierarchy: "collections.listHierarchy",
    },
  },
  useAuthMock: vi.fn(),
  useParamsMock: vi.fn(),
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  updateArticleMock: vi.fn(),
  publishArticleMock: vi.fn(),
  unpublishArticleMock: vi.fn(),
  archiveArticleMock: vi.fn(),
  generateAssetUploadUrlMock: vi.fn(),
  saveAssetMock: vi.fn(),
  deleteAssetMock: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: apiMock,
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("next/navigation", () => ({
  useParams: () => useParamsMock(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/components/AudienceRuleBuilder", () => ({
  AudienceRuleBuilder: () => <div data-testid="audience-rule-builder" />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

import ArticleEditorPage from "./page";

function renderArticleEditor(options?: {
  visibility?: "public" | "internal";
  tags?: string[];
}) {
  const article = {
    _id: "article-1",
    title: "Refund policy",
    slug: "refund-policy",
    content: "Base article body",
    status: "draft" as const,
    visibility: options?.visibility ?? "public",
    collectionId: undefined,
    tags: options?.tags ?? [],
    audienceRules: undefined,
  };

  useParamsMock.mockReturnValue({ id: article._id });
  useAuthMock.mockReturnValue({
    activeWorkspace: {
      _id: "workspace-1",
    },
  });

  useQueryMock.mockImplementation((reference: string) => {
    if (reference === apiMock.articles.get) {
      return article;
    }
    if (reference === apiMock.articles.listAssets) {
      return [];
    }
    if (reference === apiMock.collections.listHierarchy) {
      return [];
    }
    return undefined;
  });

  useMutationMock.mockImplementation((reference: string) => {
    switch (reference) {
      case apiMock.articles.update:
        return updateArticleMock;
      case apiMock.articles.publish:
        return publishArticleMock;
      case apiMock.articles.unpublish:
        return unpublishArticleMock;
      case apiMock.articles.archive:
        return archiveArticleMock;
      case apiMock.articles.generateAssetUploadUrl:
        return generateAssetUploadUrlMock;
      case apiMock.articles.saveAsset:
        return saveAssetMock;
      case apiMock.articles.deleteAsset:
        return deleteAssetMock;
      default:
        return vi.fn();
    }
  });

  return render(<ArticleEditorPage />);
}

describe("ArticleEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateArticleMock.mockResolvedValue(undefined);
    publishArticleMock.mockResolvedValue(undefined);
    unpublishArticleMock.mockResolvedValue(undefined);
    archiveArticleMock.mockResolvedValue(undefined);
    generateAssetUploadUrlMock.mockResolvedValue(undefined);
    saveAssetMock.mockResolvedValue(undefined);
    deleteAssetMock.mockResolvedValue(undefined);
  });

  it("saves internal article visibility and tags through the unified editor", async () => {
    renderArticleEditor();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Article title")).toHaveValue("Refund policy");
    });

    const [, visibilitySelect] = screen.getAllByRole("combobox");
    fireEvent.change(visibilitySelect, { target: { value: "internal" } });
    fireEvent.change(screen.getByPlaceholderText("billing, enterprise, refunds"), {
      target: { value: "billing, vip" },
    });
    fireEvent.change(screen.getByPlaceholderText("Write your article content here..."), {
      target: { value: "Internal-only refund handling steps" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateArticleMock).toHaveBeenCalledWith({
        id: "article-1",
        title: "Refund policy",
        content: "Internal-only refund handling steps",
        collectionId: undefined,
        visibility: "internal",
        tags: ["billing", "vip"],
      });
    });
  });

  it("clears tags when saving an article back to public visibility", async () => {
    renderArticleEditor({
      visibility: "internal",
      tags: ["refunds", "vip"],
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("billing, enterprise, refunds")).toHaveValue(
        "refunds, vip"
      );
    });

    const [, visibilitySelect] = screen.getAllByRole("combobox");
    fireEvent.change(visibilitySelect, { target: { value: "public" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateArticleMock).toHaveBeenCalledWith({
        id: "article-1",
        title: "Refund policy",
        content: "Base article body",
        collectionId: undefined,
        visibility: "public",
        tags: [],
      });
    });
  });
});
