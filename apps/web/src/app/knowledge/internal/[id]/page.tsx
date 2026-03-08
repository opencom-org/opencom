import { redirect } from "next/navigation";

export default async function InternalKnowledgeArticleRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/articles/${id}`);
}
