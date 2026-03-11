"use client";

import { GitBranch } from "lucide-react";
import { getSeriesBlockColor, getSeriesBlockIcon } from "./seriesBlockUi";
import type { ReadinessIssue, SeriesBlock, SeriesConnection } from "./seriesEditorTypes";

interface SeriesEditorCanvasProps {
  blocks: SeriesBlock[];
  connections: SeriesConnection[];
  blockMap: Map<string, SeriesBlock>;
  selectedBlockId: string | null;
  selectedConnectionId: string | null;
  readinessBlockers: ReadinessIssue[];
  readinessWarnings: ReadinessIssue[];
  onSelectBlock: (blockId: string) => void;
}

export function SeriesEditorCanvas({
  blocks,
  connections,
  blockMap,
  selectedBlockId,
  selectedConnectionId,
  readinessBlockers,
  readinessWarnings,
  onSelectBlock,
}: SeriesEditorCanvasProps): React.JSX.Element {
  return (
    <div className="flex-1 bg-gray-100 overflow-auto relative">
      <div className="min-h-full min-w-full p-8" style={{ minHeight: "600px", minWidth: "800px" }}>
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
              <p className="text-gray-500 mb-4">Add blocks from the sidebar to build your series</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <svg className="absolute inset-0 h-full w-full pointer-events-none">
              {connections.map((connection) => {
                const from = blockMap.get(connection.fromBlockId);
                const to = blockMap.get(connection.toBlockId);
                if (!from || !to) {
                  return null;
                }

                const x1 = from.position.x + 90;
                const y1 = from.position.y + 48;
                const x2 = to.position.x + 90;
                const y2 = to.position.y;
                const isSelected = selectedConnectionId === connection._id;

                return (
                  <g key={`line-${connection._id}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isSelected ? "hsl(var(--primary))" : "#94a3b8"}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 6}
                      fill={isSelected ? "hsl(var(--primary))" : "#64748b"}
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {connection.condition ?? "default"}
                    </text>
                  </g>
                );
              })}
            </svg>

            {blocks.map((block) => (
              <div
                key={block._id}
                onClick={() => onSelectBlock(block._id)}
                className={`absolute p-4 rounded-lg border-2 cursor-pointer transition-shadow min-w-[180px] ${getSeriesBlockColor(
                  block.type
                )} ${selectedBlockId === block._id ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"} ${
                  readinessBlockers.some((issue) => issue.blockId === block._id) ? "border-red-400" : ""
                }`}
                style={{
                  left: block.position.x,
                  top: block.position.y,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getSeriesBlockIcon(block.type)}
                  <span className="font-medium capitalize">{block.type}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {block.type === "wait" && (
                    <span>
                      {block.config.waitDuration as React.ReactNode}{" "}
                      {block.config.waitUnit as React.ReactNode}
                    </span>
                  )}
                  {block.type === "email" && (
                    <span className="truncate block">{(block.config.subject as string) || "Email"}</span>
                  )}
                  {block.type === "push" && (
                    <span className="truncate block">{(block.config.title as string) || "Push"}</span>
                  )}
                  {block.type === "tag" && (
                    <span>
                      {block.config.tagAction as React.ReactNode} tag:{" "}
                      {(block.config.tagName as string) || "..."}
                    </span>
                  )}
                </div>
                {readinessWarnings.some((issue) => issue.blockId === block._id) && (
                  <div className="mt-2 text-[10px] text-amber-700">Warning</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
