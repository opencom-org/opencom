"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Plus,
  Trash2,
  GripVertical,
  CheckSquare,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder } from "@/components/AudienceRuleBuilder";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";

type JsonPrimitive = string | number | boolean | null;
type JsonObject = Record<string, JsonPrimitive>;
type JsonValue = JsonPrimitive | JsonPrimitive[] | JsonObject;

interface ChecklistTask {
  id: string;
  title: string;
  description?: string;
  action?: {
    type: "tour" | "url" | "event";
    tourId?: Id<"tours">;
    url?: string;
    eventName?: string;
  };
  completionType: "manual" | "auto_event" | "auto_attribute";
  completionEvent?: string;
  completionAttribute?: {
    key: string;
    operator: string;
    value?: JsonValue;
  };
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function ChecklistBuilderContent() {
  const params = useParams();
  const checklistId = params.id as Id<"checklists">;
  const { activeWorkspace } = useAuth();

  const checklist = useQuery(api.checklists.get, { id: checklistId });
  const tours = useQuery(
    api.tours.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateChecklist = useMutation(api.checklists.update);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<ChecklistTask[]>([]);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (checklist) {
      setName(checklist.name);
      setDescription(checklist.description || "");
      setTasks(checklist.tasks as ChecklistTask[]);
      setAudienceRules(toInlineAudienceRule(checklist.audienceRules ?? checklist.targeting));
    }
  }, [checklist]);

  const handleSave = async () => {
    setSaveError(null);
    const mutationTargeting = audienceRules
      ? (audienceRules as Parameters<typeof updateChecklist>[0]["targeting"])
      : undefined;

    try {
      await updateChecklist({
        id: checklistId,
        name,
        description: description || undefined,
        tasks,
        ...(mutationTargeting ? { targeting: mutationTargeting } : {}),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save checklist");
    }
  };

  const handleToggleStatus = async () => {
    setStatusError(null);
    try {
      if (checklist?.status === "active") {
        await updateChecklist({ id: checklistId, status: "draft" });
      } else {
        await updateChecklist({ id: checklistId, status: "active" });
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Failed to update checklist status");
    }
  };

  const addTask = () => {
    const newTask: ChecklistTask = {
      id: crypto.randomUUID(),
      title: "New task",
      completionType: "manual",
    };
    setTasks([...tasks, newTask]);
    setExpandedTask(newTask.id);
  };

  const removeTask = (taskId: string) => {
    setTasks(tasks.filter((t) => t.id !== taskId));
  };

  const updateTask = (taskId: string, updates: Partial<ChecklistTask>) => {
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
  };

  if (!checklist) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/checklists">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            <h1 className="text-2xl font-bold">Edit Checklist</h1>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              checklist.status === "active"
                ? "bg-green-100 text-green-800"
                : checklist.status === "archived"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
            }`}
          >
            {checklist.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleToggleStatus}>
            {checklist.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {(saveError || statusError) && (
        <div className="mb-4 space-y-2">
          {saveError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}
          {statusError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {statusError}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Checklist name"
                />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 p-3 border rounded-md min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Describe what this checklist helps users accomplish..."
                />
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Tasks</h2>
              <Button variant="outline" size="sm" onClick={addTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>

            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div key={task.id} className="border rounded-lg">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  >
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                    <span className="flex-1 font-medium">{task.title}</span>
                    <span className="text-xs text-gray-500 capitalize">
                      {task.completionType.replace("_", " ")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTask(task.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {expandedTask === task.id && (
                    <div className="border-t p-4 space-y-4 bg-gray-50">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={task.title}
                          onChange={(e) => updateTask(task.id, { title: e.target.value })}
                          placeholder="Task title"
                        />
                      </div>

                      <div>
                        <Label>Description (optional)</Label>
                        <textarea
                          value={task.description || ""}
                          onChange={(e) =>
                            updateTask(task.id, { description: e.target.value || undefined })
                          }
                          className="w-full mt-1 p-3 border rounded-md min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Additional details about this task..."
                        />
                      </div>

                      <div>
                        <Label>Completion Type</Label>
                        <select
                          value={task.completionType}
                          onChange={(e) =>
                            updateTask(task.id, {
                              completionType: e.target.value as ChecklistTask["completionType"],
                              completionEvent: undefined,
                              completionAttribute: undefined,
                            })
                          }
                          className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="manual">Manual (user clicks checkbox)</option>
                          <option value="auto_event">Auto-complete on event</option>
                          <option value="auto_attribute">Auto-complete on attribute</option>
                        </select>
                      </div>

                      {task.completionType === "auto_event" && (
                        <div>
                          <Label>Event Name</Label>
                          <Input
                            value={task.completionEvent || ""}
                            onChange={(e) =>
                              updateTask(task.id, { completionEvent: e.target.value })
                            }
                            placeholder="e.g., profile_completed"
                          />
                        </div>
                      )}

                      {task.completionType === "auto_attribute" && (
                        <div className="space-y-2">
                          <Label>Attribute Condition</Label>
                          <div className="flex gap-2">
                            <Input
                              value={task.completionAttribute?.key || ""}
                              onChange={(e) =>
                                updateTask(task.id, {
                                  completionAttribute: {
                                    ...task.completionAttribute,
                                    key: e.target.value,
                                    operator: task.completionAttribute?.operator || "is_set",
                                  },
                                })
                              }
                              placeholder="Attribute key"
                              className="flex-1"
                            />
                            <select
                              value={task.completionAttribute?.operator || "is_set"}
                              onChange={(e) =>
                                updateTask(task.id, {
                                  completionAttribute: {
                                    ...task.completionAttribute!,
                                    operator: e.target.value,
                                  },
                                })
                              }
                              className="p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="is_set">Is set</option>
                              <option value="equals">Equals</option>
                              <option value="greater_than">Greater than</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div>
                        <Label>Action (optional)</Label>
                        <select
                          value={task.action?.type || ""}
                          onChange={(e) => {
                            const type = e.target.value as "tour" | "url" | "event" | "";
                            updateTask(task.id, {
                              action: type ? { type } : undefined,
                            });
                          }}
                          className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">No action</option>
                          <option value="tour">Launch product tour</option>
                          <option value="url">Open URL</option>
                          <option value="event">Track event</option>
                        </select>
                      </div>

                      {task.action?.type === "tour" && (
                        <div>
                          <Label>Select Tour</Label>
                          <select
                            value={task.action.tourId || ""}
                            onChange={(e) =>
                              updateTask(task.id, {
                                action: {
                                  ...task.action!,
                                  tourId: (e.target.value as Id<"tours">) || undefined,
                                },
                              })
                            }
                            className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select a tour...</option>
                            {tours?.map((tour: NonNullable<typeof tours>[number]) => (
                              <option key={tour._id} value={tour._id}>
                                {tour.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {task.action?.type === "url" && (
                        <div>
                          <Label>URL</Label>
                          <Input
                            value={task.action.url || ""}
                            onChange={(e) =>
                              updateTask(task.id, {
                                action: { ...task.action!, url: e.target.value },
                              })
                            }
                            placeholder="https://example.com/page"
                          />
                        </div>
                      )}

                      {task.action?.type === "event" && (
                        <div>
                          <Label>Event Name</Label>
                          <Input
                            value={task.action.eventName || ""}
                            onChange={(e) =>
                              updateTask(task.id, {
                                action: { ...task.action!, eventName: e.target.value },
                              })
                            }
                            placeholder="task_action_clicked"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No tasks yet. Add your first task to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Audience Targeting */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Audience Targeting</h2>
            <p className="text-sm text-gray-500 mb-4">
              Target specific users based on their properties, custom attributes, or behavior.
            </p>
            <AudienceRuleBuilder
              value={audienceRules}
              onChange={(rule) => setAudienceRules(toInlineAudienceRuleFromBuilder(rule))}
              eventNames={eventNames ?? []}
              workspaceId={activeWorkspace?._id}
              showSegmentSelector={false}
            />
          </div>
        </div>

        {/* Sidebar - Preview */}
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="font-semibold mb-1">{name || "Checklist Name"}</h3>
                {description && <p className="text-sm text-gray-500 mb-3">{description}</p>}
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2">
                      <div className="w-5 h-5 border-2 rounded flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-500">{task.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {tasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">0/{tasks.length}</span>
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/50 rounded-full" style={{ width: "0%" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistBuilderPage() {
  return (
    <AppLayout>
      <ChecklistBuilderContent />
    </AppLayout>
  );
}
