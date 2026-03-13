import { httpRouter, makeFunctionReference, type FunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { auth } from "./authConvex";

const CONVEX_URL = process.env.CONVEX_CLOUD_URL ?? process.env.VITE_CONVEX_URL ?? "";
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";
const EMAIL_WEBHOOK_INTERNAL_SECRET =
  process.env.EMAIL_WEBHOOK_INTERNAL_SECRET ?? RESEND_WEBHOOK_SECRET;
// Enforce signatures by default; set ENFORCE_WEBHOOK_SIGNATURES=false to opt out in local dev.
const ENFORCE_WEBHOOK_SIGNATURES = process.env.ENFORCE_WEBHOOK_SIGNATURES !== "false";
const WEBHOOK_MAX_AGE_SECONDS = Number.parseInt(process.env.WEBHOOK_MAX_AGE_SECONDS ?? "300", 10);
const PUBLIC_DISCOVERY_ALLOWED_ORIGINS = (process.env.OPENCOM_PUBLIC_CORS_ORIGINS ?? "")
  .split(",")
  .map((origin: string) => origin.trim())
  .filter((origin: string) => origin.length > 0);

function isLocalDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      (parsed.protocol === "http:" || parsed.protocol === "https:")
    );
  } catch {
    return false;
  }
}

function isPublicDiscoveryOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    return false;
  }

  if (PUBLIC_DISCOVERY_ALLOWED_ORIGINS.length > 0) {
    return PUBLIC_DISCOVERY_ALLOWED_ORIGINS.includes(origin);
  }

  return isLocalDevOrigin(origin);
}

// Verify Resend webhook signature using HMAC-SHA256
// See: https://resend.com/docs/webhooks/introduction#security
async function verifyResendWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  try {
    // Resend uses svix for webhook delivery
    // The signature header format is: v1,<timestamp>,<signature>
    const parts = signature.split(",");
    if (parts.length < 2) {
      return false;
    }

    // For Resend webhooks, verify using the svix-signature header
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = timestampPart.replace("t=", "");
    const providedSig = signaturePart.replace("v1=", "");

    const timestampSeconds = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(timestampSeconds)) {
      return false;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > WEBHOOK_MAX_AGE_SECONDS) {
      return false;
    }

    // Verify the signature
    const signedPayload = `${timestamp}.${body}`;
    const expectedSignature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (providedSig.length !== expectedHex.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < providedSig.length; i++) {
      result |= providedSig.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return false;
  }
}

async function ensureWebhookSignature(
  rawBody: string,
  signature: string | null,
  routePath: string
): Promise<Response | null> {
  if (ENFORCE_WEBHOOK_SIGNATURES && !RESEND_WEBHOOK_SECRET) {
    console.error(
      "Webhook signature enforcement enabled but RESEND_WEBHOOK_SECRET is not configured"
    );
    return new Response(JSON.stringify({ error: "Webhook configuration error" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!RESEND_WEBHOOK_SECRET) {
    return null;
  }

  if (!signature) {
    console.error(`Missing webhook signature for ${routePath}`);
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isValid = await verifyResendWebhookSignature(rawBody, signature, RESEND_WEBHOOK_SECRET);
  if (!isValid) {
    console.error(`Invalid webhook signature for ${routePath}`);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

const http = httpRouter();

// Convex Auth HTTP routes
auth.addHttpRoutes(http);

function getCorsHeaders(
  origin: string | null,
  options?: {
    allowMethods?: string;
    allowHeaders?: string;
  }
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": options?.allowMethods ?? "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": options?.allowHeaders ?? "Content-Type, X-Workspace-Id",
    Vary: "Origin",
  };

  // Only set Access-Control-Allow-Origin if an origin is provided
  // Never fall back to wildcard "*"
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

type ValidateOriginResult = { valid: boolean; reason: string };
type DiscoveryMetadata = {
  version: string;
  name: string;
  features: unknown;
  signupMode?: "invite-only" | "domain-allowlist";
  authMethods?: ("password" | "otp")[];
};

type PublicQueryRef<Args extends Record<string, unknown>, Return> = FunctionReference<
  "query",
  "public",
  Args,
  Return
>;

type MutationRef<
  Visibility extends "public" | "internal",
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<"mutation", Visibility, Args, Return>;

type ValidateOriginArgs = {
  workspaceId: Id<"workspaces">;
  origin: string;
};

type GetEmailConfigByForwardingAddressArgs = {
  forwardingAddress: string;
  webhookSecret?: string;
};

type InboundAttachment = {
  filename: string;
  contentType: string;
  size: number;
};

type ProcessForwardedEmailArgs = {
  workspaceId: Id<"workspaces">;
  webhookSecret?: string;
  forwarderEmail: string;
  originalFrom: string;
  to: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  messageId: string;
  attachments?: InboundAttachment[];
};

type ProcessInboundEmailArgs = {
  workspaceId: Id<"workspaces">;
  webhookSecret?: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: InboundAttachment[];
};

type UpdateDeliveryStatusByExternalIdArgs = {
  externalEmailId: string;
  status: "delivered" | "bounced";
};

const VALIDATE_ORIGIN_REF = makeFunctionReference<
  "query",
  ValidateOriginArgs,
  ValidateOriginResult
>("workspaces.validateOrigin") as PublicQueryRef<ValidateOriginArgs, ValidateOriginResult>;

const GET_METADATA_REF = makeFunctionReference<"query", Record<string, never>, DiscoveryMetadata>(
  "discovery:getMetadata"
) as PublicQueryRef<Record<string, never>, DiscoveryMetadata>;

const GET_EMAIL_CONFIG_BY_FORWARDING_ADDRESS_REF = makeFunctionReference<
  "query",
  GetEmailConfigByForwardingAddressArgs,
  Doc<"emailConfigs"> | null
>("emailChannel:getEmailConfigByForwardingAddress") as PublicQueryRef<
  GetEmailConfigByForwardingAddressArgs,
  Doc<"emailConfigs"> | null
>;

const PROCESS_FORWARDED_EMAIL_REF = makeFunctionReference<
  "mutation",
  ProcessForwardedEmailArgs,
  Record<string, unknown>
>("emailChannel:processForwardedEmail") as MutationRef<
  "public",
  ProcessForwardedEmailArgs,
  Record<string, unknown>
>;

const PROCESS_INBOUND_EMAIL_REF = makeFunctionReference<
  "mutation",
  ProcessInboundEmailArgs,
  Record<string, unknown>
>("emailChannel:processInboundEmail") as MutationRef<
  "public",
  ProcessInboundEmailArgs,
  Record<string, unknown>
>;

const UPDATE_DELIVERY_STATUS_BY_EXTERNAL_ID_REF = makeFunctionReference<
  "mutation",
  UpdateDeliveryStatusByExternalIdArgs,
  unknown
>("emailChannel:updateDeliveryStatusByExternalId") as unknown as MutationRef<
  "internal",
  UpdateDeliveryStatusByExternalIdArgs
>;

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    query: PublicQueryRef<Args, Return>,
    args: Args
  ) => Promise<Return>;
}

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as <
    Visibility extends "public" | "internal",
    Args extends Record<string, unknown>,
    Return,
  >(
    mutation: MutationRef<Visibility, Args, Return>,
    args: Args
  ) => Promise<Return>;
}

async function validateOriginForWorkspace(
  ctx: { runQuery: unknown },
  request: Request
): Promise<{ valid: boolean; reason: string; origin: string | null }> {
  const origin = request.headers.get("origin");
  const workspaceId = request.headers.get("x-workspace-id");

  if (!workspaceId) {
    return { valid: true, reason: "No workspace specified", origin };
  }

  try {
    const runQuery = getShallowRunQuery(ctx);
    const result = await runQuery(VALIDATE_ORIGIN_REF, {
      workspaceId: workspaceId as Id<"workspaces">,
      origin: origin || "",
    });
    return { ...result, origin };
  } catch {
    return { valid: false, reason: "Invalid workspace ID", origin };
  }
}

http.route({
  path: "/geolocation",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const validation = await validateOriginForWorkspace(ctx, request);
    const corsHeaders = getCorsHeaders(validation.valid ? validation.origin : null, {
      allowMethods: "GET, OPTIONS",
      allowHeaders: "Content-Type, X-Workspace-Id",
    });

    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.reason }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (
      clientIp === "unknown" ||
      clientIp === "127.0.0.1" ||
      clientIp.startsWith("192.168.") ||
      clientIp.startsWith("10.")
    ) {
      return new Response(
        JSON.stringify({
          city: null,
          region: null,
          country: null,
          countryCode: null,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    try {
      const response = await fetch(
        `https://ip-api.com/json/${clientIp}?fields=city,regionName,country,countryCode`
      );
      const data = await response.json();

      return new Response(
        JSON.stringify({
          city: data.city || null,
          region: data.regionName || null,
          country: data.country || null,
          countryCode: data.countryCode || null,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } catch (error) {
      console.error("Geolocation lookup failed:", error);
      return new Response(
        JSON.stringify({
          city: null,
          region: null,
          country: null,
          countryCode: null,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  }),
});

http.route({
  path: "/geolocation",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    const validation = await validateOriginForWorkspace(ctx, request);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: validation.reason }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, {
      headers: getCorsHeaders(validation.origin, {
        allowMethods: "GET, OPTIONS",
        allowHeaders: "Content-Type, X-Workspace-Id",
      }),
    });
  }),
});

http.route({
  path: "/.well-known/opencom.json",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const origin = request.headers.get("origin");
    const allowOrigin = origin && isPublicDiscoveryOriginAllowed(origin) ? origin : null;
    const corsHeaders = getCorsHeaders(allowOrigin, {
      allowMethods: "GET, OPTIONS",
      allowHeaders: "Content-Type",
    });

    if (origin && !allowOrigin) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const runQuery = getShallowRunQuery(ctx);
      const metadata = await runQuery(GET_METADATA_REF, {});
      const settings = metadata as {
        signupMode?: "invite-only" | "domain-allowlist";
        authMethods?: ("password" | "otp")[];
      };

      return new Response(
        JSON.stringify({
          version: metadata.version,
          name: metadata.name,
          convexUrl: CONVEX_URL,
          features: metadata.features,
          signupMode: settings.signupMode,
          authMethods: settings.authMethods,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } catch (error) {
      console.error("Discovery endpoint error:", error);
      return new Response(JSON.stringify({ error: "Failed to retrieve instance metadata" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  }),
});

http.route({
  path: "/.well-known/opencom.json",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    const origin = request.headers.get("origin");
    if (origin && !isPublicDiscoveryOriginAllowed(origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, {
      headers: getCorsHeaders(origin && isPublicDiscoveryOriginAllowed(origin) ? origin : null, {
        allowMethods: "GET, OPTIONS",
        allowHeaders: "Content-Type",
      }),
    });
  }),
});

// Email Inbound Webhook (Resend)
http.route({
  path: "/api/email/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify webhook signature
      const rawBody = await request.text();
      const signature =
        request.headers.get("svix-signature") || request.headers.get("webhook-signature");

      const signatureError = await ensureWebhookSignature(rawBody, signature, "/api/email/inbound");
      if (signatureError) {
        return signatureError;
      }

      const body = JSON.parse(rawBody);

      // Parse Resend inbound email format
      // See: https://resend.com/docs/dashboard/receiving/introduction
      const { from, to, cc, subject, text, html, headers, attachments } = body;

      // Extract Message-ID and threading headers
      const messageId =
        headers?.["message-id"] || headers?.["Message-ID"] || `${Date.now()}@inbound`;
      const inReplyTo = headers?.["in-reply-to"] || headers?.["In-Reply-To"];
      const referencesHeader = headers?.["references"] || headers?.["References"];
      const references = referencesHeader
        ? referencesHeader.split(/\s+/).filter(Boolean)
        : undefined;

      // Find workspace by forwarding address
      const toAddresses = Array.isArray(to) ? to : [to];
      let emailConfig: Doc<"emailConfigs"> | null = null;
      const runQuery = getShallowRunQuery(ctx);

      for (const toAddr of toAddresses) {
        const addr = toAddr.toLowerCase().trim();
        emailConfig = await runQuery(GET_EMAIL_CONFIG_BY_FORWARDING_ADDRESS_REF, {
          forwardingAddress: addr,
          webhookSecret: EMAIL_WEBHOOK_INTERNAL_SECRET || undefined,
        });
        if (emailConfig) break;

        // Try extracting just the email part
        const match = addr.match(/<([^>]+)>/) || [null, addr];
        if (match[1]) {
          emailConfig = await runQuery(GET_EMAIL_CONFIG_BY_FORWARDING_ADDRESS_REF, {
            forwardingAddress: match[1],
            webhookSecret: EMAIL_WEBHOOK_INTERNAL_SECRET || undefined,
          });
          if (emailConfig) break;
        }
      }

      if (!emailConfig) {
        console.error("No email config found for addresses:", toAddresses);
        return new Response(JSON.stringify({ error: "Unknown recipient" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!emailConfig.enabled) {
        return new Response(JSON.stringify({ error: "Email channel disabled" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if this is a forwarded email (detect "Fwd:" in subject or forwarding patterns)
      const isForwarded = /^fwd?:/i.test(subject) || /^------\s*forwarded/im.test(text || "");

      let result: Record<string, unknown>;
      if (isForwarded) {
        // Try to extract original sender from forwarded content
        const originalFromMatch = (text || html || "").match(/from:\s*([^\n\r]+)/i);
        const originalFrom = originalFromMatch ? originalFromMatch[1].trim() : from;

        const runMutation = getShallowRunMutation(ctx);
        result = await runMutation(PROCESS_FORWARDED_EMAIL_REF, {
          workspaceId: emailConfig.workspaceId,
          webhookSecret: EMAIL_WEBHOOK_INTERNAL_SECRET || undefined,
          forwarderEmail: from,
          originalFrom,
          to: toAddresses,
          subject,
          textBody: text,
          htmlBody: html,
          messageId,
          attachments: attachments?.map(
            (a: { filename: string; content_type: string; size: number }) => ({
              filename: a.filename,
              contentType: a.content_type,
              size: a.size,
            })
          ),
        });
      } else {
        const runMutation = getShallowRunMutation(ctx);
        result = await runMutation(PROCESS_INBOUND_EMAIL_REF, {
          workspaceId: emailConfig.workspaceId,
          webhookSecret: EMAIL_WEBHOOK_INTERNAL_SECRET || undefined,
          from,
          to: toAddresses,
          cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
          subject,
          textBody: text,
          htmlBody: html,
          messageId,
          inReplyTo,
          references,
          attachments: attachments?.map(
            (a: { filename: string; content_type: string; size: number }) => ({
              filename: a.filename,
              contentType: a.content_type,
              size: a.size,
            })
          ),
        });
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Email inbound webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// Email Webhook Status (for delivery notifications from Resend)
http.route({
  path: "/api/email/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify webhook signature
      const rawBody = await request.text();
      const signature =
        request.headers.get("svix-signature") || request.headers.get("webhook-signature");

      const signatureError = await ensureWebhookSignature(rawBody, signature, "/api/email/webhook");
      if (signatureError) {
        return signatureError;
      }

      const body = JSON.parse(rawBody);
      const { type, data } = body;

      // Handle delivery status events
      // See: https://resend.com/docs/webhooks/introduction
      if (type === "email.delivered" || type === "email.bounced" || type === "email.opened") {
        const externalEmailId = data?.email_id;
        if (externalEmailId) {
          // Map Resend event types to our delivery status
          const statusMap: Record<string, "delivered" | "bounced"> = {
            "email.delivered": "delivered",
            "email.bounced": "bounced",
          };

          const newStatus = statusMap[type];
          if (newStatus) {
            const runMutation = getShallowRunMutation(ctx);
            await runMutation(UPDATE_DELIVERY_STATUS_BY_EXTERNAL_ID_REF, {
              externalEmailId,
              status: newStatus,
            });
          }
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Email webhook error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// ── Automation API v1 routes ─────────────────────────────────────

import {
  listConversations,
  getConversation,
  updateConversation,
  listMessages,
  sendMessage,
  claimConversation,
  releaseConversation,
  escalateConversation,
  listVisitors,
  getVisitor,
  createVisitor,
  updateVisitor,
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  eventsFeed,
  replayWebhookDelivery,
} from "./automationHttpRoutes";

http.route({ path: "/api/v1/conversations", method: "GET", handler: listConversations });
http.route({ path: "/api/v1/conversations/get", method: "GET", handler: getConversation });
http.route({ path: "/api/v1/conversations/update", method: "POST", handler: updateConversation });
http.route({ path: "/api/v1/conversations/messages", method: "GET", handler: listMessages });
http.route({ path: "/api/v1/conversations/messages/send", method: "POST", handler: sendMessage });
http.route({ path: "/api/v1/conversations/claim", method: "POST", handler: claimConversation });
http.route({ path: "/api/v1/conversations/release", method: "POST", handler: releaseConversation });
http.route({ path: "/api/v1/conversations/escalate", method: "POST", handler: escalateConversation });
http.route({ path: "/api/v1/visitors", method: "GET", handler: listVisitors });
http.route({ path: "/api/v1/visitors/get", method: "GET", handler: getVisitor });
http.route({ path: "/api/v1/visitors/create", method: "POST", handler: createVisitor });
http.route({ path: "/api/v1/visitors/update", method: "POST", handler: updateVisitor });
http.route({ path: "/api/v1/tickets", method: "GET", handler: listTickets });
http.route({ path: "/api/v1/tickets/get", method: "GET", handler: getTicket });
http.route({ path: "/api/v1/tickets/create", method: "POST", handler: createTicket });
http.route({ path: "/api/v1/tickets/update", method: "POST", handler: updateTicket });
http.route({ path: "/api/v1/articles", method: "GET", handler: listArticles });
http.route({ path: "/api/v1/articles/get", method: "GET", handler: getArticle });
http.route({ path: "/api/v1/articles/create", method: "POST", handler: createArticle });
http.route({ path: "/api/v1/articles/update", method: "POST", handler: updateArticle });
http.route({ path: "/api/v1/articles/delete", method: "POST", handler: deleteArticle });
http.route({ path: "/api/v1/collections", method: "GET", handler: listCollections });
http.route({ path: "/api/v1/collections/get", method: "GET", handler: getCollection });
http.route({ path: "/api/v1/collections/create", method: "POST", handler: createCollection });
http.route({ path: "/api/v1/collections/update", method: "POST", handler: updateCollection });
http.route({ path: "/api/v1/collections/delete", method: "POST", handler: deleteCollection });
http.route({ path: "/api/v1/events/feed", method: "GET", handler: eventsFeed });
http.route({ path: "/api/v1/webhooks/replay", method: "POST", handler: replayWebhookDelivery });

export default http;
