"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { Plus, Pencil, Trash2, Copy, Play, Pause, Search, ClipboardList } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

function SurveysContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "active" | "paused" | "archived"
  >("all");

  const surveys = useQuery(
    api.surveys.list,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip"
  );

  const createSurvey = useMutation(api.surveys.create);
  const deleteSurvey = useMutation(api.surveys.remove);
  const activateSurvey = useMutation(api.surveys.activate);
  const pauseSurvey = useMutation(api.surveys.pause);
  const duplicateSurvey = useMutation(api.surveys.duplicate);

  const handleCreate = async () => {
    if (!activeWorkspace?._id) return;
    const surveyId = await createSurvey({
      workspaceId: activeWorkspace._id,
      name: "New Survey",
      format: "small",
    });
    router.push(`/surveys/${surveyId}`);
  };

  const handleDelete = async (id: Id<"surveys">) => {
    if (
      confirm("Are you sure you want to delete this survey? This will also delete all responses.")
    ) {
      await deleteSurvey({ id });
    }
  };

  const handleToggleStatus = async (survey: NonNullable<typeof surveys>[number]) => {
    if (survey.status === "active") {
      await pauseSurvey({ id: survey._id });
    } else {
      await activateSurvey({ id: survey._id });
    }
  };

  const handleDuplicate = async (id: Id<"surveys">) => {
    await duplicateSurvey({ id });
  };

  const filteredSurveys = surveys?.filter(
    (survey: NonNullable<typeof surveys>[number]) =>
      survey.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (survey.description && survey.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFormatBadge = (format: string) => {
    return format === "small" ? "bg-primary/10 text-primary" : "bg-purple-100 text-purple-800";
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Surveys</h1>
          <p className="text-gray-500">Collect feedback and measure customer sentiment</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Survey
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search surveys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filteredSurveys?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No surveys yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first survey to collect customer feedback
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Survey
          </Button>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Format</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Questions</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSurveys?.map((survey: NonNullable<typeof surveys>[number]) => (
                <tr key={survey._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/surveys/${survey._id}`} className="hover:text-primary">
                      <div className="font-medium">{survey.name}</div>
                      {survey.description && (
                        <div className="text-sm text-gray-500 truncate max-w-md">
                          {survey.description}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getFormatBadge(survey.format)}`}
                    >
                      {survey.format}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {survey.questions.length} question{survey.questions.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(survey.status)}`}
                    >
                      {survey.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(survey.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(survey)}
                        title={survey.status === "active" ? "Pause" : "Activate"}
                      >
                        {survey.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/surveys/${survey._id}`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(survey._id)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(survey._id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SurveysPage() {
  return (
    <AppLayout>
      <SurveysContent />
    </AppLayout>
  );
}
