"use strict";

const LOCAL_SITE_URL = "http://localhost:3000";

const CORE_BACKEND_ENV = [
  {
    key: "AUTH_SECRET",
    required: true,
    description:
      "Required by Convex Auth to sign password-auth sessions for the local bootstrap flow.",
    resolution: "generate",
  },
  {
    key: "SITE_URL",
    required: false,
    description:
      "Recommended local default for Convex Auth callback/link generation. Needed for OTP/email flows.",
    resolution: "default",
    defaultValue: LOCAL_SITE_URL,
  },
];

const OPTIONAL_BACKEND_PROFILES = [
  {
    id: "otp-email",
    label: "OTP email sign-in",
    description: "Passwordless email code sign-in for web/mobile auth flows.",
    checks: [
      {
        mode: "any",
        keys: ["AUTH_RESEND_KEY", "RESEND_API_KEY"],
        message: "set AUTH_RESEND_KEY or RESEND_API_KEY",
      },
      {
        mode: "all",
        keys: ["EMAIL_FROM"],
        message: "set EMAIL_FROM",
      },
      {
        mode: "all",
        keys: ["SITE_URL"],
        message: "set SITE_URL",
      },
    ],
  },
  {
    id: "email-channel",
    label: "Email channel + webhook handling",
    description: "Inbound/outbound email conversations and webhook verification.",
    checks: [
      {
        mode: "all",
        keys: ["RESEND_API_KEY"],
        message: "set RESEND_API_KEY",
      },
      {
        mode: "all",
        keys: ["EMAIL_FROM"],
        message: "set EMAIL_FROM",
      },
      {
        mode: "all",
        keys: ["RESEND_WEBHOOK_SECRET"],
        message: "set RESEND_WEBHOOK_SECRET",
      },
      {
        mode: "any",
        keys: ["EMAIL_WEBHOOK_INTERNAL_SECRET", "RESEND_WEBHOOK_SECRET"],
        message: "set EMAIL_WEBHOOK_INTERNAL_SECRET (or reuse RESEND_WEBHOOK_SECRET)",
      },
    ],
  },
  {
    id: "ai-agent",
    label: "AI agent generation",
    description: "Model discovery and generated AI responses.",
    checks: [
      {
        mode: "all",
        keys: ["AI_GATEWAY_API_KEY"],
        message: "set AI_GATEWAY_API_KEY",
      },
    ],
  },
  {
    id: "test-demo",
    label: "Test/demo helpers",
    description: "Landing seed scripts and testAdmin-backed helper flows.",
    checks: [
      {
        mode: "all",
        keys: ["ALLOW_TEST_DATA"],
        message: "set ALLOW_TEST_DATA=true",
        validate: (value) => value === "true",
      },
      {
        mode: "all",
        keys: ["TEST_ADMIN_SECRET"],
        message: "set TEST_ADMIN_SECRET",
      },
    ],
  },
];

const LOCAL_ENV_TARGETS = [
  {
    relativePath: "apps/web/.env.local",
    description: "Web dashboard local backend + widget demo defaults",
    managedComment: "Managed by Opencom local setup (web dashboard defaults)",
    values: ({ convexUrl, workspaceId }) => ({
      E2E_BACKEND_URL: convexUrl,
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
      NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL: convexUrl,
      NEXT_PUBLIC_TEST_WORKSPACE_ID: workspaceId,
    }),
  },
  {
    relativePath: "apps/widget/.env.local",
    description: "Widget local dev bootstrap",
    managedComment: "Managed by Opencom local setup (widget dev bootstrap)",
    values: ({ convexUrl, workspaceId }) => ({
      VITE_CONVEX_URL: convexUrl,
      VITE_WORKSPACE_ID: workspaceId,
    }),
  },
  {
    relativePath: "apps/mobile/.env.local",
    description: "Mobile admin app backend defaults",
    managedComment: "Managed by Opencom local setup (mobile defaults)",
    values: ({ convexUrl, workspaceId }) => ({
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL: convexUrl,
      EXPO_PUBLIC_WORKSPACE_ID: workspaceId,
    }),
  },
  {
    relativePath: "apps/landing/.env.local",
    description: "Landing page widget demo defaults",
    managedComment: "Managed by Opencom local setup (landing widget demo)",
    values: ({ convexUrl, workspaceId }) => ({
      NEXT_PUBLIC_CONVEX_URL: convexUrl,
      NEXT_PUBLIC_WORKSPACE_ID: workspaceId,
    }),
  },
  {
    relativePath: "packages/react-native-sdk/example/.env.local",
    description: "React Native SDK example defaults",
    managedComment: "Managed by Opencom local setup (React Native SDK example)",
    values: ({ convexUrl, workspaceId }) => ({
      EXPO_PUBLIC_CONVEX_URL: convexUrl,
      EXPO_PUBLIC_WORKSPACE_ID: workspaceId,
    }),
  },
  {
    relativePath: "packages/convex/.env.local",
    description: "Local Convex shell/test helpers",
    managedComment: "Managed by Opencom local setup (Convex shell/test helpers)",
    values: ({ convexUrl, workspaceId }) => ({
      CONVEX_URL: convexUrl,
      E2E_BACKEND_URL: convexUrl,
      WORKSPACE_ID: workspaceId,
    }),
  },
];

module.exports = {
  CORE_BACKEND_ENV,
  LOCAL_ENV_TARGETS,
  LOCAL_SITE_URL,
  OPTIONAL_BACKEND_PROFILES,
};
