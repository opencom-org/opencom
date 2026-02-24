export * from "./backend";
export * from "./backendValidation";

export type UserId = string;
export type ConversationId = string;
export type MessageId = string;
export type WorkspaceId = string;

// Email Channel Types (defined early for use in Message/Conversation)
export type ChannelType = "chat" | "email";
export type EmailProvider = "resend" | "sendgrid" | "postmark";
export type EmailDeliveryStatus = "pending" | "sent" | "delivered" | "bounced" | "failed";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  storageId?: string;
  url?: string;
}

export interface EmailMetadata {
  subject?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
}

export interface User {
  id: UserId;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface Visitor {
  id: string;
  sessionId: string;
  userId?: UserId;
  customAttributes?: Record<string, unknown>;
  createdAt: number;
}

export interface Agent {
  id: UserId;
  email: string;
  name: string;
  avatarUrl?: string;
  role: "admin" | "agent";
}

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  senderId: string;
  senderType: "user" | "visitor" | "agent" | "bot";
  content: string;
  channel?: ChannelType;
  emailMetadata?: EmailMetadata;
  deliveryStatus?: EmailDeliveryStatus;
  createdAt: number;
}

export interface Conversation {
  id: ConversationId;
  workspaceId: WorkspaceId;
  visitorId?: string;
  userId?: UserId;
  assignedAgentId?: UserId;
  status: "open" | "closed" | "snoozed";
  channel?: ChannelType;
  subject?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  createdAt: number;
}

// Knowledge Hub Types
export type ContentFolderId = string;
export type InternalArticleId = string;

export type ContentStatus = "draft" | "published" | "archived";

export interface ContentFolder {
  id: ContentFolderId;
  workspaceId: WorkspaceId;
  name: string;
  parentId?: ContentFolderId;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface InternalArticle {
  id: InternalArticleId;
  workspaceId: WorkspaceId;
  folderId?: ContentFolderId;
  title: string;
  content: string;
  tags?: string[];
  status: ContentStatus;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  authorId?: UserId;
}

export type KnowledgeContentType = "article" | "internalArticle" | "snippet";

export interface KnowledgeSearchResult {
  id: string;
  type: KnowledgeContentType;
  title: string;
  content: string;
  snippet?: string;
  folderId?: ContentFolderId;
  tags?: string[];
  relevanceScore?: number;
}

export interface RecentContentAccess {
  userId: UserId;
  workspaceId: WorkspaceId;
  contentType: KnowledgeContentType;
  contentId: string;
  accessedAt: number;
}

// Outbound In-App Messaging Types
export type OutboundMessageId = string;
export type ChecklistId = string;

export type OutboundMessageType = "chat" | "post" | "banner";
export type OutboundMessageStatus = "draft" | "active" | "paused" | "archived";
export type MessageFrequency = "once" | "once_per_session" | "always";
export type TriggerType = "immediate" | "page_visit" | "time_on_page" | "scroll_depth" | "event";
export type PageUrlMatch = "exact" | "contains" | "regex";
export type ButtonAction = "url" | "dismiss" | "tour";
export type BannerStyle = "inline" | "floating";

export interface MessageButton {
  text: string;
  action: ButtonAction;
  url?: string;
  tourId?: string;
}

export interface OutboundMessageContent {
  // Chat message fields
  text?: string;
  senderId?: UserId;
  // Post message fields
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  // Banner fields
  style?: BannerStyle;
  dismissible?: boolean;
  // Shared fields
  buttons?: MessageButton[];
}

export interface MessageTrigger {
  type: TriggerType;
  pageUrl?: string;
  pageUrlMatch?: PageUrlMatch;
  delaySeconds?: number;
  scrollPercent?: number;
  eventName?: string;
}

export interface MessageScheduling {
  startDate?: number;
  endDate?: number;
}

export interface OutboundMessage {
  id: OutboundMessageId;
  workspaceId: WorkspaceId;
  type: OutboundMessageType;
  name: string;
  content: OutboundMessageContent;
  targeting?: unknown;
  triggers?: MessageTrigger;
  frequency?: MessageFrequency;
  scheduling?: MessageScheduling;
  status: OutboundMessageStatus;
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

export type ImpressionAction = "shown" | "clicked" | "dismissed";

export interface OutboundMessageImpression {
  id: string;
  messageId: OutboundMessageId;
  visitorId: string;
  sessionId?: string;
  action: ImpressionAction;
  buttonIndex?: number;
  createdAt: number;
}

// Checklist Types
export type ChecklistStatus = "draft" | "active" | "archived";
export type TaskCompletionType = "manual" | "auto_event" | "auto_attribute";
export type TaskActionType = "tour" | "url" | "event";

export interface TaskAction {
  type: TaskActionType;
  tourId?: string;
  url?: string;
  eventName?: string;
}

export interface TaskCompletionAttribute {
  key: string;
  operator: string;
  value?: unknown;
}

export interface ChecklistTask {
  id: string;
  title: string;
  description?: string;
  action?: TaskAction;
  completionType: TaskCompletionType;
  completionEvent?: string;
  completionAttribute?: TaskCompletionAttribute;
}

export interface Checklist {
  id: ChecklistId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  tasks: ChecklistTask[];
  targeting?: unknown;
  status: ChecklistStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistProgress {
  visitorId: string;
  checklistId: ChecklistId;
  completedTaskIds: string[];
  startedAt: number;
  completedAt?: number;
}

// Email Config and Thread Types (EmailAttachment, EmailMetadata, ChannelType, etc. defined above)
export interface EmailConfig {
  id: string;
  workspaceId: WorkspaceId;
  forwardingAddress: string;
  fromName?: string;
  fromEmail?: string;
  fromEmailVerified?: boolean;
  signature?: string;
  provider?: EmailProvider;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EmailThread {
  id: string;
  workspaceId: WorkspaceId;
  conversationId: ConversationId;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  subject: string;
  normalizedSubject: string;
  senderEmail: string;
  createdAt: number;
}

export interface InboundEmail {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: EmailAttachment[];
  rawHeaders?: Record<string, string>;
}

// Ticket Types
export type TicketId = string;
export type TicketFormId = string;

export type TicketStatus = "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketCommentAuthorType = "agent" | "visitor" | "system";
export type TicketFormFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multi-select"
  | "number"
  | "date";

export interface TicketFormField {
  id: string;
  type: TicketFormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface TicketForm {
  id: TicketFormId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  fields: TicketFormField[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Ticket {
  id: TicketId;
  workspaceId: WorkspaceId;
  conversationId?: ConversationId;
  visitorId?: string;
  subject: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId?: UserId;
  teamId?: string;
  formId?: TicketFormId;
  formData?: Record<string, unknown>;
  resolutionSummary?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
}

export interface TicketComment {
  id: string;
  ticketId: TicketId;
  authorId: string;
  authorType: TicketCommentAuthorType;
  content: string;
  isInternal: boolean;
  createdAt: number;
}

// Email Campaign Types
export type EmailCampaignId = string;
export type EmailTemplateId = string;
export type EmailCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export interface EmailCampaignSchedule {
  type: "immediate" | "scheduled";
  scheduledAt?: number;
  timezone?: string;
}

export interface EmailCampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export interface EmailCampaign {
  id: EmailCampaignId;
  workspaceId: WorkspaceId;
  name: string;
  subject: string;
  previewText?: string;
  content: string;
  templateId?: EmailTemplateId;
  senderId?: UserId;
  targeting?: unknown;
  schedule?: EmailCampaignSchedule;
  status: EmailCampaignStatus;
  stats?: EmailCampaignStats;
  sentAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface EmailTemplate {
  id: EmailTemplateId;
  workspaceId: WorkspaceId;
  name: string;
  subject?: string;
  html: string;
  variables?: string[];
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export type EmailRecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed";

export interface EmailCampaignRecipient {
  id: string;
  campaignId: EmailCampaignId;
  visitorId: string;
  email: string;
  status: EmailRecipientStatus;
  sentAt?: number;
  openedAt?: number;
  clickedAt?: number;
  createdAt: number;
}

// Push Campaign Types
export type PushCampaignId = string;
export type PushCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

export interface PushCampaignSchedule {
  type: "immediate" | "scheduled";
  scheduledAt?: number;
  timezone?: string;
}

export interface PushCampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
}

export interface PushCampaign {
  id: PushCampaignId;
  workspaceId: WorkspaceId;
  name: string;
  title: string;
  body: string;
  imageUrl?: string;
  data?: unknown;
  deepLink?: string;
  targeting?: unknown;
  schedule?: PushCampaignSchedule;
  status: PushCampaignStatus;
  stats?: PushCampaignStats;
  sentAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type PushRecipientStatus = "pending" | "sent" | "delivered" | "opened" | "failed";

export interface PushCampaignRecipient {
  id: string;
  campaignId: PushCampaignId;
  userId: UserId;
  tokenId: string;
  status: PushRecipientStatus;
  sentAt?: number;
  deliveredAt?: number;
  openedAt?: number;
  error?: string;
  createdAt: number;
}

// Carousel Types
export type CarouselId = string;
export type CarouselStatus = "draft" | "active" | "paused" | "archived";
export type CarouselButtonAction = "url" | "dismiss" | "next" | "deeplink";

export interface CarouselButton {
  text: string;
  action: CarouselButtonAction;
  url?: string;
  deepLink?: string;
}

export interface CarouselScreen {
  id: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttons?: CarouselButton[];
}

export interface Carousel {
  id: CarouselId;
  workspaceId: WorkspaceId;
  name: string;
  screens: CarouselScreen[];
  targeting?: unknown;
  status: CarouselStatus;
  priority?: number;
  createdAt: number;
  updatedAt: number;
}

export type CarouselImpressionAction = "shown" | "completed" | "dismissed";

export interface CarouselImpression {
  id: string;
  carouselId: CarouselId;
  visitorId: string;
  action: CarouselImpressionAction;
  screenIndex?: number;
  createdAt: number;
}

// Series Types
export type SeriesId = string;
export type SeriesBlockId = string;
export type SeriesStatus = "draft" | "active" | "paused" | "archived";
export type SeriesBlockType =
  | "rule"
  | "wait"
  | "email"
  | "push"
  | "chat"
  | "post"
  | "carousel"
  | "tag";
export type WaitType = "duration" | "until_date" | "until_event";
export type WaitUnit = "minutes" | "hours" | "days";
export type TagAction = "add" | "remove";
export type SeriesConnectionCondition = "yes" | "no" | "default";
export type SeriesProgressStatus = "active" | "waiting" | "completed" | "exited" | "goal_reached";

export interface SeriesStats {
  entered: number;
  completed: number;
  exited: number;
  goalReached: number;
}

export interface Series {
  id: SeriesId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  entryRules?: unknown;
  exitRules?: unknown;
  goalRules?: unknown;
  status: SeriesStatus;
  stats?: SeriesStats;
  createdAt: number;
  updatedAt: number;
}

export interface SeriesBlockPosition {
  x: number;
  y: number;
}

export interface SeriesBlockConfig {
  rules?: unknown;
  waitType?: WaitType;
  waitDuration?: number;
  waitUnit?: WaitUnit;
  waitUntilDate?: number;
  waitUntilEvent?: string;
  contentId?: string;
  subject?: string;
  body?: string;
  title?: string;
  tagAction?: TagAction;
  tagName?: string;
}

export interface SeriesBlock {
  id: SeriesBlockId;
  seriesId: SeriesId;
  type: SeriesBlockType;
  position: SeriesBlockPosition;
  config: SeriesBlockConfig;
  createdAt: number;
  updatedAt: number;
}

export interface SeriesConnection {
  id: string;
  seriesId: SeriesId;
  fromBlockId: SeriesBlockId;
  toBlockId: SeriesBlockId;
  condition?: SeriesConnectionCondition;
  createdAt: number;
}

export interface SeriesProgress {
  id: string;
  visitorId: string;
  seriesId: SeriesId;
  currentBlockId?: SeriesBlockId;
  status: SeriesProgressStatus;
  waitUntil?: number;
  enteredAt: number;
  completedAt?: number;
  exitedAt?: number;
  goalReachedAt?: number;
}

export type SeriesHistoryAction = "entered" | "completed" | "skipped";

export interface SeriesProgressHistory {
  id: string;
  progressId: string;
  blockId: SeriesBlockId;
  action: SeriesHistoryAction;
  result?: unknown;
  createdAt: number;
}

// Survey Types
export type SurveyId = string;
export type SurveyResponseId = string;
export type SurveyFormat = "small" | "large";
export type SurveyStatus = "draft" | "active" | "paused" | "archived";
export type SurveyFrequency = "once" | "until_completed";

export type SurveyQuestionType =
  | "nps"
  | "numeric_scale"
  | "star_rating"
  | "emoji_rating"
  | "dropdown"
  | "short_text"
  | "long_text"
  | "multiple_choice";

export interface SurveyQuestionOptions {
  // Numeric Scale
  scaleStart?: number;
  scaleEnd?: number;
  startLabel?: string;
  endLabel?: string;
  // Star Rating
  starLabels?: {
    low?: string;
    high?: string;
  };
  // Emoji Rating
  emojiCount?: 3 | 5;
  emojiLabels?: {
    low?: string;
    high?: string;
  };
  // Dropdown / Multiple Choice
  choices?: string[];
  allowMultiple?: boolean;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  required: boolean;
  storeAsAttribute?: string;
  options?: SurveyQuestionOptions;
}

export interface SurveyIntroStep {
  title: string;
  description?: string;
  buttonText?: string;
}

export interface SurveyThankYouStep {
  title: string;
  description?: string;
  buttonText?: string;
}

export interface SurveyTrigger {
  type: "immediate" | "page_visit" | "time_on_page" | "event";
  pageUrl?: string;
  pageUrlMatch?: PageUrlMatch;
  delaySeconds?: number;
  eventName?: string;
}

export interface SurveyScheduling {
  startDate?: number;
  endDate?: number;
}

export interface Survey {
  id: SurveyId;
  workspaceId: WorkspaceId;
  name: string;
  description?: string;
  format: SurveyFormat;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  introStep?: SurveyIntroStep;
  thankYouStep?: SurveyThankYouStep;
  showProgressBar?: boolean;
  showDismissButton?: boolean;
  audienceRules?: unknown;
  triggers?: SurveyTrigger;
  frequency?: SurveyFrequency;
  scheduling?: SurveyScheduling;
  createdAt: number;
  updatedAt: number;
}

export interface SurveyAnswer {
  questionId: string;
  value: unknown;
}

export type SurveyResponseStatus = "partial" | "completed";

export interface SurveyResponse {
  id: SurveyResponseId;
  surveyId: SurveyId;
  workspaceId: WorkspaceId;
  visitorId?: string;
  userId?: UserId;
  sessionId?: string;
  answers: SurveyAnswer[];
  status: SurveyResponseStatus;
  startedAt: number;
  completedAt?: number;
}

export type SurveyImpressionAction = "shown" | "started" | "completed" | "dismissed";

export interface SurveyImpression {
  id: string;
  surveyId: SurveyId;
  visitorId: string;
  sessionId?: string;
  action: SurveyImpressionAction;
  createdAt: number;
}
