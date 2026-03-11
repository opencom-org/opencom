"use client";

import { Button } from "@opencom/ui";
import { Download } from "lucide-react";
import type { QuestionAnalytics } from "./surveyEditorTypes";

interface SurveyAnalyticsData {
  impressions: {
    shown: number;
    started: number;
  };
  totalResponses: number;
  responseRate: number;
  questionAnalytics: Record<string, QuestionAnalytics>;
}

interface SurveyAnalyticsTabProps {
  analytics: SurveyAnalyticsData | undefined;
  isExporting: boolean;
  exportError: string | null;
  onExportCsv: () => Promise<void>;
}

export function SurveyAnalyticsTab({
  analytics,
  isExporting,
  exportError,
  onExportCsv,
}: SurveyAnalyticsTabProps): React.JSX.Element {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {analytics ? (
        <>
          <div className="flex items-center justify-between bg-white rounded-lg border p-4">
            <div>
              <h3 className="font-medium">Survey Response Export</h3>
              <p className="text-sm text-gray-500 mt-1">
                Download completed and partial survey responses as CSV.
              </p>
            </div>
            <Button data-testid="survey-export-csv-button" onClick={() => void onExportCsv()} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          {exportError && (
            <div
              data-testid="survey-export-error"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {exportError}
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div data-testid="survey-analytics-shown" className="text-2xl font-bold">
                {analytics.impressions.shown}
              </div>
              <div className="text-sm text-gray-500">Shown</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div data-testid="survey-analytics-started" className="text-2xl font-bold">
                {analytics.impressions.started}
              </div>
              <div className="text-sm text-gray-500">Started</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div data-testid="survey-analytics-completed" className="text-2xl font-bold">
                {analytics.totalResponses}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div data-testid="survey-analytics-response-rate" className="text-2xl font-bold">
                {analytics.responseRate}%
              </div>
              <div className="text-sm text-gray-500">Response Rate</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-medium mb-4">Question Results</h3>
            <div className="space-y-6">
              {(Object.values(analytics.questionAnalytics) as QuestionAnalytics[]).map((qa) => (
                <div key={qa.questionId} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium text-gray-500 uppercase">{qa.questionType}</span>
                      <div className="font-medium">{qa.questionTitle}</div>
                    </div>
                    <div className="text-sm text-gray-500">{qa.totalResponses} responses</div>
                  </div>

                  {qa.npsScore !== undefined && (
                    <div className="mb-2">
                      <span
                        className={`text-2xl font-bold ${
                          qa.npsScore >= 50
                            ? "text-green-600"
                            : qa.npsScore >= 0
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {qa.npsScore}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">NPS Score</span>
                    </div>
                  )}

                  {qa.average !== undefined && qa.npsScore === undefined && (
                    <div className="mb-2">
                      <span className="text-2xl font-bold">{qa.average.toFixed(1)}</span>
                      <span className="text-sm text-gray-500 ml-2">Average</span>
                    </div>
                  )}

                  {Object.keys(qa.distribution).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(qa.distribution)
                        .sort(([a], [b]) => {
                          const numA = parseFloat(a);
                          const numB = parseFloat(b);
                          if (!isNaN(numA) && !isNaN(numB)) {
                            return numB - numA;
                          }
                          return b.localeCompare(a);
                        })
                        .map(([value, count]) => (
                          <div key={value} className="flex items-center gap-2">
                            <div className="w-20 text-sm truncate">{value}</div>
                            <div className="flex-1 bg-gray-100 rounded-full h-4">
                              <div
                                className="bg-primary/50 rounded-full h-4"
                                style={{ width: `${(count / qa.totalResponses) * 100}%` }}
                              />
                            </div>
                            <div className="w-12 text-sm text-right">{count}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">Loading analytics...</div>
      )}
    </div>
  );
}
