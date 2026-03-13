"use client";

import { Button } from "@opencom/ui";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Link2,
  Plus,
  X,
} from "lucide-react";
import { getSeriesBlockColor, getSeriesBlockIcon, SERIES_BLOCK_TYPES } from "./seriesBlockUi";
import type {
  BlockType,
  ConnectionCondition,
  ReadinessIssue,
  ReadinessResult,
  SeriesBlock,
  SeriesConnection,
  SeriesStats,
} from "./seriesEditorTypes";

interface SeriesEditorSidebarProps {
  blocks: SeriesBlock[];
  connections: SeriesConnection[];
  blockMap: Map<string, SeriesBlock>;
  selectedConnectionId: string | null;
  connectionFromId: string;
  connectionToId: string;
  connectionCondition: ConnectionCondition;
  entryRulesText: string;
  exitRulesText: string;
  goalRulesText: string;
  readinessResult: ReadinessResult | null;
  readinessBlockers: ReadinessIssue[];
  readinessWarnings: ReadinessIssue[];
  stats: SeriesStats | undefined;
  onAddBlock: (type: BlockType) => void;
  onConnectionFromIdChange: (value: string) => void;
  onConnectionToIdChange: (value: string) => void;
  onConnectionConditionChange: (value: ConnectionCondition) => void;
  onCreateConnection: () => void;
  onSelectConnection: (connectionId: string) => void;
  onDeleteConnection: (connectionId: string) => void;
  onEntryRulesTextChange: (value: string) => void;
  onExitRulesTextChange: (value: string) => void;
  onGoalRulesTextChange: (value: string) => void;
  onFocusIssue: (issue: ReadinessIssue) => void;
}

export function SeriesEditorSidebar({
  blocks,
  connections,
  blockMap,
  selectedConnectionId,
  connectionFromId,
  connectionToId,
  connectionCondition,
  entryRulesText,
  exitRulesText,
  goalRulesText,
  readinessResult,
  readinessBlockers,
  readinessWarnings,
  stats,
  onAddBlock,
  onConnectionFromIdChange,
  onConnectionToIdChange,
  onConnectionConditionChange,
  onCreateConnection,
  onSelectConnection,
  onDeleteConnection,
  onEntryRulesTextChange,
  onExitRulesTextChange,
  onGoalRulesTextChange,
  onFocusIssue,
}: SeriesEditorSidebarProps): React.JSX.Element {
  return (
    <div className="w-80 border-r bg-gray-50 p-4 overflow-auto space-y-6">
      <h3 className="font-medium mb-4">Add Block</h3>
      <div className="grid grid-cols-2 gap-2">
        {SERIES_BLOCK_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onAddBlock(type)}
            className={`p-3 rounded-lg border text-left hover:shadow-sm transition-shadow ${getSeriesBlockColor(type)}`}
          >
            <div className="flex items-center gap-2 mb-1">{getSeriesBlockIcon(type)}</div>
            <div className="text-xs font-medium capitalize">{type}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h4 className="font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Connections
        </h4>
        <div className="space-y-2">
          <label className="block text-xs uppercase text-gray-500">From</label>
          <select
            value={connectionFromId}
            onChange={(event) => onConnectionFromIdChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {blocks.map((block) => (
              <option key={`from-${block._id}`} value={block._id}>
                {block.type} ({block._id.slice(-5)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase text-gray-500">To</label>
          <select
            value={connectionToId}
            onChange={(event) => onConnectionToIdChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {blocks.map((block) => (
              <option key={`to-${block._id}`} value={block._id}>
                {block.type} ({block._id.slice(-5)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase text-gray-500">Condition</label>
          <select
            value={connectionCondition}
            onChange={(event) => onConnectionConditionChange(event.target.value as ConnectionCondition)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="default">default</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </div>
        <Button className="w-full" variant="outline" onClick={onCreateConnection}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>

        <div className="space-y-2">
          {connections.length === 0 && <p className="text-xs text-gray-500">No connections yet.</p>}
          {connections.map((connection) => {
            const from = blockMap.get(connection.fromBlockId);
            const to = blockMap.get(connection.toBlockId);
            return (
              <div
                key={connection._id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConnection(connection._id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectConnection(connection._id);
                  }
                }}
                className={`w-full cursor-pointer text-left rounded-md border px-2 py-2 text-xs transition-colors ${
                  selectedConnectionId === connection._id
                    ? "border-primary bg-primary/10"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{(from?.type ?? "?") + " -> " + (to?.type ?? "?")}</div>
                <div className="flex items-center justify-between mt-1 text-gray-500">
                  <span>branch: {connection.condition ?? "default"}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteConnection(connection._id);
                    }}
                    className="rounded p-1 hover:bg-red-100 text-red-600"
                    aria-label="Delete connection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h4 className="font-medium">Global Rules</h4>
        <div>
          <label className="block text-xs uppercase text-gray-500 mb-1">Entry Rules (JSON)</label>
          <textarea
            value={entryRulesText}
            onChange={(event) => onEntryRulesTextChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-xs font-mono h-20"
            placeholder='{"type":"group","operator":"and","conditions":[]}'
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-500 mb-1">Exit Rules (JSON)</label>
          <textarea
            value={exitRulesText}
            onChange={(event) => onExitRulesTextChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-xs font-mono h-20"
            placeholder='{"type":"group","operator":"and","conditions":[]}'
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-gray-500 mb-1">Goal Rules (JSON)</label>
          <textarea
            value={goalRulesText}
            onChange={(event) => onGoalRulesTextChange(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-xs font-mono h-20"
            placeholder='{"type":"group","operator":"and","conditions":[]}'
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h4 className="font-medium">Readiness</h4>
        {readinessResult ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              {readinessResult.isReady ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-green-700">Ready for activation</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-red-700">Blocked ({readinessBlockers.length})</span>
                </>
              )}
            </div>

            {readinessBlockers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase text-red-700">Blockers</p>
                {readinessBlockers.map((issue, index) => (
                  <button
                    key={`blocker-${issue.code}-${index}`}
                    className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-2 text-left text-xs"
                    onClick={() => onFocusIssue(issue)}
                  >
                    <p className="font-medium text-red-700">{issue.message}</p>
                    <p className="text-red-600">{issue.remediation}</p>
                  </button>
                ))}
              </div>
            )}

            {readinessWarnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase text-amber-700">Warnings</p>
                {readinessWarnings.map((issue, index) => (
                  <button
                    key={`warning-${issue.code}-${index}`}
                    className="w-full rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-left text-xs"
                    onClick={() => onFocusIssue(issue)}
                  >
                    <p className="font-medium text-amber-700">{issue.message}</p>
                    <p className="text-amber-600">{issue.remediation}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">Computing readiness…</p>
        )}
      </div>

      {stats && (
        <div className="mt-6 bg-white rounded-lg p-4 border">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Entered</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active</span>
              <span className="font-medium">{stats.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Waiting</span>
              <span className="font-medium">{stats.waiting}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Completed</span>
              <span className="font-medium">{stats.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Exited</span>
              <span className="font-medium">{stats.exited}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Goal Reached</span>
              <span className="font-medium">{stats.goalReached}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Failed</span>
              <span className="font-medium">{stats.failed}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
