"use client";

interface OutboundStats {
  shown: number;
  clicked: number;
  dismissed: number;
  clickRate: number;
}

interface OutboundStatisticsPanelProps {
  stats?: OutboundStats | null;
}

export function OutboundStatisticsPanel({ stats }: OutboundStatisticsPanelProps) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Statistics</h2>
      {stats ? (
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Shown</span>
            <span className="font-medium">{stats.shown}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Clicked</span>
            <span className="font-medium">{stats.clicked}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Dismissed</span>
            <span className="font-medium">{stats.dismissed}</span>
          </div>
          <hr />
          <div className="flex justify-between">
            <span className="text-gray-600">Click Rate</span>
            <span className="font-medium">{stats.clickRate.toFixed(1)}%</span>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No data yet</p>
      )}
    </div>
  );
}
