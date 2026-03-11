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

function resolveFunctionPath(ref: unknown): string {
  if (typeof ref === "string") {
    return ref;
  }

  if (!ref || typeof ref !== "object") {
    return "";
  }

  const maybeRef = ref as {
    functionName?: string;
    reference?: { functionName?: string; name?: string };
    name?: string;
    referencePath?: string;
    function?: { name?: string };
  };

  const symbolFunctionName = Object.getOwnPropertySymbols(ref).find((symbol) =>
    String(symbol).includes("functionName")
  );

  const symbolValue = symbolFunctionName
    ? (ref as Record<symbol, unknown>)[symbolFunctionName]
    : undefined;

  return (
    (typeof symbolValue === "string" ? symbolValue : undefined) ??
    maybeRef.functionName ??
    maybeRef.reference?.functionName ??
    maybeRef.reference?.name ??
    maybeRef.name ??
    maybeRef.referencePath ??
    maybeRef.function?.name ??
    ""
  );
}

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

  useQueryMock.mockImplementation((_, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    const queryArgs = args as { id?: string; articleId?: string; workspaceId?: string } | undefined;

    if (queryArgs?.id === article._id) {
      return article;
    }

    if (queryArgs?.articleId === article._id) {
      return [];
    }

    if (queryArgs?.workspaceId === "workspace-1") {
      return [];
    }

    return undefined;
  });

  useMutationMock.mockImplementation((mutationRef: unknown) => {
    const functionPath = resolveFunctionPath(mutationRef);

    if (functionPath === "articles:update" || functionPath === "articles.update") {
      return updateArticleMock;
    }

    if (functionPath === "articles:publish" || functionPath === "articles.publish") {
      return publishArticleMock;
    }

    if (functionPath === "articles:unpublish" || functionPath === "articles.unpublish") {
      return unpublishArticleMock;
    }

    if (functionPath === "articles:archive" || functionPath === "articles.archive") {
      return archiveArticleMock;
    }

    if (
      functionPath === "articles:generateAssetUploadUrl" ||
      functionPath === "articles.generateAssetUploadUrl"
    ) {
      return generateAssetUploadUrlMock;
    }

    if (functionPath === "articles:saveAsset" || functionPath === "articles.saveAsset") {
      return saveAssetMock;
    }

    if (functionPath === "articles:deleteAsset" || functionPath === "articles.deleteAsset") {
      return deleteAssetMock;
    }

    return vi.fn();
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

    fireEvent.change(screen.getByPlaceholderText("Article title"), {
      target: { value: "Refund policy (internal)" },
    });
    const visibilitySelect = screen.getByDisplayValue("Public help article");
    fireEvent.change(visibilitySelect, { target: { value: "internal" } });
    fireEvent.change(screen.getByPlaceholderText("billing, enterprise, refunds"), {
      target: { value: "billing, vip" },
    });
    fireEvent.change(screen.getByPlaceholderText("Write your article content here..."), {
      target: { value: "Internal-only refund handling steps" },
    });

    expect(screen.getByPlaceholderText("Article title")).toHaveValue("Refund policy (internal)");
    expect(screen.getByPlaceholderText("billing, enterprise, refunds")).toHaveValue("billing, vip");
    expect(screen.getByPlaceholderText("Write your article content here...")).toHaveValue(
      "Internal-only refund handling steps"
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateArticleMock).toHaveBeenCalledWith({
        id: "article-1",
        title: "Refund policy (internal)",
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

    fireEvent.change(screen.getByPlaceholderText("Article title"), {
      target: { value: "Refund policy (public)" },
    });
    const visibilitySelect = screen.getByDisplayValue("Internal knowledge article");
    fireEvent.change(visibilitySelect, { target: { value: "public" } });
    fireEvent.change(screen.getByPlaceholderText("Write your article content here..."), {
      target: { value: "Base article body (public)" },
    });

    expect(screen.getByPlaceholderText("Article title")).toHaveValue("Refund policy (public)");
    expect(screen.getByPlaceholderText("Write your article content here...")).toHaveValue(
      "Base article body (public)"
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateArticleMock).toHaveBeenCalledWith({
        id: "article-1",
        title: "Refund policy (public)",
        content: "Base article body (public)",
        collectionId: undefined,
        visibility: "public",
        tags: [],
      });
    });
  });
});
