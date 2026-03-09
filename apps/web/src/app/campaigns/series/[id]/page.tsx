"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { appConfirm } from "@/lib/appConfirm";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { AlertTriangle, ArrowLeft, Pause, Play, Save } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { SeriesEditorSidebar } from "./SeriesEditorSidebar";
import { SeriesEditorCanvas } from "./SeriesEditorCanvas";
import { SeriesEditorInspector } from "./SeriesEditorInspector";
import {
  formatRuleText,
  getDefaultConfig,
  parseRuleText,
  tryParseActivationError,
  type BlockType,
  type ConnectionCondition,
  type ReadinessIssue,
  type ReadinessResult,
  type SeriesBlock,
  type SeriesConnection,
  type SeriesStats,
} from "./seriesEditorTypes";

function SeriesEditor() {
  const params = useParams();
  const seriesId = params.id as Id<"series">;

  const seriesDataQuery = makeFunctionReference<
    "query",
    { id: Id<"series"> },
    {
      _id: Id<"series">;
      name: string;
      description?: string;
      status?: string;
      blocks?: unknown[];
      connections?: unknown[];
      entryRules?: unknown;
      exitRules?: unknown;
      goalRules?: unknown;
    } | null
  >("series:getWithBlocks");
  const readinessQuery = makeFunctionReference<
    "query",
    { id: Id<"series"> },
    ReadinessResult | null
  >("series:getReadiness");
  const statsQuery = makeFunctionReference<
    "query",
    { id: Id<"series"> },
    SeriesStats | null
  >("series:getStats");
  const updateSeriesRef = makeFunctionReference<"mutation", any, unknown>("series:update");
  const activateSeriesRef = makeFunctionReference<"mutation", { id: Id<"series"> }, unknown>(
    "series:activate"
  );
  const pauseSeriesRef = makeFunctionReference<"mutation", { id: Id<"series"> }, unknown>(
    "series:pause"
  );
  const addBlockRef = makeFunctionReference<"mutation", any, unknown>("series:addBlock");
  const updateBlockRef = makeFunctionReference<"mutation", any, unknown>("series:updateBlock");
  const removeBlockRef = makeFunctionReference<"mutation", { id: Id<"seriesBlocks"> }, unknown>(
    "series:removeBlock"
  );
  const addConnectionRef = makeFunctionReference<"mutation", any, unknown>("series:addConnection");
  const removeConnectionRef = makeFunctionReference<
    "mutation",
    { id: Id<"seriesConnections"> },
    unknown
  >("series:removeConnection");

  const seriesData = useQuery(seriesDataQuery, { id: seriesId });
  const readiness = useQuery(readinessQuery, { id: seriesId });
  const stats = useQuery(statsQuery, { id: seriesId });
  const updateSeries = useMutation(updateSeriesRef);
  const activateSeries = useMutation(activateSeriesRef);
  const pauseSeries = useMutation(pauseSeriesRef);
  const addBlock = useMutation(addBlockRef);
  const updateBlock = useMutation(updateBlockRef);
  const removeBlock = useMutation(removeBlockRef);
  const addConnection = useMutation(addConnectionRef);
  const removeConnection = useMutation(removeConnectionRef);

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
    if (!(await appConfirm("Delete this block?"))) return;
    await removeBlock({ id: blockId as Id<"seriesBlocks"> });
    setSelectedBlockId(null);
  };

  const handleUpdateBlockConfig = async (blockId: string, config: Record<string, unknown>) => {
    await updateBlock({
      id: blockId as Id<"seriesBlocks">,
      config,
    });
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
        <SeriesEditorSidebar
          blocks={blocks}
          connections={connections}
          blockMap={blockMap}
          selectedConnectionId={selectedConnectionId}
          connectionFromId={connectionFromId}
          connectionToId={connectionToId}
          connectionCondition={connectionCondition}
          entryRulesText={entryRulesText}
          exitRulesText={exitRulesText}
          goalRulesText={goalRulesText}
          readinessResult={readinessResult}
          readinessBlockers={readinessBlockers}
          readinessWarnings={readinessWarnings}
          stats={stats as SeriesStats | undefined}
          onAddBlock={(type) => {
            void handleAddBlock(type);
          }}
          onConnectionFromIdChange={setConnectionFromId}
          onConnectionToIdChange={setConnectionToId}
          onConnectionConditionChange={setConnectionCondition}
          onCreateConnection={() => {
            void handleCreateConnection();
          }}
          onSelectConnection={(connectionId) => {
            setSelectedConnectionId(connectionId);
            setSelectedBlockId(null);
          }}
          onDeleteConnection={(connectionId) => {
            void handleDeleteConnection(connectionId);
          }}
          onEntryRulesTextChange={setEntryRulesText}
          onExitRulesTextChange={setExitRulesText}
          onGoalRulesTextChange={setGoalRulesText}
          onFocusIssue={focusIssue}
        />
        <SeriesEditorCanvas
          blocks={blocks}
          connections={connections}
          blockMap={blockMap}
          selectedBlockId={selectedBlockId}
          selectedConnectionId={selectedConnectionId}
          readinessBlockers={readinessBlockers}
          readinessWarnings={readinessWarnings}
          onSelectBlock={(blockId) => {
            setSelectedBlockId(blockId);
            setSelectedConnectionId(null);
          }}
        />
        <SeriesEditorInspector
          selectedConnection={selectedConnection}
          selectedBlock={selectedBlock}
          selectedBlockConnections={selectedBlockConnections}
          blockMap={blockMap}
          onDeleteConnection={(connectionId) => {
            void handleDeleteConnection(connectionId);
          }}
          onUpdateConnectionCondition={(connection, condition) => {
            void handleUpdateConnectionCondition(connection, condition);
          }}
          onDeleteBlock={(blockId) => {
            void handleDeleteBlock(blockId);
          }}
          onUpdateBlockConfig={(blockId, config) => {
            void handleUpdateBlockConfig(blockId, config);
          }}
          onSelectConnection={setSelectedConnectionId}
          onSelectBlock={setSelectedBlockId}
          onSetRuleEditorError={setRuleEditorError}
        />
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
