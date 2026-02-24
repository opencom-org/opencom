import { useState } from "react";
import { ChevronLeft, X } from "../icons";

type FormField = {
  id: string;
  type: "text" | "textarea" | "select" | "multi-select" | "number" | "date";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
};

interface TicketForm {
  _id: string;
  description?: string;
  fields: FormField[];
}

interface TicketCreateProps {
  ticketForm: TicketForm | undefined;
  onBack: () => void;
  onClose: () => void;
  onSubmit: (formData: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
}

const fallbackFields: FormField[] = [
  {
    id: "subject",
    type: "text",
    label: "Subject",
    placeholder: "Brief description of your issue",
    required: true,
  },
  {
    id: "description",
    type: "textarea",
    label: "Description",
    placeholder: "Please provide more details...",
    required: false,
  },
];

export function TicketCreate({
  ticketForm,
  onBack,
  onClose,
  onSubmit,
  isSubmitting,
}: TicketCreateProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const formFields = ((ticketForm?.fields?.length ? ticketForm.fields : fallbackFields) ||
    []) as FormField[];

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="opencom-chat">
      <div className="opencom-header">
        <button onClick={onBack} className="opencom-back">
          <ChevronLeft />
        </button>
        <span>Submit a Ticket</span>
        <div className="opencom-header-actions">
          <button onClick={onClose} className="opencom-close">
            <X />
          </button>
        </div>
      </div>
      <div className="opencom-ticket-form">
        {ticketForm?.description && (
          <p className="opencom-ticket-form-description">{ticketForm.description}</p>
        )}
        <div className="opencom-ticket-form-fields">
          {formFields.map((field) => (
            <div key={field.id} className="opencom-ticket-form-field">
              <label className="opencom-ticket-form-label">
                {field.label}
                {field.required && <span className="opencom-required">*</span>}
              </label>
              {field.type === "text" && (
                <input
                  type="text"
                  value={(formData[field.id] as string) || ""}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="opencom-ticket-form-input"
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  value={(formData[field.id] as string) || ""}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="opencom-ticket-form-textarea"
                  rows={4}
                />
              )}
              {field.type === "select" && (
                <select
                  value={(formData[field.id] as string) || ""}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="opencom-ticket-form-select"
                >
                  <option value="">{field.placeholder || "Select..."}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              {field.type === "multi-select" && (
                <div className="opencom-ticket-form-multiselect">
                  {field.options?.map((opt) => {
                    const selected = ((formData[field.id] as string[]) || []).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`opencom-ticket-form-option ${selected ? "selected" : ""}`}
                        onClick={() => {
                          const current = (formData[field.id] as string[]) || [];
                          const updated = selected
                            ? current.filter((v) => v !== opt)
                            : [...current, opt];
                          setFormData({ ...formData, [field.id]: updated });
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {field.type === "number" && (
                <input
                  type="number"
                  value={(formData[field.id] as number) || ""}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="opencom-ticket-form-input"
                />
              )}
              {field.type === "date" && (
                <input
                  type="date"
                  value={(formData[field.id] as string) || ""}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="opencom-ticket-form-input"
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="opencom-ticket-submit-btn"
        >
          {isSubmitting ? "Submitting..." : "Submit Ticket"}
        </button>
      </div>
    </div>
  );
}
