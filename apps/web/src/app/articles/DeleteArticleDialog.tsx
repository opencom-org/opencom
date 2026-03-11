"use client";

import { Button } from "@opencom/ui";
import type { DeleteArticleTarget } from "./articlesAdminTypes";

type DeleteArticleDialogProps = {
  target: DeleteArticleTarget | null;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteArticleDialog({
  target,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteArticleDialogProps) {
  if (!target) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-2">Delete Article</h2>
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <strong>{target.title}</strong>? This action cannot be
          undone.
        </p>
        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Article"}
          </Button>
        </div>
      </div>
    </div>
  );
}
