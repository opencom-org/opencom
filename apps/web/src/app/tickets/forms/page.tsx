"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { Button, Input } from "@opencom/ui";
import {
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Type,
  AlignLeft,
  List,
  Hash,
  Calendar,
  Star,
  ArrowLeft,
  Save,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type FieldType = "text" | "textarea" | "select" | "multi-select" | "number" | "date";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

const fieldTypeConfig: Record<FieldType, { label: string; icon: React.ElementType }> = {
  text: { label: "Short Text", icon: Type },
  textarea: { label: "Long Text", icon: AlignLeft },
  select: { label: "Dropdown", icon: List },
  "multi-select": { label: "Multi-Select", icon: List },
  number: { label: "Number", icon: Hash },
  date: { label: "Date", icon: Calendar },
};

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function TicketFormsContent(): React.JSX.Element | null {
  const { user, activeWorkspace } = useAuth();
  const [selectedFormId, setSelectedFormId] = useState<Id<"ticketForms"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const forms = useQuery(
    api.ticketForms.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createForm = useMutation(api.ticketForms.create);
  const deleteForm = useMutation(api.ticketForms.remove);

  const handleCreateForm = async () => {
    if (!activeWorkspace?._id) return;
    setIsCreating(true);
    try {
      const newFormId = await createForm({
        workspaceId: activeWorkspace._id,
        name: "New Ticket Form",
        fields: [
          {
            id: generateFieldId(),
            type: "text",
            label: "Subject",
            placeholder: "Brief description of your issue",
            required: true,
          },
          {
            id: generateFieldId(),
            type: "textarea",
            label: "Description",
            placeholder: "Please provide more details...",
            required: true,
          },
        ],
        isDefault: !forms || forms.length === 0,
      });
      setSelectedFormId(newFormId);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteForm = async (formId: Id<"ticketForms">) => {
    if (!confirm("Are you sure you want to delete this form?")) return;
    try {
      await deleteForm({ id: formId });
      if (selectedFormId === formId) {
        setSelectedFormId(null);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete form");
    }
  };

  if (!user || !activeWorkspace) {
    return null;
  }

  return (
    <div className="h-full flex">
      {/* Forms List Sidebar */}
      <div className="w-80 border-r bg-gray-50 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link href="/tickets">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h2 className="font-semibold">Ticket Forms</h2>
          </div>
          <Button size="sm" onClick={handleCreateForm} disabled={isCreating}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {forms?.map((form) => (
            <div
              key={form._id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedFormId === form._id
                  ? "bg-primary/10 border-primary"
                  : "bg-white hover:bg-gray-100"
              }`}
              onClick={() => setSelectedFormId(form._id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{form.name}</span>
                </div>
                {form.isDefault && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {form.fields.length} field{form.fields.length !== 1 ? "s" : ""}
              </p>
            </div>
          ))}

          {(!forms || forms.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No forms yet</p>
              <p className="text-xs">Create your first ticket form</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Editor */}
      <div className="flex-1 overflow-auto">
        {selectedFormId ? (
          <FormEditor formId={selectedFormId} onDelete={() => handleDeleteForm(selectedFormId)} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a form to edit</h3>
              <p className="text-sm mb-4">Or create a new form to get started</p>
              <Button onClick={handleCreateForm} disabled={isCreating}>
                <Plus className="h-4 w-4 mr-2" />
                Create Form
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormEditor({
  formId,
  onDelete,
}: {
  formId: Id<"ticketForms">;
  onDelete: () => void;
}): React.JSX.Element | null {
  const form = useQuery(api.ticketForms.get, { id: formId });
  const updateForm = useMutation(api.ticketForms.update);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || "");
      setFields(form.fields as FormField[]);
      setIsDefault(form.isDefault);
      setSelectedFieldId(null);
    }
  }, [form]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateForm({
        id: formId,
        name,
        description: description || undefined,
        fields,
        isDefault,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddField = (type: FieldType) => {
    const newField: FormField = {
      id: generateFieldId(),
      type,
      label: fieldTypeConfig[type].label,
      required: false,
      ...(type === "select" || type === "multi-select"
        ? { options: ["Option 1", "Option 2"] }
        : {}),
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const handleMoveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setFields(newFields);
  };

  if (!form) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-semibold border-none p-0 focus:ring-0"
            placeholder="Form name"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="text-sm text-gray-500 border-none p-0 focus:ring-0 mt-1"
            placeholder="Form description (optional)"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            Default Form
          </label>
          <Button variant="outline" onClick={onDelete} className="text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Field Types Palette */}
        <div className="w-48 border-r bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add Field</h3>
          <div className="space-y-2">
            {(
              Object.entries(fieldTypeConfig) as [
                FieldType,
                { label: string; icon: React.ElementType },
              ][]
            ).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => handleAddField(type)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left bg-white border rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Icon className="h-4 w-4 text-gray-500" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Preview */}
        <div className="flex-1 p-6 overflow-auto bg-gray-100">
          <div className="max-w-lg mx-auto bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-1">{name || "Untitled Form"}</h3>
            {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}

            {fields.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                <p>Add fields from the left panel</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const Icon = fieldTypeConfig[field.type].icon;
                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedFieldId === field.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <GripVertical className="h-4 w-4 text-gray-400 cursor-move" />
                        <Icon className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm">{field.label}</span>
                        {field.required && <span className="text-red-500 text-xs">*</span>}
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (index > 0) handleMoveField(index, index - 1);
                          }}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (index < fields.length - 1) handleMoveField(index, index + 1);
                          }}
                          disabled={index === fields.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteField(field.id);
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Field Preview */}
                      {field.type === "text" && (
                        <Input
                          placeholder={field.placeholder || "Enter text..."}
                          disabled
                          className="bg-gray-50"
                        />
                      )}
                      {field.type === "textarea" && (
                        <textarea
                          placeholder={field.placeholder || "Enter text..."}
                          disabled
                          className="w-full px-3 py-2 border rounded-md bg-gray-50 text-sm"
                          rows={3}
                        />
                      )}
                      {field.type === "select" && (
                        <select
                          disabled
                          className="w-full px-3 py-2 border rounded-md bg-gray-50 text-sm"
                        >
                          <option>{field.placeholder || "Select an option..."}</option>
                          {field.options?.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {field.type === "multi-select" && (
                        <div className="flex flex-wrap gap-1">
                          {field.options?.map((opt) => (
                            <span key={opt} className="px-2 py-1 text-xs bg-gray-100 rounded">
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                      {field.type === "number" && (
                        <Input
                          type="number"
                          placeholder={field.placeholder || "0"}
                          disabled
                          className="bg-gray-50"
                        />
                      )}
                      {field.type === "date" && (
                        <Input type="date" disabled className="bg-gray-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Field Properties Panel */}
        {selectedField && (
          <div className="w-72 border-l bg-white p-4 overflow-auto">
            <h3 className="font-medium mb-4">Field Properties</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <Input
                  value={selectedField.label}
                  onChange={(e) => handleUpdateField(selectedField.id, { label: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
                <Input
                  value={selectedField.placeholder || ""}
                  onChange={(e) =>
                    handleUpdateField(selectedField.id, {
                      placeholder: e.target.value || undefined,
                    })
                  }
                  placeholder="Placeholder text..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={selectedField.required}
                  onChange={(e) =>
                    handleUpdateField(selectedField.id, { required: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="required" className="text-sm">
                  Required field
                </label>
              </div>

              {(selectedField.type === "select" || selectedField.type === "multi-select") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                  <div className="space-y-2">
                    {selectedField.options?.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...(selectedField.options || [])];
                            newOptions[index] = e.target.value;
                            handleUpdateField(selectedField.id, { options: newOptions });
                          }}
                          className="flex-1"
                        />
                        <button
                          onClick={() => {
                            const newOptions = selectedField.options?.filter((_, i) => i !== index);
                            handleUpdateField(selectedField.id, { options: newOptions });
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOptions = [
                          ...(selectedField.options || []),
                          `Option ${(selectedField.options?.length || 0) + 1}`,
                        ];
                        handleUpdateField(selectedField.id, { options: newOptions });
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TicketFormsPage(): React.JSX.Element {
  return (
    <AppLayout>
      <TicketFormsContent />
    </AppLayout>
  );
}
