# Migration Retention Notes

Date: 2026-02-23

These migration modules are intentionally retained for deployment safety and
auditable schema transition history.

## Classification

| File                                | Status                  | Why Retained                                                                          | Removal Trigger                                                                                   | Owner               |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| `backfillHelpCenterAccessPolicy.ts` | `retain-with-rationale` | Ensures legacy workspace documents without a help-center policy default to `public`.  | Remove once all supported deployments report no missing `helpCenterAccessPolicy` values.          | Backend maintainers |
| `migrateAuthSessions.ts`            | `retain-with-rationale` | Documents the Convex Auth cutover expectation that existing sessions are invalidated. | Remove after maintainers no longer support deployments predating Convex Auth migration.           | Backend maintainers |
| `migrateRolesToPermissions.ts`      | `retain-with-rationale` | Supports role-to-permission model migration and verification in legacy workspaces.    | Remove when all active deployments are verified migrated and rollback path is no longer required. | Backend maintainers |
| `removePasswordHash.ts`             | `retain-with-rationale` | Cleanup path for legacy `passwordHash` field in older user documents.                 | Remove after `verifyMigration` reports complete in all maintained environments.                   | Backend maintainers |
| `removeUseSignedSessions.ts`        | `retain-with-rationale` | Cleanup path for legacy `useSignedSessions` workspace field.                          | Remove after `verifyMigration` reports complete in all maintained environments.                   | Backend maintainers |

## Verification Requirement

Before deleting any retained migration, capture evidence that:

1. No supported deployment still depends on the migration.
2. A rollback/recovery alternative exists for the relevant schema transition.
3. Release notes document the removal and its operational impact.
