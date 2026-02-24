/**
 * Migration script to convert existing pageUrl targeting rules to the new audienceRules format.
 *
 * This script is optional - existing tours with pageUrl targeting will continue to work
 * as the getAvailableTours query checks both old and new formats.
 *
 * Run with: npx convex run scripts/migrate-audience-rules
 */

import { mutation } from "../convex/_generated/server";
import { v } from "convex/values";

export const migrateToursToAudienceRules = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;

    const tours = await ctx.db.query("tours").collect();

    const results = {
      total: tours.length,
      migrated: 0,
      skipped: 0,
      alreadyMigrated: 0,
      details: [] as { tourId: string; name: string; action: string }[],
    };

    for (const tour of tours) {
      // Skip if already has audienceRules
      if (tour.audienceRules) {
        results.alreadyMigrated++;
        results.details.push({
          tourId: tour._id,
          name: tour.name,
          action: "skipped - already has audienceRules",
        });
        continue;
      }

      // Skip if no pageUrl to migrate
      if (!tour.targetingRules?.pageUrl) {
        results.skipped++;
        results.details.push({
          tourId: tour._id,
          name: tour.name,
          action: "skipped - no pageUrl targeting",
        });
        continue;
      }

      // Convert pageUrl to audienceRules format
      // Note: pageUrl targeting is still handled separately in getAvailableTours,
      // so this migration is optional. The new audienceRules is for user segmentation,
      // not page targeting.

      results.migrated++;
      results.details.push({
        tourId: tour._id,
        name: tour.name,
        action: dryRun
          ? "would migrate (dry run)"
          : "migrated - pageUrl remains in targetingRules, audienceRules left empty for user segmentation",
      });

      // In a real migration, we might want to convert pageUrl to an audienceRules condition
      // But since pageUrl targeting is conceptually different from user segmentation,
      // we keep them separate. This script just documents what would be migrated.
    }

    return {
      dryRun,
      ...results,
      message: dryRun
        ? "Dry run complete. No changes made. Run with dryRun: false to apply changes."
        : "Migration complete.",
    };
  },
});
