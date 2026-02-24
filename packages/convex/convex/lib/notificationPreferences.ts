export const DEFAULT_NEW_VISITOR_MESSAGE_EMAIL = true;
export const DEFAULT_NEW_VISITOR_MESSAGE_PUSH = true;

export type NewVisitorMessagePreference = {
  email: boolean;
  push: boolean;
};

export type NotificationEventOverrides = {
  newVisitorMessage?: {
    email?: boolean;
    push?: boolean;
  };
};

export type NotificationPreferenceLike = {
  muted?: boolean | null;
  events?: NotificationEventOverrides | null;
};

export type WorkspaceNotificationDefaultsLike = {
  events?: NotificationEventOverrides | null;
};

export function resolveWorkspaceNewVisitorMessageDefaults(
  defaultsDoc?: WorkspaceNotificationDefaultsLike | null
): NewVisitorMessagePreference {
  return {
    email: defaultsDoc?.events?.newVisitorMessage?.email ?? DEFAULT_NEW_VISITOR_MESSAGE_EMAIL,
    push: defaultsDoc?.events?.newVisitorMessage?.push ?? DEFAULT_NEW_VISITOR_MESSAGE_PUSH,
  };
}

export function resolveMemberNewVisitorMessagePreference(
  preferenceDoc: NotificationPreferenceLike | null | undefined,
  workspaceDefaults: NewVisitorMessagePreference
): NewVisitorMessagePreference {
  return {
    email: preferenceDoc?.events?.newVisitorMessage?.email ?? workspaceDefaults.email,
    push: preferenceDoc?.muted
      ? false
      : (preferenceDoc?.events?.newVisitorMessage?.push ?? workspaceDefaults.push),
  };
}
