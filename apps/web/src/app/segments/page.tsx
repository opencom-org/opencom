"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@opencom/ui";
import { Plus, Trash2, Edit2, Users, AlertTriangle, Layers } from "lucide-react";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { AppLayout } from "@/components/AppLayout";
import type { Id } from "@opencom/convex/dataModel";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";

type SegmentAudienceRulesInput = NonNullable<typeof api.segments.update._args.audienceRules>;

function SegmentsContent() {
  const { user } = useAuth();
  const workspaceId = user?.workspaceId as Id<"workspaces"> | undefined;

  const segments = useQuery(api.segments.list, workspaceId ? { workspaceId } : "skip");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Id<"segments"> | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"segments"> | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-gray-600 mt-1">
            Create reusable audience segments for targeting across features
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Segment
        </Button>
      </div>

      {segments === undefined ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : segments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Layers className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No segments yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first segment to reuse targeting rules across tours, surveys, and messages.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Segment
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {segments.map((segment) => (
            <SegmentCard
              key={segment._id}
              segment={segment}
              workspaceId={workspaceId!}
              onEdit={() => setEditingSegment(segment._id)}
              onDelete={() => setDeleteConfirmId(segment._id)}
            />
          ))}
        </div>
      )}

      {isCreateModalOpen && workspaceId && (
        <SegmentModal workspaceId={workspaceId} onClose={() => setIsCreateModalOpen(false)} />
      )}

      {editingSegment && workspaceId && (
        <SegmentModal
          workspaceId={workspaceId}
          segmentId={editingSegment}
          onClose={() => setEditingSegment(null)}
        />
      )}

      {deleteConfirmId && (
        <DeleteConfirmModal segmentId={deleteConfirmId} onClose={() => setDeleteConfirmId(null)} />
      )}
    </div>
  );
}

export default function SegmentsPage() {
  return (
    <AppLayout>
      <SegmentsContent />
    </AppLayout>
  );
}

function SegmentCard({
  segment,
  workspaceId,
  onEdit,
  onDelete,
}: {
  segment: { _id: Id<"segments">; name: string; description?: string; audienceRules: unknown };
  workspaceId: Id<"workspaces">;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const parsedAudienceRules = toInlineAudienceRule(segment.audienceRules);
  const preview = useQuery(
    api.segments.preview,
    parsedAudienceRules
      ? {
          workspaceId,
          audienceRules: parsedAudienceRules as SegmentAudienceRulesInput,
        }
      : "skip"
  );

  const usage = useQuery(api.segments.getUsage, { id: segment._id });

  return (
    <div
      data-testid="segment-card"
      className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-lg">{segment.name}</h3>
          {segment.description && (
            <p className="text-gray-500 text-sm mt-1">{segment.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            {preview && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Users className="h-4 w-4" />
                <span>
                  <strong>{preview.matching}</strong> of {preview.total} visitors
                </span>
              </div>
            )}
            {usage && usage.length > 0 && (
              <div className="text-sm text-gray-500">
                Used in {usage.length} {usage.length === 1 ? "feature" : "features"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SegmentModal({
  workspaceId,
  segmentId,
  onClose,
}: {
  workspaceId: Id<"workspaces">;
  segmentId?: Id<"segments">;
  onClose: () => void;
}) {
  const existingSegment = useQuery(api.segments.get, segmentId ? { id: segmentId } : "skip");

  const eventNames = useQuery(api.events.getDistinctNames, { workspaceId });

  const createSegment = useMutation(api.segments.create);
  const updateSegment = useMutation(api.segments.update);

  const [name, setName] = useState(existingSegment?.name || "");
  const [description, setDescription] = useState(existingSegment?.description || "");
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(
    toInlineAudienceRule(existingSegment?.audienceRules)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update form when existing segment loads
  if (existingSegment && !name && existingSegment.name) {
    setName(existingSegment.name);
    setDescription(existingSegment.description || "");
    setAudienceRules(toInlineAudienceRule(existingSegment.audienceRules));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!audienceRules) {
      setError("Audience rules are required");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const mutationAudienceRules = audienceRules as Parameters<
      typeof createSegment
    >[0]["audienceRules"];

    try {
      if (segmentId) {
        await updateSegment({
          id: segmentId,
          name: name.trim(),
          description: description.trim() || undefined,
          audienceRules: mutationAudienceRules,
        });
      } else {
        await createSegment({
          workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
          audienceRules: mutationAudienceRules,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save segment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">
              {segmentId ? "Edit Segment" : "Create Segment"}
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Power Users, Trial Users"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe who this segment includes"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Audience Rules</label>
              <AudienceRuleBuilder
                value={audienceRules}
                onChange={(rule: AudienceRule | null) =>
                  setAudienceRules(toInlineAudienceRuleFromBuilder(rule))
                }
                workspaceId={workspaceId}
                eventNames={eventNames || []}
                showSegmentSelector={false}
              />
            </div>
          </div>

          <div className="p-6 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : segmentId ? "Save Changes" : "Create Segment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  segmentId,
  onClose,
}: {
  segmentId: Id<"segments">;
  onClose: () => void;
}) {
  const segment = useQuery(api.segments.get, { id: segmentId });
  const usage = useQuery(api.segments.getUsage, { id: segmentId });
  const deleteSegment = useMutation(api.segments.remove);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSegment({ id: segmentId });
      onClose();
    } catch (err) {
      console.error("Failed to delete segment:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasUsage = usage && usage.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Delete Segment</h2>

        {hasUsage ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">This segment is in use</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Deleting it will affect the following features:
                </p>
              </div>
            </div>
            <ul className="text-sm space-y-1 ml-4">
              {usage?.map((item, i) => (
                <li key={i} className="text-gray-600">
                  • {item.type}: {item.name}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-gray-600">
            Are you sure you want to delete &ldquo;{segment?.name}&rdquo;? This action cannot be
            undone.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Segment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
