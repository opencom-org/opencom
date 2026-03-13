import { redirect } from "next/navigation";

export default function NewInternalKnowledgeArticleRedirectPage() {
  redirect("/articles?create=internal");
}
