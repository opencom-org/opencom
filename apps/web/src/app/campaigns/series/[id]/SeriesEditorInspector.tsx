"use client";

import { Button, Input } from "@opencom/ui";
import { Trash2 } from "lucide-react";
import {
  formatRuleText,
  fromLocalDateTimeInput,
  parseRuleText,
  toLocalDateTimeInput,
  type ConnectionCondition,
  type SeriesBlock,
  type SeriesConnection,
} from "./seriesEditorTypes";

interface SeriesEditorInspectorProps {
  selectedConnection: SeriesConnection | undefined;
  selectedBlock: SeriesBlock | undefined;
  selectedBlockConnections: SeriesConnection[];
  blockMap: Map<string, SeriesBlock>;
  onDeleteConnection: (connectionId: string) => void;
  onUpdateConnectionCondition: (
    connection: SeriesConnection,
    condition: ConnectionCondition
  ) => void;
  onDeleteBlock: (blockId: string) => void;
  onUpdateBlockConfig: (blockId: string, config: Record<string, unknown>) => void;
  onSelectConnection: (connectionId: string) => void;
  onSelectBlock: (blockId: string | null) => void;
  onSetRuleEditorError: (value: string | null) => void;
}

export function SeriesEditorInspector({
  selectedConnection,
  selectedBlock,
  selectedBlockConnections,
  blockMap,
  onDeleteConnection,
  onUpdateConnectionCondition,
  onDeleteBlock,
  onUpdateBlockConfig,
  onSelectConnection,
  onSelectBlock,
  onSetRuleEditorError,
}: SeriesEditorInspectorProps): React.JSX.Element {
  return (
    <div className="w-96 border-l bg-white p-6 overflow-auto">
      {selectedConnection && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Connection</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDeleteConnection(selectedConnection._id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            {(blockMap.get(selectedConnection.fromBlockId)?.type ?? "?") +
              " -> " +
              (blockMap.get(selectedConnection.toBlockId)?.type ?? "?")}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              value={selectedConnection.condition ?? "default"}
              onChange={(event) =>
                onUpdateConnectionCondition(selectedConnection, event.target.value as ConnectionCondition)
              }
              className="w-full rounded-md border px-3 py-2"
            >
              <option value="default">default</option>
              <option value="yes">yes</option>
              <option value="no">no</option>
            </select>
          </div>
        </div>
      )}

      {selectedBlock && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium capitalize">{selectedBlock.type} Block</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteBlock(selectedBlock._id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {selectedBlock.type === "rule" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule JSON</label>
              <textarea
                key={selectedBlock._id}
                defaultValue={formatRuleText(selectedBlock.config.rules)}
                onBlur={(event) => {
                  const parsed = parseRuleText(event.target.value, "Rule block rules");
                  if (parsed.error) {
                    onSetRuleEditorError(parsed.error);
                    return;
                  }
                  onSetRuleEditorError(null);
                  onUpdateBlockConfig(selectedBlock._id, {
                    ...selectedBlock.config,
                    rules: parsed.value,
                  });
                }}
                className="w-full h-40 px-3 py-2 border rounded-md resize-none font-mono text-xs"
                placeholder='{"type":"group","operator":"and","conditions":[]}'
              />
            </div>
          )}

          {selectedBlock.type === "wait" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wait Type</label>
                <select
                  value={(selectedBlock.config.waitType as string) || "duration"}
                  onChange={(event) =>
                    onUpdateBlockConfig(selectedBlock._id, {
                      ...selectedBlock.config,
                      waitType: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="duration">Duration</option>
                  <option value="until_date">Until Date</option>
                  <option value="until_event">Until Event</option>
                </select>
              </div>
              {selectedBlock.config.waitType === "duration" && (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={(selectedBlock.config.waitDuration as number) || 1}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        waitDuration: parseInt(event.target.value),
                      })
                    }
                    className="flex-1"
                  />
                  <select
                    value={(selectedBlock.config.waitUnit as string) || "days"}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        waitUnit: event.target.value,
                      })
                    }
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              )}
              {selectedBlock.config.waitType === "until_date" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resume At</label>
                  <input
                    type="datetime-local"
                    value={toLocalDateTimeInput(selectedBlock.config.waitUntilDate as number | undefined)}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        waitUntilDate: fromLocalDateTimeInput(event.target.value),
                      })
                    }
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
              )}
              {selectedBlock.config.waitType === "until_event" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                  <Input
                    value={(selectedBlock.config.waitUntilEvent as string) || ""}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        waitUntilEvent: event.target.value,
                      })
                    }
                    placeholder="e.g., checkout_completed"
                  />
                </div>
              )}
            </div>
          )}

          {(selectedBlock.type === "email" ||
            selectedBlock.type === "push" ||
            selectedBlock.type === "chat" ||
            selectedBlock.type === "post" ||
            selectedBlock.type === "carousel") && (
            <div className="space-y-4">
              {selectedBlock.type === "email" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <Input
                    value={(selectedBlock.config.subject as string) || ""}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        subject: event.target.value,
                      })
                    }
                    placeholder="Email subject"
                  />
                </div>
              )}
              {selectedBlock.type === "push" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <Input
                    value={(selectedBlock.config.title as string) || ""}
                    onChange={(event) =>
                      onUpdateBlockConfig(selectedBlock._id, {
                        ...selectedBlock.config,
                        title: event.target.value,
                      })
                    }
                    placeholder="Push title"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                  value={(selectedBlock.config.body as string) || ""}
                  onChange={(event) =>
                    onUpdateBlockConfig(selectedBlock._id, {
                      ...selectedBlock.config,
                      body: event.target.value,
                    })
                  }
                  className="w-full h-32 px-3 py-2 border rounded-md resize-none"
                  placeholder="Message content"
                />
              </div>
            </div>
          )}

          {selectedBlock.type === "tag" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <select
                  value={(selectedBlock.config.tagAction as string) || "add"}
                  onChange={(event) =>
                    onUpdateBlockConfig(selectedBlock._id, {
                      ...selectedBlock.config,
                      tagAction: event.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="add">Add Tag</option>
                  <option value="remove">Remove Tag</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tag Name</label>
                <Input
                  value={(selectedBlock.config.tagName as string) || ""}
                  onChange={(event) =>
                    onUpdateBlockConfig(selectedBlock._id, {
                      ...selectedBlock.config,
                      tagName: event.target.value,
                    })
                  }
                  placeholder="e.g., onboarded, premium"
                />
              </div>
            </div>
          )}

          {selectedBlockConnections.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Outgoing Connections</p>
              {selectedBlockConnections.map((connection) => (
                <button
                  type="button"
                  key={`selected-${connection._id}`}
                  onClick={() => {
                    onSelectConnection(connection._id);
                    onSelectBlock(null);
                  }}
                  className="w-full rounded-md border px-2 py-2 text-left text-xs hover:bg-gray-50"
                >
                  <span className="font-medium">{connection.condition ?? "default"}</span>
                  {" -> "}
                  {blockMap.get(connection.toBlockId)?.type ?? "?"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedBlock && !selectedConnection && (
        <div className="text-sm text-gray-500">
          Select a block or connection to edit its configuration.
        </div>
      )}
    </div>
  );
}
