"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { Pencil, Trash2, Play, Pause, Search, CheckSquare } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type ChecklistStatus = "draft" | "active" | "archived";

function ChecklistsContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ChecklistStatus>("all");

  const checklists = useQuery(
    api.checklists.list,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip"
  );

  const createChecklist = useMutation(api.checklists.create);
  const deleteChecklist = useMutation(api.checklists.remove);
  const updateChecklist = useMutation(api.checklists.update);

  const handleCreate = async () => {
    if (!activeWorkspace?._id) return;
    const checklistId = await createChecklist({
      workspaceId: activeWorkspace._id,
      name: "New Checklist",
      tasks: [
        {
          id: crypto.randomUUID(),
          title: "First task",
          completionType: "manual",
        },
      ],
    });
    router.push(`/checklists/${checklistId}`);
  };

  const handleDelete = async (id: Id<"checklists">) => {
    if (confirm("Are you sure you want to delete this checklist?")) {
      await deleteChecklist({ id });
    }
  };

  const handleToggleStatus = async (checklist: NonNullable<typeof checklists>[number]) => {
    if (checklist.status === "active") {
      await updateChecklist({ id: checklist._id, status: "draft" });
    } else {
      await updateChecklist({ id: checklist._id, status: "active" });
    }
  };

  const filteredChecklists = checklists?.filter((cl: NonNullable<typeof checklists>[number]) =>
    cl.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-gray-500">Guide users through onboarding with task lists</p>
        </div>
        <Button onClick={handleCreate}>
          <CheckSquare className="h-4 w-4 mr-2" />
          New Checklist
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search checklists..."
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
          <option value="archived">Archived</option>
        </select>
      </div>

      {filteredChecklists?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <CheckSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No checklists yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first checklist to guide users through onboarding
          </p>
          <Button onClick={handleCreate}>
            <CheckSquare className="h-4 w-4 mr-2" />
            Create Checklist
          </Button>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Tasks</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredChecklists?.map((checklist: NonNullable<typeof checklists>[number]) => (
                <tr key={checklist._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/checklists/${checklist._id}`} className="hover:text-primary">
                      <div className="font-medium">{checklist.name}</div>
                      {checklist.description && (
                        <div className="text-sm text-gray-500 truncate max-w-md">
                          {checklist.description}
                        </div>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {checklist.tasks.length} task{checklist.tasks.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(checklist.status)}`}
                    >
                      {checklist.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(checklist.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(checklist)}
                        title={checklist.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {checklist.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/checklists/${checklist._id}`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(checklist._id)}
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

export default function ChecklistsPage() {
  return (
    <AppLayout>
      <ChecklistsContent />
    </AppLayout>
  );
}
