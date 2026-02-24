/**
 * Migration Script: targeting → audienceRules
 *
 * This script migrates existing records from the deprecated `targeting` field
 * to the new `audienceRules` field for unified customer segmentation.
 *
 * Run with: npx convex run scripts/migrate-targeting-to-audience-rules
 *
 * Tables affected:
 * - tours
 * - surveys
 * - outboundMessages
 * - checklists
 * - carousels
 * - pushCampaigns
 * - emailCampaigns
 */

import { mutation } from "../convex/_generated/server";
import { v } from "convex/values";

export const migrateTargetingToAudienceRules = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    table: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const targetTable = args.table;

    const results: Record<string, { migrated: number; skipped: number; errors: string[] }> = {};

    const tables = [
      "tours",
      "surveys",
      "outboundMessages",
      "checklists",
      "carousels",
      "pushCampaigns",
      "emailCampaigns",
    ] as const;

    for (const tableName of tables) {
      if (targetTable && tableName !== targetTable) continue;

      results[tableName] = { migrated: 0, skipped: 0, errors: [] };

      try {
        const records = await ctx.db.query(tableName).collect();

        for (const record of records) {
          const rec = record as Record<string, unknown>;

          // Skip if already has audienceRules
          if (rec.audienceRules !== undefined) {
            results[tableName].skipped++;
            continue;
          }

          // Skip if no targeting to migrate
          if (rec.targeting === undefined || rec.targeting === null) {
            results[tableName].skipped++;
            continue;
          }

          // Migrate targeting to audienceRules
          if (!dryRun) {
            await ctx.db.patch(record._id, {
              audienceRules: rec.targeting,
            });
          }

          results[tableName].migrated++;
        }
      } catch (error) {
        results[tableName].errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return {
      dryRun,
      results,
      summary: {
        totalMigrated: Object.values(results).reduce((sum, r) => sum + r.migrated, 0),
        totalSkipped: Object.values(results).reduce((sum, r) => sum + r.skipped, 0),
        totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0),
      },
    };
  },
});

export const checkMigrationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "tours",
      "surveys",
      "outboundMessages",
      "checklists",
      "carousels",
      "pushCampaigns",
      "emailCampaigns",
    ] as const;

    const status: Record<
      string,
      {
        total: number;
        hasAudienceRules: number;
        hasTargetingOnly: number;
        hasBoth: number;
        hasNeither: number;
      }
    > = {};

    for (const tableName of tables) {
      const records = await ctx.db.query(tableName).collect();

      let hasAudienceRules = 0;
      let hasTargetingOnly = 0;
      let hasBoth = 0;
      let hasNeither = 0;

      for (const record of records) {
        const rec = record as Record<string, unknown>;
        const hasAR = rec.audienceRules !== undefined && rec.audienceRules !== null;
        const hasT = rec.targeting !== undefined && rec.targeting !== null;

        if (hasAR && hasT) hasBoth++;
        else if (hasAR) hasAudienceRules++;
        else if (hasT) hasTargetingOnly++;
        else hasNeither++;
      }

      status[tableName] = {
        total: records.length,
        hasAudienceRules,
        hasTargetingOnly,
        hasBoth,
        hasNeither,
      };
    }

    return {
      status,
      migrationComplete: Object.values(status).every((s) => s.hasTargetingOnly === 0),
    };
  },
});
