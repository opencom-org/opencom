/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiAgent from "../aiAgent.js";
import type * as aiAgentActions from "../aiAgentActions.js";
import type * as articles from "../articles.js";
import type * as assignmentRules from "../assignmentRules.js";
import type * as audienceRules from "../audienceRules.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as authConvex from "../authConvex.js";
import type * as authoringSessions from "../authoringSessions.js";
import type * as autoTagRules from "../autoTagRules.js";
import type * as automationSettings from "../automationSettings.js";
import type * as carousels from "../carousels.js";
import type * as carousels_authoring from "../carousels/authoring.js";
import type * as carousels_delivery from "../carousels/delivery.js";
import type * as carousels_helpers from "../carousels/helpers.js";
import type * as carousels_triggering from "../carousels/triggering.js";
import type * as checklists from "../checklists.js";
import type * as collections from "../collections.js";
import type * as commonIssueButtons from "../commonIssueButtons.js";
import type * as contentFolders from "../contentFolders.js";
import type * as conversations from "../conversations.js";
import type * as discovery from "../discovery.js";
import type * as email from "../email.js";
import type * as emailCampaigns from "../emailCampaigns.js";
import type * as emailChannel from "../emailChannel.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as embeddings from "../embeddings.js";
import type * as embeddings_functionRefs from "../embeddings/functionRefs.js";
import type * as events from "../events.js";
import type * as helpCenterImports from "../helpCenterImports.js";
import type * as helpCenterImports_exportPipeline from "../helpCenterImports/exportPipeline.js";
import type * as helpCenterImports_markdownParse from "../helpCenterImports/markdownParse.js";
import type * as helpCenterImports_pathUtils from "../helpCenterImports/pathUtils.js";
import type * as helpCenterImports_referenceRewrite from "../helpCenterImports/referenceRewrite.js";
import type * as helpCenterImports_restorePipeline from "../helpCenterImports/restorePipeline.js";
import type * as helpCenterImports_sourceQueries from "../helpCenterImports/sourceQueries.js";
import type * as helpCenterImports_syncPipeline from "../helpCenterImports/syncPipeline.js";
import type * as http from "../http.js";
import type * as identityVerification from "../identityVerification.js";
import type * as internalArticles from "../internalArticles.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_aiGateway from "../lib/aiGateway.js";
import type * as lib_authWrappers from "../lib/authWrappers.js";
import type * as lib_notificationPreferences from "../lib/notificationPreferences.js";
import type * as lib_seriesRuntimeAdapter from "../lib/seriesRuntimeAdapter.js";
import type * as lib_unifiedArticles from "../lib/unifiedArticles.js";
import type * as messages from "../messages.js";
import type * as messengerHomeConfig from "../messengerHomeConfig.js";
import type * as messengerSettings from "../messengerSettings.js";
import type * as messengerSettingsAccess from "../messengerSettingsAccess.js";
import type * as messengerSettingsCore from "../messengerSettingsCore.js";
import type * as messengerSettingsShared from "../messengerSettingsShared.js";
import type * as migrations_backfillHelpCenterAccessPolicy from "../migrations/backfillHelpCenterAccessPolicy.js";
import type * as migrations_migrateAuthSessions from "../migrations/migrateAuthSessions.js";
import type * as migrations_migrateRolesToPermissions from "../migrations/migrateRolesToPermissions.js";
import type * as migrations_removePasswordHash from "../migrations/removePasswordHash.js";
import type * as migrations_removeUseSignedSessions from "../migrations/removeUseSignedSessions.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as notifications from "../notifications.js";
import type * as notifications_contracts from "../notifications/contracts.js";
import type * as notifications_dispatch from "../notifications/dispatch.js";
import type * as notifications_emitters_chat from "../notifications/emitters/chat.js";
import type * as notifications_emitters_ticket from "../notifications/emitters/ticket.js";
import type * as notifications_functionRefs from "../notifications/functionRefs.js";
import type * as notifications_helpers from "../notifications/helpers.js";
import type * as notifications_recipients from "../notifications/recipients.js";
import type * as notifications_routing from "../notifications/routing.js";
import type * as officeHours from "../officeHours.js";
import type * as originValidation from "../originValidation.js";
import type * as outboundContracts from "../outboundContracts.js";
import type * as outboundMessages from "../outboundMessages.js";
import type * as permissions from "../permissions.js";
import type * as push from "../push.js";
import type * as push_functionRefs from "../push/functionRefs.js";
import type * as pushCampaigns from "../pushCampaigns.js";
import type * as pushTokens from "../pushTokens.js";
import type * as reporting from "../reporting.js";
import type * as reporting_agentMetrics from "../reporting/agentMetrics.js";
import type * as reporting_aiMetrics from "../reporting/aiMetrics.js";
import type * as reporting_conversationMetrics from "../reporting/conversationMetrics.js";
import type * as reporting_csatMetrics from "../reporting/csatMetrics.js";
import type * as reporting_dashboard from "../reporting/dashboard.js";
import type * as reporting_helpers from "../reporting/helpers.js";
import type * as reporting_snapshots from "../reporting/snapshots.js";
import type * as schema_authWorkspaceTables from "../schema/authWorkspaceTables.js";
import type * as schema_campaignCarouselTables from "../schema/campaignCarouselTables.js";
import type * as schema_campaignEmailTables from "../schema/campaignEmailTables.js";
import type * as schema_campaignPushTables from "../schema/campaignPushTables.js";
import type * as schema_campaignSeriesTables from "../schema/campaignSeriesTables.js";
import type * as schema_campaignSurveyTables from "../schema/campaignSurveyTables.js";
import type * as schema_campaignTables from "../schema/campaignTables.js";
import type * as schema_engagementTables from "../schema/engagementTables.js";
import type * as schema_helpCenterTables from "../schema/helpCenterTables.js";
import type * as schema_inboxConversationTables from "../schema/inboxConversationTables.js";
import type * as schema_inboxNotificationRoutingTables from "../schema/inboxNotificationRoutingTables.js";
import type * as schema_inboxNotificationTables from "../schema/inboxNotificationTables.js";
import type * as schema_inboxPushTokenTables from "../schema/inboxPushTokenTables.js";
import type * as schema_operationsAiTables from "../schema/operationsAiTables.js";
import type * as schema_operationsMessengerTables from "../schema/operationsMessengerTables.js";
import type * as schema_operationsReportingTables from "../schema/operationsReportingTables.js";
import type * as schema_operationsTables from "../schema/operationsTables.js";
import type * as schema_operationsWorkflowTables from "../schema/operationsWorkflowTables.js";
import type * as schema_outboundSupportTables from "../schema/outboundSupportTables.js";
import type * as schema_supportAttachmentTables from "../schema/supportAttachmentTables.js";
import type * as segments from "../segments.js";
import type * as series from "../series.js";
import type * as series_authoring from "../series/authoring.js";
import type * as series_contracts from "../series/contracts.js";
import type * as series_readiness from "../series/readiness.js";
import type * as series_runtime from "../series/runtime.js";
import type * as series_runtimeEnrollment from "../series/runtimeEnrollment.js";
import type * as series_runtimeExecution from "../series/runtimeExecution.js";
import type * as series_runtimeProcessing from "../series/runtimeProcessing.js";
import type * as series_runtimeProgressState from "../series/runtimeProgressState.js";
import type * as series_scheduler from "../series/scheduler.js";
import type * as series_shared from "../series/shared.js";
import type * as series_telemetry from "../series/telemetry.js";
import type * as setup from "../setup.js";
import type * as snippets from "../snippets.js";
import type * as suggestions from "../suggestions.js";
import type * as supportAttachmentTypes from "../supportAttachmentTypes.js";
import type * as supportAttachments from "../supportAttachments.js";
import type * as surveys from "../surveys.js";
import type * as surveys_authoring from "../surveys/authoring.js";
import type * as surveys_delivery from "../surveys/delivery.js";
import type * as surveys_helpers from "../surveys/helpers.js";
import type * as surveys_responses from "../surveys/responses.js";
import type * as tags from "../tags.js";
import type * as testAdmin from "../testAdmin.js";
import type * as testData from "../testData.js";
import type * as testData_cleanup from "../testData/cleanup.js";
import type * as testData_demoWorkspace from "../testData/demoWorkspace.js";
import type * as testData_landing from "../testData/landing.js";
import type * as testData_seeds from "../testData/seeds.js";
import type * as testing_helpers from "../testing/helpers.js";
import type * as testing_helpers_ai from "../testing/helpers/ai.js";
import type * as testing_helpers_cleanup from "../testing/helpers/cleanup.js";
import type * as testing_helpers_content from "../testing/helpers/content.js";
import type * as testing_helpers_conversations from "../testing/helpers/conversations.js";
import type * as testing_helpers_email from "../testing/helpers/email.js";
import type * as testing_helpers_notifications from "../testing/helpers/notifications.js";
import type * as testing_helpers_series from "../testing/helpers/series.js";
import type * as testing_helpers_supportAttachments from "../testing/helpers/supportAttachments.js";
import type * as testing_helpers_tickets from "../testing/helpers/tickets.js";
import type * as testing_helpers_workspace from "../testing/helpers/workspace.js";
import type * as ticketForms from "../ticketForms.js";
import type * as tickets from "../tickets.js";
import type * as tooltipAuthoringSessions from "../tooltipAuthoringSessions.js";
import type * as tooltips from "../tooltips.js";
import type * as tourProgress from "../tourProgress.js";
import type * as tourProgressAccess from "../tourProgressAccess.js";
import type * as tourProgressMutations from "../tourProgressMutations.js";
import type * as tourProgressQueries from "../tourProgressQueries.js";
import type * as tourProgressShared from "../tourProgressShared.js";
import type * as tourSteps from "../tourSteps.js";
import type * as tours from "../tours.js";
import type * as utils_errors from "../utils/errors.js";
import type * as utils_index from "../utils/index.js";
import type * as utils_logging from "../utils/logging.js";
import type * as utils_strings from "../utils/strings.js";
import type * as utils_validation from "../utils/validation.js";
import type * as validators from "../validators.js";
import type * as visitorPushTokens from "../visitorPushTokens.js";
import type * as visitorReadableId from "../visitorReadableId.js";
import type * as visitors from "../visitors.js";
import type * as visitors_coreQueries from "../visitors/coreQueries.js";
import type * as visitors_directoryQueries from "../visitors/directoryQueries.js";
import type * as visitors_helpers from "../visitors/helpers.js";
import type * as visitors_mutations from "../visitors/mutations.js";
import type * as widgetSessions from "../widgetSessions.js";
import type * as workspaceHostedOnboardingAccess from "../workspaceHostedOnboardingAccess.js";
import type * as workspaceHostedOnboardingMutations from "../workspaceHostedOnboardingMutations.js";
import type * as workspaceHostedOnboardingQueries from "../workspaceHostedOnboardingQueries.js";
import type * as workspaceHostedOnboardingShared from "../workspaceHostedOnboardingShared.js";
import type * as workspaceMembers from "../workspaceMembers.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiAgent: typeof aiAgent;
  aiAgentActions: typeof aiAgentActions;
  articles: typeof articles;
  assignmentRules: typeof assignmentRules;
  audienceRules: typeof audienceRules;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  authConvex: typeof authConvex;
  authoringSessions: typeof authoringSessions;
  autoTagRules: typeof autoTagRules;
  automationSettings: typeof automationSettings;
  carousels: typeof carousels;
  "carousels/authoring": typeof carousels_authoring;
  "carousels/delivery": typeof carousels_delivery;
  "carousels/helpers": typeof carousels_helpers;
  "carousels/triggering": typeof carousels_triggering;
  checklists: typeof checklists;
  collections: typeof collections;
  commonIssueButtons: typeof commonIssueButtons;
  contentFolders: typeof contentFolders;
  conversations: typeof conversations;
  discovery: typeof discovery;
  email: typeof email;
  emailCampaigns: typeof emailCampaigns;
  emailChannel: typeof emailChannel;
  emailTemplates: typeof emailTemplates;
  embeddings: typeof embeddings;
  "embeddings/functionRefs": typeof embeddings_functionRefs;
  events: typeof events;
  helpCenterImports: typeof helpCenterImports;
  "helpCenterImports/exportPipeline": typeof helpCenterImports_exportPipeline;
  "helpCenterImports/markdownParse": typeof helpCenterImports_markdownParse;
  "helpCenterImports/pathUtils": typeof helpCenterImports_pathUtils;
  "helpCenterImports/referenceRewrite": typeof helpCenterImports_referenceRewrite;
  "helpCenterImports/restorePipeline": typeof helpCenterImports_restorePipeline;
  "helpCenterImports/sourceQueries": typeof helpCenterImports_sourceQueries;
  "helpCenterImports/syncPipeline": typeof helpCenterImports_syncPipeline;
  http: typeof http;
  identityVerification: typeof identityVerification;
  internalArticles: typeof internalArticles;
  knowledge: typeof knowledge;
  "lib/aiGateway": typeof lib_aiGateway;
  "lib/authWrappers": typeof lib_authWrappers;
  "lib/notificationPreferences": typeof lib_notificationPreferences;
  "lib/seriesRuntimeAdapter": typeof lib_seriesRuntimeAdapter;
  "lib/unifiedArticles": typeof lib_unifiedArticles;
  messages: typeof messages;
  messengerHomeConfig: typeof messengerHomeConfig;
  messengerSettings: typeof messengerSettings;
  messengerSettingsAccess: typeof messengerSettingsAccess;
  messengerSettingsCore: typeof messengerSettingsCore;
  messengerSettingsShared: typeof messengerSettingsShared;
  "migrations/backfillHelpCenterAccessPolicy": typeof migrations_backfillHelpCenterAccessPolicy;
  "migrations/migrateAuthSessions": typeof migrations_migrateAuthSessions;
  "migrations/migrateRolesToPermissions": typeof migrations_migrateRolesToPermissions;
  "migrations/removePasswordHash": typeof migrations_removePasswordHash;
  "migrations/removeUseSignedSessions": typeof migrations_removeUseSignedSessions;
  notificationSettings: typeof notificationSettings;
  notifications: typeof notifications;
  "notifications/contracts": typeof notifications_contracts;
  "notifications/dispatch": typeof notifications_dispatch;
  "notifications/emitters/chat": typeof notifications_emitters_chat;
  "notifications/emitters/ticket": typeof notifications_emitters_ticket;
  "notifications/functionRefs": typeof notifications_functionRefs;
  "notifications/helpers": typeof notifications_helpers;
  "notifications/recipients": typeof notifications_recipients;
  "notifications/routing": typeof notifications_routing;
  officeHours: typeof officeHours;
  originValidation: typeof originValidation;
  outboundContracts: typeof outboundContracts;
  outboundMessages: typeof outboundMessages;
  permissions: typeof permissions;
  push: typeof push;
  "push/functionRefs": typeof push_functionRefs;
  pushCampaigns: typeof pushCampaigns;
  pushTokens: typeof pushTokens;
  reporting: typeof reporting;
  "reporting/agentMetrics": typeof reporting_agentMetrics;
  "reporting/aiMetrics": typeof reporting_aiMetrics;
  "reporting/conversationMetrics": typeof reporting_conversationMetrics;
  "reporting/csatMetrics": typeof reporting_csatMetrics;
  "reporting/dashboard": typeof reporting_dashboard;
  "reporting/helpers": typeof reporting_helpers;
  "reporting/snapshots": typeof reporting_snapshots;
  "schema/authWorkspaceTables": typeof schema_authWorkspaceTables;
  "schema/campaignCarouselTables": typeof schema_campaignCarouselTables;
  "schema/campaignEmailTables": typeof schema_campaignEmailTables;
  "schema/campaignPushTables": typeof schema_campaignPushTables;
  "schema/campaignSeriesTables": typeof schema_campaignSeriesTables;
  "schema/campaignSurveyTables": typeof schema_campaignSurveyTables;
  "schema/campaignTables": typeof schema_campaignTables;
  "schema/engagementTables": typeof schema_engagementTables;
  "schema/helpCenterTables": typeof schema_helpCenterTables;
  "schema/inboxConversationTables": typeof schema_inboxConversationTables;
  "schema/inboxNotificationRoutingTables": typeof schema_inboxNotificationRoutingTables;
  "schema/inboxNotificationTables": typeof schema_inboxNotificationTables;
  "schema/inboxPushTokenTables": typeof schema_inboxPushTokenTables;
  "schema/operationsAiTables": typeof schema_operationsAiTables;
  "schema/operationsMessengerTables": typeof schema_operationsMessengerTables;
  "schema/operationsReportingTables": typeof schema_operationsReportingTables;
  "schema/operationsTables": typeof schema_operationsTables;
  "schema/operationsWorkflowTables": typeof schema_operationsWorkflowTables;
  "schema/outboundSupportTables": typeof schema_outboundSupportTables;
  "schema/supportAttachmentTables": typeof schema_supportAttachmentTables;
  segments: typeof segments;
  series: typeof series;
  "series/authoring": typeof series_authoring;
  "series/contracts": typeof series_contracts;
  "series/readiness": typeof series_readiness;
  "series/runtime": typeof series_runtime;
  "series/runtimeEnrollment": typeof series_runtimeEnrollment;
  "series/runtimeExecution": typeof series_runtimeExecution;
  "series/runtimeProcessing": typeof series_runtimeProcessing;
  "series/runtimeProgressState": typeof series_runtimeProgressState;
  "series/scheduler": typeof series_scheduler;
  "series/shared": typeof series_shared;
  "series/telemetry": typeof series_telemetry;
  setup: typeof setup;
  snippets: typeof snippets;
  suggestions: typeof suggestions;
  supportAttachmentTypes: typeof supportAttachmentTypes;
  supportAttachments: typeof supportAttachments;
  surveys: typeof surveys;
  "surveys/authoring": typeof surveys_authoring;
  "surveys/delivery": typeof surveys_delivery;
  "surveys/helpers": typeof surveys_helpers;
  "surveys/responses": typeof surveys_responses;
  tags: typeof tags;
  testAdmin: typeof testAdmin;
  testData: typeof testData;
  "testData/cleanup": typeof testData_cleanup;
  "testData/demoWorkspace": typeof testData_demoWorkspace;
  "testData/landing": typeof testData_landing;
  "testData/seeds": typeof testData_seeds;
  "testing/helpers": typeof testing_helpers;
  "testing/helpers/ai": typeof testing_helpers_ai;
  "testing/helpers/cleanup": typeof testing_helpers_cleanup;
  "testing/helpers/content": typeof testing_helpers_content;
  "testing/helpers/conversations": typeof testing_helpers_conversations;
  "testing/helpers/email": typeof testing_helpers_email;
  "testing/helpers/notifications": typeof testing_helpers_notifications;
  "testing/helpers/series": typeof testing_helpers_series;
  "testing/helpers/supportAttachments": typeof testing_helpers_supportAttachments;
  "testing/helpers/tickets": typeof testing_helpers_tickets;
  "testing/helpers/workspace": typeof testing_helpers_workspace;
  ticketForms: typeof ticketForms;
  tickets: typeof tickets;
  tooltipAuthoringSessions: typeof tooltipAuthoringSessions;
  tooltips: typeof tooltips;
  tourProgress: typeof tourProgress;
  tourProgressAccess: typeof tourProgressAccess;
  tourProgressMutations: typeof tourProgressMutations;
  tourProgressQueries: typeof tourProgressQueries;
  tourProgressShared: typeof tourProgressShared;
  tourSteps: typeof tourSteps;
  tours: typeof tours;
  "utils/errors": typeof utils_errors;
  "utils/index": typeof utils_index;
  "utils/logging": typeof utils_logging;
  "utils/strings": typeof utils_strings;
  "utils/validation": typeof utils_validation;
  validators: typeof validators;
  visitorPushTokens: typeof visitorPushTokens;
  visitorReadableId: typeof visitorReadableId;
  visitors: typeof visitors;
  "visitors/coreQueries": typeof visitors_coreQueries;
  "visitors/directoryQueries": typeof visitors_directoryQueries;
  "visitors/helpers": typeof visitors_helpers;
  "visitors/mutations": typeof visitors_mutations;
  widgetSessions: typeof widgetSessions;
  workspaceHostedOnboardingAccess: typeof workspaceHostedOnboardingAccess;
  workspaceHostedOnboardingMutations: typeof workspaceHostedOnboardingMutations;
  workspaceHostedOnboardingQueries: typeof workspaceHostedOnboardingQueries;
  workspaceHostedOnboardingShared: typeof workspaceHostedOnboardingShared;
  workspaceMembers: typeof workspaceMembers;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
