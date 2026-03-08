"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { appConfirm } from "@/lib/appConfirm";
import type { Id } from "@opencom/convex/dataModel";

type WorkspaceMemberRole = "owner" | "admin" | "agent" | "viewer";

export interface RoleConfirmState {
  membershipId: Id<"workspaceMembers">;
  memberName: string;
  currentRole: string;
  newRole: WorkspaceMemberRole;
}

interface UseTeamMembersSettingsOptions {
  workspaceId?: Id<"workspaces"> | null;
  onError: (error: unknown, fallbackMessage: string, nextAction: string) => void;
}

export interface TeamMembersSettingsController {
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteRole: "admin" | "agent" | "viewer";
  setInviteRole: (value: "admin" | "agent" | "viewer") => void;
  isInviting: boolean;
  inviteError: string;
  inviteSuccess: string;
  roleDropdownOpen: string | null;
  setRoleDropdownOpen: (value: string | null) => void;
  showTransferOwnership: boolean;
  setShowTransferOwnership: (value: boolean) => void;
  transferTargetId: Id<"users"> | null;
  setTransferTargetId: (value: Id<"users"> | null) => void;
  showRoleConfirm: RoleConfirmState | null;
  setShowRoleConfirm: (value: RoleConfirmState | null) => void;
  handleInvite: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  handleRoleChange: (
    membershipId: Id<"workspaceMembers">,
    newRole: WorkspaceMemberRole,
    memberName: string,
    currentRole: string
  ) => Promise<void>;
  executeRoleChange: (
    membershipId: Id<"workspaceMembers">,
    newRole: "admin" | "agent" | "viewer"
  ) => Promise<void>;
  handleTransferOwnership: () => Promise<void>;
  handleRemoveMember: (membershipId: Id<"workspaceMembers">, memberName: string) => Promise<void>;
  handleCancelInvitation: (invitationId: Id<"workspaceInvitations">) => Promise<void>;
}

type InviteToWorkspaceFn = (args: {
  workspaceId: Id<"workspaces">;
  email: string;
  role: "admin" | "agent" | "viewer";
  baseUrl: string;
}) => Promise<{ status?: "added" | "invited" }>;

type UpdateRoleFn = (args: {
  membershipId: Id<"workspaceMembers">;
  role: "admin" | "agent" | "viewer";
}) => Promise<{ success: boolean }>;

type RemoveMemberFn = (args: { membershipId: Id<"workspaceMembers"> }) => Promise<{ success: boolean }>;
type CancelInvitationFn = (args: {
  invitationId: Id<"workspaceInvitations">;
}) => Promise<{ success: boolean }>;
type TransferOwnershipFn = (args: {
  workspaceId: Id<"workspaces">;
  newOwnerId: Id<"users">;
}) => Promise<{ success: boolean }>;

export function useTeamMembersSettings({
  workspaceId,
  onError,
}: UseTeamMembersSettingsOptions): TeamMembersSettingsController {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent" | "viewer">("agent");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<string | null>(null);
  const [showTransferOwnership, setShowTransferOwnership] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<Id<"users"> | null>(null);
  const [showRoleConfirm, setShowRoleConfirm] = useState<RoleConfirmState | null>(null);

  const inviteToWorkspace = useAction(api.workspaceMembers.inviteToWorkspace) as InviteToWorkspaceFn;
  const updateRole = useMutation(api.workspaceMembers.updateRole) as UpdateRoleFn;
  const removeMember = useMutation(api.workspaceMembers.remove) as RemoveMemberFn;
  const cancelInvitation = useMutation(api.workspaceMembers.cancelInvitation) as CancelInvitationFn;
  const transferOwnership = useMutation(api.workspaceMembers.transferOwnership) as TransferOwnershipFn;

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!workspaceId || !inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const result = await inviteToWorkspace({
        workspaceId,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        baseUrl: window.location.origin,
      });

      if (result.status === "added") {
        setInviteSuccess("User added to workspace!");
      } else {
        setInviteSuccess("Invitation sent!");
      }
      setInviteEmail("");
      setInviteRole("agent");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const executeRoleChange = async (
    membershipId: Id<"workspaceMembers">,
    newRole: "admin" | "agent" | "viewer"
  ) => {
    try {
      await updateRole({ membershipId, role: newRole });
      setShowRoleConfirm(null);
    } catch (err) {
      onError(err, "Failed to update role", "Refresh the member list and try again.");
    }
  };

  const handleRoleChange = async (
    membershipId: Id<"workspaceMembers">,
    newRole: WorkspaceMemberRole,
    memberName: string,
    currentRole: string
  ) => {
    setRoleDropdownOpen(null);

    const isPrivilegeChange =
      (newRole === "admin" && currentRole !== "owner") ||
      newRole === "owner" ||
      currentRole === "admin" ||
      currentRole === "owner";

    if (isPrivilegeChange) {
      setShowRoleConfirm({ membershipId, memberName, currentRole, newRole });
      return;
    }

    await executeRoleChange(membershipId, newRole);
  };

  const handleTransferOwnership = async () => {
    if (!workspaceId || !transferTargetId) return;

    try {
      await transferOwnership({ workspaceId, newOwnerId: transferTargetId });
      setShowTransferOwnership(false);
      setTransferTargetId(null);
    } catch (err) {
      onError(err, "Failed to transfer ownership", "Verify target admin permissions and try again.");
    }
  };

  const handleRemoveMember = async (membershipId: Id<"workspaceMembers">, memberName: string) => {
    if (!(await appConfirm(`Are you sure you want to remove ${memberName} from this workspace?`))) {
      return;
    }

    try {
      await removeMember({ membershipId });
    } catch (err) {
      onError(err, "Failed to remove member", "Try again in a moment.");
    }
  };

  const handleCancelInvitation = async (invitationId: Id<"workspaceInvitations">) => {
    try {
      await cancelInvitation({ invitationId });
    } catch (err) {
      onError(err, "Failed to cancel invitation", "Refresh invitations and retry.");
    }
  };

  return {
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    isInviting,
    inviteError,
    inviteSuccess,
    roleDropdownOpen,
    setRoleDropdownOpen,
    showTransferOwnership,
    setShowTransferOwnership,
    transferTargetId,
    setTransferTargetId,
    showRoleConfirm,
    setShowRoleConfirm,
    handleInvite,
    handleRoleChange,
    executeRoleChange,
    handleTransferOwnership,
    handleRemoveMember,
    handleCancelInvitation,
  };
}
