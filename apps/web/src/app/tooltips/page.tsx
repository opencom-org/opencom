"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { scoreSelectorQuality, type SelectorQualityMetadata } from "@opencom/sdk-core";
import { Plus, Pencil, Trash2, Search, Info, MousePointer2, ExternalLink } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";

type TriggerType = "hover" | "click" | "auto";

interface TooltipFormData {
  name: string;
  elementSelector: string;
  content: string;
  triggerType: TriggerType;
}

function TooltipsContent() {
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"tooltips"> | null>(null);
  const [formData, setFormData] = useState<TooltipFormData>({
    name: "",
    elementSelector: "",
    content: "",
    triggerType: "hover",
  });
  const [isPickerModalOpen, setIsPickerModalOpen] = useState(false);
  const [pickerUrl, setPickerUrl] = useState("");
  const [isPollingSession, setIsPollingSession] = useState(false);
  const [activeSessionToken, setActiveSessionToken] = useState<string | null>(null);
  const [pendingSelectorQuality, setPendingSelectorQuality] =
    useState<SelectorQualityMetadata | null>(null);

  const tooltips = useQuery(
    api.tooltips.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createTooltip = useMutation(api.tooltips.create);
  const updateTooltip = useMutation(api.tooltips.update);
  const deleteTooltip = useMutation(api.tooltips.remove);
  const createAuthoringSession = useMutation(api.tooltipAuthoringSessions.create);
  const authoringSession = useQuery(
    api.tooltipAuthoringSessions.getByToken,
    activeSessionToken && activeWorkspace?._id
      ? { token: activeSessionToken, workspaceId: activeWorkspace._id }
      : "skip"
  );

  const handleOpenModal = (tooltip?: NonNullable<typeof tooltips>[number]) => {
    if (tooltip) {
      setEditingId(tooltip._id);
      setFormData({
        name: tooltip.name,
        elementSelector: tooltip.elementSelector,
        content: tooltip.content,
        triggerType: tooltip.triggerType,
      });
      setPendingSelectorQuality(
        (tooltip.selectorQuality ?? null) as SelectorQualityMetadata | null
      );
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        elementSelector: "",
        content: "",
        triggerType: "hover",
      });
      setPendingSelectorQuality(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      name: "",
      elementSelector: "",
      content: "",
      triggerType: "hover",
    });
    setPendingSelectorQuality(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?._id) return;

    const selectorQuality =
      pendingSelectorQuality ?? scoreSelectorQuality(formData.elementSelector);

    try {
      if (editingId) {
        await updateTooltip({
          id: editingId,
          name: formData.name,
          elementSelector: formData.elementSelector,
          selectorQuality,
          content: formData.content,
          triggerType: formData.triggerType,
        });
      } else {
        await createTooltip({
          workspaceId: activeWorkspace._id,
          name: formData.name,
          elementSelector: formData.elementSelector,
          selectorQuality,
          content: formData.content,
          triggerType: formData.triggerType,
        });
      }
      handleCloseModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save tooltip");
    }
  };

  const handleDelete = async (id: Id<"tooltips">) => {
    if (confirm("Are you sure you want to delete this tooltip?")) {
      await deleteTooltip({ id });
    }
  };

  const handleOpenVisualPicker = () => {
    const defaultUrl = activeWorkspace?.allowedOrigins?.[0] || "";
    setPickerUrl(defaultUrl.replace(/^\*\./, "https://"));
    setIsPickerModalOpen(true);
  };

  const handleStartVisualPicker = async () => {
    if (!activeWorkspace?._id || !pickerUrl) return;

    try {
      const { token } = await createAuthoringSession({
        workspaceId: activeWorkspace._id,
        tooltipId: editingId || undefined,
      });

      setActiveSessionToken(token);
      setIsPollingSession(true);
      setIsPickerModalOpen(false);

      // Open the customer site with the authoring token
      const url = new URL(pickerUrl);
      url.searchParams.set("opencom_tooltip_authoring", token);
      window.open(url.toString(), "_blank");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to start visual picker");
    }
  };

  // Poll for session completion
  React.useEffect(() => {
    if (!isPollingSession || !authoringSession) return;

    if (authoringSession.status === "completed" && authoringSession.selectedSelector) {
      setFormData((prev) => ({
        ...prev,
        elementSelector: authoringSession.selectedSelector || "",
      }));
      setPendingSelectorQuality(
        (authoringSession.selectedSelectorQuality ?? null) as SelectorQualityMetadata | null
      );
      setIsPollingSession(false);
      setActiveSessionToken(null);
    }
    if (authoringSession.status === "expired") {
      setIsPollingSession(false);
      setActiveSessionToken(null);
      alert("Visual picker session expired. Please start a new picker session.");
    }
  }, [authoringSession, isPollingSession]);

  const currentSelectorQuality =
    formData.elementSelector.trim().length > 0
      ? (pendingSelectorQuality ?? scoreSelectorQuality(formData.elementSelector))
      : null;

  const filteredTooltips = tooltips?.filter(
    (tooltip: NonNullable<typeof tooltips>[number]) =>
      tooltip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tooltip.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tooltip.elementSelector.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTriggerLabel = (trigger: TriggerType) => {
    switch (trigger) {
      case "hover":
        return "On Hover";
      case "click":
        return "On Click (Beacon)";
      case "auto":
        return "Auto Show";
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" data-testid="tooltips-page-heading">
            Tooltips
          </h1>
          <p className="text-gray-500">Contextual hints attached to page elements</p>
        </div>
        <Button data-testid="tooltips-new-button" onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Tooltip
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="tooltips-search-input"
            placeholder="Search tooltips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredTooltips?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No tooltips yet</h3>
          <p className="text-gray-500 mb-4">
            Create tooltips to provide contextual help on your pages
          </p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Tooltip
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTooltips?.map((tooltip: NonNullable<typeof tooltips>[number]) => (
            <div
              key={tooltip._id}
              data-testid={`tooltip-card-${tooltip._id}`}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium">{tooltip.name}</h3>
                  <span className="inline-flex px-2 py-0.5 text-xs bg-gray-100 rounded mt-1">
                    {getTriggerLabel(tooltip.triggerType)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    data-testid={`tooltip-edit-${tooltip._id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenModal(tooltip)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    data-testid={`tooltip-delete-${tooltip._id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(tooltip._id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">{tooltip.content}</p>
              <p className="text-xs text-gray-400 font-mono truncate">{tooltip.elementSelector}</p>
              {tooltip.selectorQuality && (
                <div
                  className="mt-2 text-xs text-gray-600"
                  data-testid={`tooltip-quality-${tooltip._id}`}
                >
                  Quality:{" "}
                  <span className="font-medium">
                    {tooltip.selectorQuality.grade} ({tooltip.selectorQuality.score})
                  </span>
                  {tooltip.selectorQuality.warnings.length > 0 && (
                    <span className="ml-2 text-amber-700">
                      {tooltip.selectorQuality.warnings.length} warning
                      {tooltip.selectorQuality.warnings.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" data-testid="tooltip-modal">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Tooltip" : "New Tooltip"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="tooltip-form">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  data-testid="tooltip-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Dashboard Help"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Element Selector
                </label>
                <div className="flex gap-2">
                  <Input
                    data-testid="tooltip-selector-input"
                    value={formData.elementSelector}
                    onChange={(e) => {
                      setFormData({ ...formData, elementSelector: e.target.value });
                      setPendingSelectorQuality(null);
                    }}
                    placeholder="#help-button or .nav-item"
                    className="font-mono flex-1"
                    required
                  />
                  <Button
                    data-testid="tooltip-pick-element-button"
                    type="button"
                    variant="outline"
                    onClick={handleOpenVisualPicker}
                    className="shrink-0"
                  >
                    <MousePointer2 className="h-4 w-4 mr-2" />
                    Pick Element
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  CSS selector for the element to attach the tooltip to, or use the visual picker
                </p>
                {isPollingSession && (
                  <div
                    className="mt-2 p-2 bg-primary/5 text-primary text-sm rounded flex items-center gap-2"
                    data-testid="tooltip-picker-pending"
                  >
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    Waiting for element selection... Complete the selection in the opened tab.
                  </div>
                )}
                {currentSelectorQuality && (
                  <div
                    className={`mt-2 rounded border px-3 py-2 text-xs ${
                      currentSelectorQuality.grade === "poor"
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : currentSelectorQuality.grade === "fair"
                          ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                          : "border-green-300 bg-green-50 text-green-900"
                    }`}
                    data-testid="tooltip-selector-quality-warning"
                  >
                    <div className="font-medium">
                      Selector quality: {currentSelectorQuality.grade} (
                      {currentSelectorQuality.score})
                    </div>
                    {currentSelectorQuality.warnings.length > 0 && (
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        {currentSelectorQuality.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  data-testid="tooltip-content-input"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Helpful information about this feature..."
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
                <select
                  data-testid="tooltip-trigger-select"
                  value={formData.triggerType}
                  onChange={(e) =>
                    setFormData({ ...formData, triggerType: e.target.value as TriggerType })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="hover">On Hover</option>
                  <option value="click">On Click (Beacon)</option>
                  <option value="auto">Auto Show</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.triggerType === "hover" &&
                    "Tooltip appears when user hovers over the element"}
                  {formData.triggerType === "click" &&
                    "A beacon animation draws attention; clicking shows the tooltip"}
                  {formData.triggerType === "auto" &&
                    "Tooltip appears automatically when the element is visible"}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button data-testid="tooltip-save-button" type="submit">
                  {editingId ? "Save Changes" : "Create Tooltip"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPickerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            data-testid="tooltip-picker-modal"
          >
            <h2 className="text-xl font-bold mb-4">Pick Element Visually</h2>
            <p className="text-gray-600 mb-4">
              Enter the URL of your website where you want to pick an element. The page will open in
              a new tab with the visual picker enabled.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
                <Input
                  data-testid="tooltip-picker-url-input"
                  value={pickerUrl}
                  onChange={(e) => setPickerUrl(e.target.value)}
                  placeholder="https://your-website.com"
                  type="url"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Make sure the Opencom widget is installed on this page for
                  the visual picker to work.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPickerModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  data-testid="tooltip-picker-open-button"
                  onClick={handleStartVisualPicker}
                  disabled={!pickerUrl}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Visual Picker
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TooltipsPage() {
  return (
    <AppLayout>
      <TooltipsContent />
    </AppLayout>
  );
}
