"use client";

import { useMemo } from "react";

const SCOPE_GROUPS: { resource: string; scopes: { scope: string; label: string }[] }[] = [
  {
    resource: "Conversations",
    scopes: [
      { scope: "conversations.read", label: "Read" },
      { scope: "conversations.write", label: "Write" },
    ],
  },
  {
    resource: "Messages",
    scopes: [
      { scope: "messages.read", label: "Read" },
      { scope: "messages.write", label: "Write" },
    ],
  },
  {
    resource: "Visitors",
    scopes: [
      { scope: "visitors.read", label: "Read" },
      { scope: "visitors.write", label: "Write" },
    ],
  },
  {
    resource: "Tickets",
    scopes: [
      { scope: "tickets.read", label: "Read" },
      { scope: "tickets.write", label: "Write" },
    ],
  },
  {
    resource: "Events",
    scopes: [
      { scope: "events.read", label: "Read" },
      { scope: "events.write", label: "Write" },
    ],
  },
  {
    resource: "Articles",
    scopes: [
      { scope: "articles.read", label: "Read" },
      { scope: "articles.write", label: "Write" },
    ],
  },
  {
    resource: "Collections",
    scopes: [
      { scope: "collections.read", label: "Read" },
      { scope: "collections.write", label: "Write" },
    ],
  },
  {
    resource: "Webhooks",
    scopes: [{ scope: "webhooks.manage", label: "Manage" }],
  },
  {
    resource: "Claims",
    scopes: [{ scope: "claims.manage", label: "Manage" }],
  },
];

const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.scope));
const READ_ONLY_SCOPES = ALL_SCOPES.filter((s) => s.endsWith(".read"));

export function ScopeSelector({
  value,
  onChange,
}: {
  value: string[];
  onChange: (scopes: string[]) => void;
}): React.JSX.Element {
  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (scope: string) => {
    const next = new Set(selected);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    onChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => onChange(READ_ONLY_SCOPES)}
          className="text-primary hover:underline"
        >
          Read Only
        </button>
        <button
          type="button"
          onClick={() => onChange([...ALL_SCOPES])}
          className="text-primary hover:underline"
        >
          Full Access
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-muted-foreground hover:underline"
        >
          Deselect All
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {SCOPE_GROUPS.map((group) => (
          <div key={group.resource} className="flex items-center gap-3 text-sm">
            <span className="w-24 text-muted-foreground">{group.resource}</span>
            {group.scopes.map((s) => (
              <label key={s.scope} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(s.scope)}
                  onChange={() => toggle(s.scope)}
                  className="rounded border-gray-300"
                />
                <span className="text-xs">{s.label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
