"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Plus,
  Trash2,
  GitBranch,
  Clock,
  Mail,
  Bell,
  MessageSquare,
  Tag,
  Filter,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Link2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type BlockType = "rule" | "wait" | "email" | "push" | "chat" | "post" | "carousel" | "tag";
type ConnectionCondition = "yes" | "no" | "default";

interface SeriesBlock {
  _id: string;
  type: BlockType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

interface SeriesConnection {
  _id: string;
  fromBlockId: string;
  toBlockId: string;
  condition?: ConnectionCondition;
}

interface ReadinessIssue {
  code: string;
  message: string;
  remediation: string;
  blockId?: string;
  connectionId?: string;
}

interface ReadinessResult {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  isReady: boolean;
}

function formatRuleText(value: unknown): string {
  if (!value) return "";
  return JSON.stringify(value, null, 2);
}

function parseRuleText(
  value: string,
  label: string
): { value?: Record<string, unknown>; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return { value: parsed };
  } catch {
    return { error: `${label} must be valid JSON.` };
  }
}

function tryParseActivationError(error: unknown): {
  code?: string;
  blockers?: ReadinessIssue[];
  warnings?: ReadinessIssue[];
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        code?: string;
        blockers?: ReadinessIssue[];
        warnings?: ReadinessIssue[];
        message?: string;
      };
      return {
        code: parsed.code,
        blockers: parsed.blockers,
        warnings: parsed.warnings,
        message: parsed.message ?? raw,
      };
    } catch {
      return { message: raw };
    }
  }

  return { message: raw };
}

function toLocalDateTimeInput(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function SeriesEditor() {
  const params = useParams();
  const seriesId = params.id as Id<"series">;

  const seriesData = useQuery(api.series.getWithBlocks, { id: seriesId });
  const readiness = useQuery(api.series.getReadiness, { id: seriesId });
  const stats = useQuery(api.series.getStats, { id: seriesId });
  const updateSeries = useMutation(api.series.update);
  const activateSeries = useMutation(api.series.activate);
  const pauseSeries = useMutation(api.series.pause);
  const addBlock = useMutation(api.series.addBlock);
  const updateBlock = useMutation(api.series.updateBlock);
  const removeBlock = useMutation(api.series.removeBlock);
  const addConnection = useMutation(api.series.addConnection);
  const removeConnection = useMutation(api.series.removeConnection);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectionFromId, setConnectionFromId] = useState("");
  const [connectionToId, setConnectionToId] = useState("");
  const [connectionCondition, setConnectionCondition] = useState<ConnectionCondition>("default");
  const [entryRulesText, setEntryRulesText] = useState("");
  const [exitRulesText, setExitRulesText] = useState("");
  const [goalRulesText, setGoalRulesText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ruleEditorError, setRuleEditorError] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationIssues, setActivationIssues] = useState<ReadinessResult | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const blocks = useMemo(
    () => (seriesData?.blocks || []) as unknown as SeriesBlock[],
    [seriesData]
  );
  const connections = useMemo(
    () => (seriesData?.connections || []) as unknown as SeriesConnection[],
    [seriesData]
  );
  const blockMap = useMemo(
    () => new Map(blocks.map((block) => [block._id, block] as const)),
    [blocks]
  );
  const selectedBlock = useMemo(
    () => blocks.find((block) => block._id === selectedBlockId),
    [blocks, selectedBlockId]
  );
  const selectedConnection = useMemo(
    () => connections.find((connection) => connection._id === selectedConnectionId),
    [connections, selectedConnectionId]
  );
  const selectedBlockConnections = useMemo(() => {
    if (!selectedBlock) return [];
    return connections.filter((connection) => connection.fromBlockId === selectedBlock._id);
  }, [connections, selectedBlock]);
  const readinessResult = (activationIssues ?? readiness ?? null) as ReadinessResult | null;

  useEffect(() => {
    if (seriesData) {
      setName(seriesData.name);
      setDescription(seriesData.description || "");
      setEntryRulesText(
        formatRuleText((seriesData as unknown as { entryRules?: unknown }).entryRules)
      );
      setExitRulesText(
        formatRuleText((seriesData as unknown as { exitRules?: unknown }).exitRules)
      );
      setGoalRulesText(
        formatRuleText((seriesData as unknown as { goalRules?: unknown }).goalRules)
      );
    }
  }, [seriesData]);

  useEffect(() => {
    if (blocks.length === 0) {
      setConnectionFromId("");
      setConnectionToId("");
      return;
    }

    const hasFrom = blocks.some((block) => block._id === connectionFromId);
    const nextFromId = hasFrom ? connectionFromId : blocks[0]._id;
    if (!hasFrom) {
      setConnectionFromId(nextFromId);
    }

    const hasTo = blocks.some((block) => block._id === connectionToId);
    let nextToId = hasTo ? connectionToId : blocks[Math.min(1, blocks.length - 1)]._id;

    if (blocks.length > 1 && nextToId === nextFromId) {
      const alternateTargetId = blocks.find((block) => block._id !== nextFromId)?._id;
      if (alternateTargetId) {
        nextToId = alternateTargetId;
      }
    }

    if (nextToId !== connectionToId) {
      setConnectionToId(nextToId);
    }

    if (
      selectedConnectionId &&
      !connections.some((connection) => connection._id === selectedConnectionId)
    ) {
      setSelectedConnectionId(null);
    }
    if (selectedBlockId && !blocks.some((block) => block._id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [
    blocks,
    connections,
    connectionFromId,
    connectionToId,
    selectedBlockId,
    selectedConnectionId,
  ]);

  const handleSave = async () => {
    const entryRulesResult = parseRuleText(entryRulesText, "Entry rules");
    const exitRulesResult = parseRuleText(exitRulesText, "Exit rules");
    const goalRulesResult = parseRuleText(goalRulesText, "Goal rules");
    const parseError = entryRulesResult.error || exitRulesResult.error || goalRulesResult.error;
    if (parseError) {
      setRuleEditorError(parseError);
      return;
    }

    setRuleEditorError(null);
    setSaveError(null);
    setIsSaving(true);
    try {
      await updateSeries({
        id: seriesId,
        name,
        description: description || undefined,
        entryRules: entryRulesResult.value as never,
        exitRules: exitRulesResult.value as never,
        goalRules: goalRulesResult.value as never,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save series");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (seriesData?.status === "active") {
      setActivationError(null);
      setActivationIssues(null);
      await pauseSeries({ id: seriesId });
      return;
    }

    setActivationError(null);
    setActivationIssues(null);
    if (readinessResult && readinessResult.blockers.length > 0) {
      setActivationIssues(readinessResult);
      setActivationError("Activation blocked. Resolve readiness blockers before activating.");
      return;
    }

    try {
      await activateSeries({ id: seriesId });
    } catch (error) {
      const parsed = tryParseActivationError(error);
      setActivationError(parsed.message);
      if (parsed.blockers || parsed.warnings) {
        setActivationIssues({
          blockers: parsed.blockers || [],
          warnings: parsed.warnings || [],
          isReady: (parsed.blockers || []).length === 0,
        });
      }
    }
  };

  const handleCreateConnection = async () => {
    if (!connectionFromId || !connectionToId) {
      setConnectionError("Select both source and destination blocks.");
      return;
    }
    if (connectionFromId === connectionToId) {
      setConnectionError("Connection source and destination must be different blocks.");
      return;
    }

    setConnectionError(null);
    await addConnection({
      seriesId,
      fromBlockId: connectionFromId as Id<"seriesBlocks">,
      toBlockId: connectionToId as Id<"seriesBlocks">,
      condition: connectionCondition,
    });
  };

  const handleDeleteConnection = async (connectionId: string) => {
    await removeConnection({ id: connectionId as Id<"seriesConnections"> });
    setSelectedConnectionId(null);
  };

  const handleUpdateConnectionCondition = async (
    connection: SeriesConnection,
    condition: ConnectionCondition
  ) => {
    await addConnection({
      seriesId,
      fromBlockId: connection.fromBlockId as Id<"seriesBlocks">,
      toBlockId: connection.toBlockId as Id<"seriesBlocks">,
      condition,
    });
    await removeConnection({ id: connection._id as Id<"seriesConnections"> });
    setSelectedConnectionId(null);
  };

  const focusIssue = (issue: ReadinessIssue) => {
    if (issue.blockId) {
      setSelectedConnectionId(null);
      setSelectedBlockId(issue.blockId);
    } else {
      setSelectedBlockId(null);
      setSelectedConnectionId(issue.connectionId || null);
    }
  };

  const handleAddBlock = async (type: BlockType) => {
    const blocks = seriesData?.blocks || [];
    const maxY = blocks.reduce(
      (max: number, b: unknown) => Math.max(max, (b as SeriesBlock).position.y),
      0
    );

    await addBlock({
      seriesId,
      type,
      position: { x: 200, y: maxY + 150 },
      config: getDefaultConfig(type),
    });
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("Delete this block?")) return;
    await removeBlock({ id: blockId as Id<"seriesBlocks"> });
    setSelectedBlockId(null);
  };

  const handleUpdateBlockConfig = async (blockId: string, config: Record<string, unknown>) => {
    await updateBlock({
      id: blockId as Id<"seriesBlocks">,
      config,
    });
  };

  const getDefaultConfig = (type: BlockType): Record<string, unknown> => {
    switch (type) {
      case "wait":
        return { waitType: "duration", waitDuration: 1, waitUnit: "days" };
      case "email":
        return { subject: "Email subject", body: "Email content" };
      case "push":
        return { title: "Push title", body: "Push message" };
      case "chat":
        return { body: "Chat message" };
      case "tag":
        return { tagAction: "add", tagName: "" };
      case "post":
        return { body: "Post content" };
      case "carousel":
        return { body: "Carousel content" };
      default:
        return {};
    }
  };

  const getBlockIcon = (type: BlockType) => {
    switch (type) {
      case "rule":
        return <Filter className="h-4 w-4" />;
      case "wait":
        return <Clock className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "push":
        return <Bell className="h-4 w-4" />;
      case "chat":
        return <MessageSquare className="h-4 w-4" />;
      case "post":
        return <MessageSquare className="h-4 w-4" />;
      case "carousel":
        return <GitBranch className="h-4 w-4" />;
      case "tag":
        return <Tag className="h-4 w-4" />;
    }
  };

  const getBlockColor = (type: BlockType) => {
    switch (type) {
      case "rule":
        return "bg-purple-100 border-purple-300";
      case "wait":
        return "bg-yellow-100 border-yellow-300";
      case "email":
        return "bg-primary/10 border-primary/30";
      case "push":
        return "bg-green-100 border-green-300";
      case "chat":
        return "bg-cyan-100 border-cyan-300";
      case "post":
        return "bg-indigo-100 border-indigo-300";
      case "carousel":
        return "bg-pink-100 border-pink-300";
      case "tag":
        return "bg-orange-100 border-orange-300";
    }
  };

  if (!seriesData) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const readinessBlockers = readinessResult?.blockers ?? [];
  const readinessWarnings = readinessResult?.warnings ?? [];
  const isReadyForActivation = readinessBlockers.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold border-none p-0 focus:ring-0"
              placeholder="Series name"
            />
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  seriesData.status === "active"
                    ? "bg-green-100 text-green-800"
                    : seriesData.status === "paused"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {seriesData.status}
              </span>
              <span className="text-sm text-gray-500">{blocks.length} blocks</span>
              {!isReadyForActivation && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3 w-3" />
                  {readinessBlockers.length} blocker{readinessBlockers.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            disabled={seriesData.status !== "active" && !isReadyForActivation}
            title={
              seriesData.status !== "active" && !isReadyForActivation
                ? "Resolve readiness blockers before activation"
                : undefined
            }
          >
            {seriesData.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      {(saveError || ruleEditorError || activationError || connectionError) && (
        <div className="border-b bg-red-50 px-6 py-3 text-sm text-red-700 space-y-1">
          {saveError && <p>{saveError}</p>}
          {ruleEditorError && <p>{ruleEditorError}</p>}
          {activationError && <p>{activationError}</p>}
          {connectionError && <p>{connectionError}</p>}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r bg-gray-50 p-4 overflow-auto space-y-6">
          <h3 className="font-medium mb-4">Add Block</h3>
          <div className="grid grid-cols-2 gap-2">
            {(
              ["rule", "wait", "email", "push", "chat", "post", "carousel", "tag"] as BlockType[]
            ).map((type) => (
              <button
                key={type}
                onClick={() => handleAddBlock(type)}
                className={`p-3 rounded-lg border text-left hover:shadow-sm transition-shadow ${getBlockColor(type)}`}
              >
                <div className="flex items-center gap-2 mb-1">{getBlockIcon(type)}</div>
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
                onChange={(event) => setConnectionFromId(event.target.value)}
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
                onChange={(event) => setConnectionToId(event.target.value)}
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
                onChange={(event) =>
                  setConnectionCondition(event.target.value as ConnectionCondition)
                }
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="default">default</option>
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            </div>
            <Button className="w-full" variant="outline" onClick={handleCreateConnection}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connection
            </Button>

            <div className="space-y-2">
              {connections.length === 0 && (
                <p className="text-xs text-gray-500">No connections yet.</p>
              )}
              {connections.map((connection) => {
                const from = blockMap.get(connection.fromBlockId);
                const to = blockMap.get(connection.toBlockId);
                return (
                  <div
                    key={connection._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedConnectionId(connection._id);
                      setSelectedBlockId(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedConnectionId(connection._id);
                        setSelectedBlockId(null);
                      }
                    }}
                    className={`w-full cursor-pointer text-left rounded-md border px-2 py-2 text-xs transition-colors ${
                      selectedConnectionId === connection._id
                        ? "border-primary bg-primary/10"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium">
                      {(from?.type ?? "?") + " -> " + (to?.type ?? "?")}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-gray-500">
                      <span>branch: {connection.condition ?? "default"}</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteConnection(connection._id);
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
              <label className="block text-xs uppercase text-gray-500 mb-1">
                Entry Rules (JSON)
              </label>
              <textarea
                value={entryRulesText}
                onChange={(event) => setEntryRulesText(event.target.value)}
                className="w-full rounded-md border px-3 py-2 text-xs font-mono h-20"
                placeholder='{"type":"group","operator":"and","conditions":[]}'
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-gray-500 mb-1">
                Exit Rules (JSON)
              </label>
              <textarea
                value={exitRulesText}
                onChange={(event) => setExitRulesText(event.target.value)}
                className="w-full rounded-md border px-3 py-2 text-xs font-mono h-20"
                placeholder='{"type":"group","operator":"and","conditions":[]}'
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-gray-500 mb-1">
                Goal Rules (JSON)
              </label>
              <textarea
                value={goalRulesText}
                onChange={(event) => setGoalRulesText(event.target.value)}
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
                        onClick={() => focusIssue(issue)}
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
                        onClick={() => focusIssue(issue)}
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

        <div className="flex-1 bg-gray-100 overflow-auto relative">
          <div
            className="min-h-full min-w-full p-8"
            style={{ minHeight: "600px", minWidth: "800px" }}
          >
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No blocks yet</h3>
                  <p className="text-gray-500 mb-4">
                    Add blocks from the sidebar to build your series
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <svg className="absolute inset-0 h-full w-full pointer-events-none">
                  {connections.map((connection) => {
                    const from = blockMap.get(connection.fromBlockId);
                    const to = blockMap.get(connection.toBlockId);
                    if (!from || !to) return null;

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
                    onClick={() => {
                      setSelectedBlockId(block._id);
                      setSelectedConnectionId(null);
                    }}
                    className={`absolute p-4 rounded-lg border-2 cursor-pointer transition-shadow min-w-[180px] ${getBlockColor(
                      block.type
                    )} ${selectedBlockId === block._id ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"} ${
                      readinessBlockers.some((issue) => issue.blockId === block._id)
                        ? "border-red-400"
                        : ""
                    }`}
                    style={{
                      left: block.position.x,
                      top: block.position.y,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getBlockIcon(block.type)}
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
                        <span className="truncate block">
                          {(block.config.subject as string) || "Email"}
                        </span>
                      )}
                      {block.type === "push" && (
                        <span className="truncate block">
                          {(block.config.title as string) || "Push"}
                        </span>
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

        <div className="w-96 border-l bg-white p-6 overflow-auto">
          {selectedConnection && (
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Connection</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteConnection(selectedConnection._id)}
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
                    handleUpdateConnectionCondition(
                      selectedConnection,
                      event.target.value as ConnectionCondition
                    )
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
                  onClick={() => handleDeleteBlock(selectedBlock._id)}
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
                        setRuleEditorError(parsed.error);
                        return;
                      }
                      setRuleEditorError(null);
                      handleUpdateBlockConfig(selectedBlock._id, {
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wait Type
                    </label>
                    <select
                      value={(selectedBlock.config.waitType as string) || "duration"}
                      onChange={(event) =>
                        handleUpdateBlockConfig(selectedBlock._id, {
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
                          handleUpdateBlockConfig(selectedBlock._id, {
                            ...selectedBlock.config,
                            waitDuration: parseInt(event.target.value),
                          })
                        }
                        className="flex-1"
                      />
                      <select
                        value={(selectedBlock.config.waitUnit as string) || "days"}
                        onChange={(event) =>
                          handleUpdateBlockConfig(selectedBlock._id, {
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Resume At
                      </label>
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeInput(
                          selectedBlock.config.waitUntilDate as number | undefined
                        )}
                        onChange={(event) =>
                          handleUpdateBlockConfig(selectedBlock._id, {
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Event Name
                      </label>
                      <Input
                        value={(selectedBlock.config.waitUntilEvent as string) || ""}
                        onChange={(event) =>
                          handleUpdateBlockConfig(selectedBlock._id, {
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject
                      </label>
                      <Input
                        value={(selectedBlock.config.subject as string) || ""}
                        onChange={(event) =>
                          handleUpdateBlockConfig(selectedBlock._id, {
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
                          handleUpdateBlockConfig(selectedBlock._id, {
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
                        handleUpdateBlockConfig(selectedBlock._id, {
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
                        handleUpdateBlockConfig(selectedBlock._id, {
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
                        handleUpdateBlockConfig(selectedBlock._id, {
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
                        setSelectedConnectionId(connection._id);
                        setSelectedBlockId(null);
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
      </div>
    </div>
  );
}

export default function SeriesPage() {
  return (
    <AppLayout>
      <SeriesEditor />
    </AppLayout>
  );
}
