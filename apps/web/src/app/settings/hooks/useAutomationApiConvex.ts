"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebMutation, useWebQuery, webMutationRef, webQueryRef } from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CredentialRecord = {
  _id: Id<"automationCredentials">;
  name: string;
  secretPrefix: string;
  scopes: string[];
  status: "active" | "disabled" | "expired";
  expiresAt?: number;
  actorName: string;
  lastUsedAt?: number;
  createdAt: number;
};

type SubscriptionRecord = {
  _id: Id<"automationWebhookSubscriptions">;
  url: string;
  signingSecretPrefix: string;
  eventTypes?: string[];
  resourceTypes?: string[];
  channels?: string[];
  aiWorkflowStates?: string[];
  status: "active" | "paused" | "disabled";
  createdAt: number;
};

type DeliveryRecord = {
  _id: Id<"automationWebhookDeliveries">;
  subscriptionId: Id<"automationWebhookSubscriptions">;
  eventId: Id<"automationEvents">;
  attemptNumber: number;
  status: "pending" | "success" | "failed" | "retrying";
  httpStatus?: number;
  error?: string;
  createdAt: number;
};

type ListDeliveriesArgs = {
  workspaceId: Id<"workspaces">;
  subscriptionId?: Id<"automationWebhookSubscriptions">;
  status?: "pending" | "success" | "failed" | "retrying";
  limit?: number;
};

const CREDENTIALS_LIST_REF = webQueryRef<WorkspaceArgs, CredentialRecord[]>(
  "automationCredentials:list"
);
const SUBSCRIPTIONS_LIST_REF = webQueryRef<WorkspaceArgs, SubscriptionRecord[]>(
  "automationWebhooks:listSubscriptions"
);
const DELIVERIES_LIST_REF = webQueryRef<ListDeliveriesArgs, DeliveryRecord[]>(
  "automationWebhooks:listDeliveries"
);

const CREATE_CREDENTIAL_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    name: string;
    scopes: string[];
    actorName: string;
    expiresAt?: number;
  },
  { credentialId: Id<"automationCredentials">; secret: string }
>("automationCredentials:create");

const ROTATE_CREDENTIAL_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; credentialId: Id<"automationCredentials"> },
  { secret: string }
>("automationCredentials:rotate");

const DISABLE_CREDENTIAL_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; credentialId: Id<"automationCredentials"> },
  { success: boolean }
>("automationCredentials:disable");

const ENABLE_CREDENTIAL_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; credentialId: Id<"automationCredentials"> },
  { success: boolean }
>("automationCredentials:enable");

const REMOVE_CREDENTIAL_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; credentialId: Id<"automationCredentials"> },
  { success: boolean }
>("automationCredentials:remove");

const CREATE_SUBSCRIPTION_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    url: string;
    eventTypes?: string[];
    resourceTypes?: string[];
  },
  { subscriptionId: Id<"automationWebhookSubscriptions">; signingSecret: string }
>("automationWebhooks:createSubscription");

const UPDATE_SUBSCRIPTION_REF = webMutationRef<
  {
    workspaceId: Id<"workspaces">;
    subscriptionId: Id<"automationWebhookSubscriptions">;
    url?: string;
    eventTypes?: string[];
    resourceTypes?: string[];
    status?: "active" | "paused" | "disabled";
  },
  { success: boolean }
>("automationWebhooks:updateSubscription");

const DELETE_SUBSCRIPTION_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; subscriptionId: Id<"automationWebhookSubscriptions"> },
  { success: boolean }
>("automationWebhooks:deleteSubscription");

const TEST_SUBSCRIPTION_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; subscriptionId: Id<"automationWebhookSubscriptions"> },
  { success: boolean; message: string }
>("automationWebhooks:testSubscription");

const REPLAY_DELIVERY_REF = webMutationRef<
  { workspaceId: Id<"workspaces">; deliveryId: Id<"automationWebhookDeliveries"> },
  { success: boolean }
>("automationWebhooks:replayDelivery");

export function useAutomationApiConvex(workspaceId?: Id<"workspaces">) {
  const credentials = useWebQuery(
    CREDENTIALS_LIST_REF,
    workspaceId ? { workspaceId } : "skip"
  );
  const subscriptions = useWebQuery(
    SUBSCRIPTIONS_LIST_REF,
    workspaceId ? { workspaceId } : "skip"
  );

  return {
    credentials,
    subscriptions,
    createCredential: useWebMutation(CREATE_CREDENTIAL_REF),
    rotateCredential: useWebMutation(ROTATE_CREDENTIAL_REF),
    disableCredential: useWebMutation(DISABLE_CREDENTIAL_REF),
    enableCredential: useWebMutation(ENABLE_CREDENTIAL_REF),
    removeCredential: useWebMutation(REMOVE_CREDENTIAL_REF),
    createSubscription: useWebMutation(CREATE_SUBSCRIPTION_REF),
    updateSubscription: useWebMutation(UPDATE_SUBSCRIPTION_REF),
    deleteSubscription: useWebMutation(DELETE_SUBSCRIPTION_REF),
    testSubscription: useWebMutation(TEST_SUBSCRIPTION_REF),
    replayDelivery: useWebMutation(REPLAY_DELIVERY_REF),
    deliveriesListRef: DELIVERIES_LIST_REF,
  };
}

export type { CredentialRecord, SubscriptionRecord, DeliveryRecord };
