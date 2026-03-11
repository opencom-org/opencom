"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type {
  BlockType,
  ConnectionCondition,
  ReadinessResult,
  SeriesBlock,
  SeriesConnection,
  SeriesStats,
} from "../series/[id]/seriesEditorTypes";

type SeriesArgs = {
  id: Id<"series">;
};

type SeriesDataRecord = {
  _id: Id<"series">;
  name: string;
  description?: string;
  status?: string;
  blocks?: SeriesBlock[];
  connections?: SeriesConnection[];
  entryRules?: unknown;
  exitRules?: unknown;
  goalRules?: unknown;
} | null;

type UpdateSeriesArgs = {
  id: Id<"series">;
  name: string;
  description?: string;
  entryRules?: unknown;
  exitRules?: unknown;
  goalRules?: unknown;
};

type ToggleSeriesArgs = {
  id: Id<"series">;
};

type AddBlockArgs = {
  seriesId: Id<"series">;
  type: BlockType;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

type UpdateBlockArgs = {
  id: Id<"seriesBlocks">;
  config: Record<string, unknown>;
};

type RemoveBlockArgs = {
  id: Id<"seriesBlocks">;
};

type AddConnectionArgs = {
  seriesId: Id<"series">;
  fromBlockId: Id<"seriesBlocks">;
  toBlockId: Id<"seriesBlocks">;
  condition: ConnectionCondition;
};

type RemoveConnectionArgs = {
  id: Id<"seriesConnections">;
};

const SERIES_DATA_QUERY_REF = webQueryRef<SeriesArgs, SeriesDataRecord>("series:getWithBlocks");
const READINESS_QUERY_REF = webQueryRef<SeriesArgs, ReadinessResult | null>("series:getReadiness");
const STATS_QUERY_REF = webQueryRef<SeriesArgs, SeriesStats | null>("series:getStats");
const UPDATE_SERIES_REF = webMutationRef<UpdateSeriesArgs, null>("series:update");
const ACTIVATE_SERIES_REF = webMutationRef<ToggleSeriesArgs, null>("series:activate");
const PAUSE_SERIES_REF = webMutationRef<ToggleSeriesArgs, null>("series:pause");
const ADD_BLOCK_REF = webMutationRef<AddBlockArgs, null>("series:addBlock");
const UPDATE_BLOCK_REF = webMutationRef<UpdateBlockArgs, null>("series:updateBlock");
const REMOVE_BLOCK_REF = webMutationRef<RemoveBlockArgs, null>("series:removeBlock");
const ADD_CONNECTION_REF = webMutationRef<AddConnectionArgs, null>("series:addConnection");
const REMOVE_CONNECTION_REF = webMutationRef<RemoveConnectionArgs, null>("series:removeConnection");

type UseSeriesEditorConvexOptions = {
  seriesId: Id<"series">;
};

export function useSeriesEditorConvex({ seriesId }: UseSeriesEditorConvexOptions) {
  return {
    activateSeries: useWebMutation(ACTIVATE_SERIES_REF),
    addBlock: useWebMutation(ADD_BLOCK_REF),
    addConnection: useWebMutation(ADD_CONNECTION_REF),
    pauseSeries: useWebMutation(PAUSE_SERIES_REF),
    readiness: useWebQuery(READINESS_QUERY_REF, { id: seriesId }),
    removeBlock: useWebMutation(REMOVE_BLOCK_REF),
    removeConnection: useWebMutation(REMOVE_CONNECTION_REF),
    seriesData: useWebQuery(SERIES_DATA_QUERY_REF, { id: seriesId }),
    stats: useWebQuery(STATS_QUERY_REF, { id: seriesId }),
    updateBlock: useWebMutation(UPDATE_BLOCK_REF),
    updateSeries: useWebMutation(UPDATE_SERIES_REF),
  };
}
