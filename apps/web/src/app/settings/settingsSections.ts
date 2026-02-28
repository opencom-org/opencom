export type SettingsCategoryId =
  | "workspace-access"
  | "security"
  | "messenger-experience"
  | "automation-ai"
  | "notifications"
  | "integrations-channels"
  | "system";

export type SettingsSectionId =
  | "workspace"
  | "team-members"
  | "signup-auth"
  | "allowed-origins"
  | "help-center-access"
  | "security"
  | "messenger-customization"
  | "messenger-home"
  | "automation"
  | "ai-agent"
  | "notifications"
  | "email-channel"
  | "mobile-devices"
  | "installations"
  | "backend-connection";

export interface SettingsSectionConfig {
  id: SettingsSectionId;
  label: string;
  description: string;
  category: SettingsCategoryId;
  keywords: string[];
  defaultExpanded: boolean;
  priority: number;
  mobileOrder: number;
}

export const SETTINGS_CATEGORY_LABELS: Record<SettingsCategoryId, string> = {
  "workspace-access": "Workspace & Access",
  security: "Security",
  "messenger-experience": "Messenger Experience",
  "automation-ai": "Automation & AI",
  notifications: "Notifications",
  "integrations-channels": "Integrations & Channels",
  system: "System",
};

export const SETTINGS_SECTION_CONFIG: SettingsSectionConfig[] = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Name, ID, and workspace identity details",
    category: "workspace-access",
    keywords: ["workspace", "id", "identity", "name"],
    defaultExpanded: true,
    priority: 1,
    mobileOrder: 1,
  },
  {
    id: "team-members",
    label: "Team Members",
    description: "Invite teammates and manage member roles",
    category: "workspace-access",
    keywords: ["team", "members", "invite", "roles", "ownership"],
    defaultExpanded: false,
    priority: 2,
    mobileOrder: 2,
  },
  {
    id: "signup-auth",
    label: "Signup & Authentication",
    description: "Control signup mode and authentication methods",
    category: "workspace-access",
    keywords: ["signup", "auth", "otp", "password", "domains"],
    defaultExpanded: false,
    priority: 3,
    mobileOrder: 3,
  },
  {
    id: "allowed-origins",
    label: "Allowed Origins",
    description: "Restrict widget embedding domains",
    category: "workspace-access",
    keywords: ["origin", "domain", "cors", "embedding", "widget"],
    defaultExpanded: false,
    priority: 4,
    mobileOrder: 4,
  },
  {
    id: "help-center-access",
    label: "Help Center Access",
    description: "Set public vs restricted Help Center access",
    category: "workspace-access",
    keywords: ["help center", "public", "restricted", "articles"],
    defaultExpanded: false,
    priority: 5,
    mobileOrder: 5,
  },
  {
    id: "security",
    label: "Security",
    description: "Identity verification, sessions, and audit retention",
    category: "security",
    keywords: ["security", "hmac", "identity", "sessions", "audit"],
    defaultExpanded: false,
    priority: 6,
    mobileOrder: 6,
  },
  {
    id: "messenger-customization",
    label: "Messenger Customization",
    description: "Branding, theme, launcher, and language preferences",
    category: "messenger-experience",
    keywords: ["messenger", "branding", "theme", "launcher", "colors"],
    defaultExpanded: false,
    priority: 7,
    mobileOrder: 7,
  },
  {
    id: "messenger-home",
    label: "Messenger Home",
    description: "Configure home cards and default landing experience",
    category: "messenger-experience",
    keywords: ["home", "cards", "welcome", "default space"],
    defaultExpanded: false,
    priority: 8,
    mobileOrder: 8,
  },
  {
    id: "automation",
    label: "Automation",
    description: "Tune self-serve and conversation automation toggles",
    category: "automation-ai",
    keywords: ["automation", "self-serve", "csat", "reply time"],
    defaultExpanded: false,
    priority: 9,
    mobileOrder: 9,
  },
  {
    id: "ai-agent",
    label: "AI Agent",
    description: "Configure AI responses, model, and handoff behavior",
    category: "automation-ai",
    keywords: ["ai", "agent", "model", "handoff", "suggestions"],
    defaultExpanded: false,
    priority: 10,
    mobileOrder: 10,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Manage personal and workspace notification defaults",
    category: "notifications",
    keywords: ["notifications", "email", "push", "sound", "browser"],
    defaultExpanded: false,
    priority: 11,
    mobileOrder: 11,
  },
  {
    id: "email-channel",
    label: "Email Channel",
    description: "Set forwarding and outbound email behavior",
    category: "integrations-channels",
    keywords: ["email", "channel", "forwarding", "signature", "from"],
    defaultExpanded: false,
    priority: 12,
    mobileOrder: 12,
  },
  {
    id: "mobile-devices",
    label: "Connected Mobile Devices",
    description: "View SDK-connected devices and push token stats",
    category: "integrations-channels",
    keywords: ["mobile", "sdk", "devices", "push"],
    defaultExpanded: false,
    priority: 13,
    mobileOrder: 13,
  },
  {
    id: "installations",
    label: "Installations",
    description: "Find setup guides in the onboarding workspace",
    category: "integrations-channels",
    keywords: ["install", "widget", "sdk", "onboarding", "setup"],
    defaultExpanded: false,
    priority: 14,
    mobileOrder: 14,
  },
  {
    id: "backend-connection",
    label: "Backend Connection",
    description: "View current backend and switch environments",
    category: "system",
    keywords: ["backend", "environment", "connection"],
    defaultExpanded: false,
    priority: 15,
    mobileOrder: 15,
  },
];
