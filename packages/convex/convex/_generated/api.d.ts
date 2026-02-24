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
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as identityVerification from "../identityVerification.js";
import type * as internalArticles from "../internalArticles.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_authWrappers from "../lib/authWrappers.js";
import type * as lib_notificationPreferences from "../lib/notificationPreferences.js";
import type * as messages from "../messages.js";
import type * as messengerSettings from "../messengerSettings.js";
import type * as migrations_backfillHelpCenterAccessPolicy from "../migrations/backfillHelpCenterAccessPolicy.js";
import type * as migrations_migrateAuthSessions from "../migrations/migrateAuthSessions.js";
import type * as migrations_migrateRolesToPermissions from "../migrations/migrateRolesToPermissions.js";
import type * as migrations_removePasswordHash from "../migrations/removePasswordHash.js";
import type * as migrations_removeUseSignedSessions from "../migrations/removeUseSignedSessions.js";
import type * as notificationSettings from "../notificationSettings.js";
import type * as notifications from "../notifications.js";
import type * as officeHours from "../officeHours.js";
import type * as originValidation from "../originValidation.js";
import type * as outboundMessages from "../outboundMessages.js";
import type * as permissions from "../permissions.js";
import type * as push from "../push.js";
import type * as pushCampaigns from "../pushCampaigns.js";
import type * as pushTokens from "../pushTokens.js";
import type * as reporting from "../reporting.js";
import type * as segments from "../segments.js";
import type * as series from "../series.js";
import type * as setup from "../setup.js";
import type * as snippets from "../snippets.js";
import type * as suggestions from "../suggestions.js";
import type * as surveys from "../surveys.js";
import type * as tags from "../tags.js";
import type * as testAdmin from "../testAdmin.js";
import type * as testData from "../testData.js";
import type * as testing_helpers from "../testing/helpers.js";
import type * as ticketForms from "../ticketForms.js";
import type * as tickets from "../tickets.js";
import type * as tooltipAuthoringSessions from "../tooltipAuthoringSessions.js";
import type * as tooltips from "../tooltips.js";
import type * as tourProgress from "../tourProgress.js";
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
import type * as widgetSessions from "../widgetSessions.js";
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
  events: typeof events;
  http: typeof http;
  identityVerification: typeof identityVerification;
  internalArticles: typeof internalArticles;
  knowledge: typeof knowledge;
  "lib/authWrappers": typeof lib_authWrappers;
  "lib/notificationPreferences": typeof lib_notificationPreferences;
  messages: typeof messages;
  messengerSettings: typeof messengerSettings;
  "migrations/backfillHelpCenterAccessPolicy": typeof migrations_backfillHelpCenterAccessPolicy;
  "migrations/migrateAuthSessions": typeof migrations_migrateAuthSessions;
  "migrations/migrateRolesToPermissions": typeof migrations_migrateRolesToPermissions;
  "migrations/removePasswordHash": typeof migrations_removePasswordHash;
  "migrations/removeUseSignedSessions": typeof migrations_removeUseSignedSessions;
  notificationSettings: typeof notificationSettings;
  notifications: typeof notifications;
  officeHours: typeof officeHours;
  originValidation: typeof originValidation;
  outboundMessages: typeof outboundMessages;
  permissions: typeof permissions;
  push: typeof push;
  pushCampaigns: typeof pushCampaigns;
  pushTokens: typeof pushTokens;
  reporting: typeof reporting;
  segments: typeof segments;
  series: typeof series;
  setup: typeof setup;
  snippets: typeof snippets;
  suggestions: typeof suggestions;
  surveys: typeof surveys;
  tags: typeof tags;
  testAdmin: typeof testAdmin;
  testData: typeof testData;
  "testing/helpers": typeof testing_helpers;
  ticketForms: typeof ticketForms;
  tickets: typeof tickets;
  tooltipAuthoringSessions: typeof tooltipAuthoringSessions;
  tooltips: typeof tooltips;
  tourProgress: typeof tourProgress;
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
  widgetSessions: typeof widgetSessions;
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
