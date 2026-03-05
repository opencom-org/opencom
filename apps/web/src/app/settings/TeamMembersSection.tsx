"use client";

import { Button, Card, Input } from "@opencom/ui";
import { ChevronDown, Clock, Mail, Trash2, UserPlus, Users, X } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";
import type { TeamMembersSettingsController } from "./useTeamMembersSettings";

type MemberRole = "owner" | "admin" | "agent" | "viewer";

export interface TeamMemberRecord {
  _id: Id<"workspaceMembers">;
  userId?: Id<"users"> | null;
  name?: string | null;
  email?: string | null;
  role: MemberRole;
}

export interface PendingInvitationRecord {
  _id: Id<"workspaceInvitations">;
  email: string;
  role: "admin" | "agent" | "viewer";
}

interface TeamMembersSectionProps {
  isAdmin: boolean;
  isOwner: boolean;
  currentUserId?: Id<"users"> | null;
  members: TeamMemberRecord[] | undefined;
  pendingInvitations: PendingInvitationRecord[] | undefined;
  controller: TeamMembersSettingsController;
}

export function TeamMembersSection({
  isAdmin,
  isOwner,
  currentUserId,
  members,
  pendingInvitations,
  controller,
}: TeamMembersSectionProps): React.JSX.Element {
  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Team Members</h2>
        </div>

        {isAdmin && (
          <form onSubmit={controller.handleInvite} className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4" />
              <span className="font-medium text-sm">Invite Team Member</span>
            </div>

            {controller.inviteError && (
              <div className="p-2 mb-3 text-sm text-red-600 bg-red-50 rounded">
                {controller.inviteError}
              </div>
            )}

            {controller.inviteSuccess && (
              <div className="p-2 mb-3 text-sm text-green-600 bg-green-50 rounded">
                {controller.inviteSuccess}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                type="email"
                value={controller.inviteEmail}
                onChange={(e) => controller.setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1"
                required
              />
              <select
                value={controller.inviteRole}
                onChange={(e) =>
                  controller.setInviteRole(e.target.value as "admin" | "agent" | "viewer")
                }
                className="px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="viewer">Viewer</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={controller.isInviting || !controller.inviteEmail.trim()}>
                {controller.isInviting ? "Sending..." : "Invite"}
              </Button>
            </div>
          </form>
        )}

        {isAdmin && pendingInvitations && pendingInvitations.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Pending Invitations</span>
            </div>
            <div className="space-y-2">
              {pendingInvitations.map((invitation) => (
                <div
                  key={invitation._id}
                  className="flex items-center justify-between py-2 px-3 bg-amber-50 border border-amber-200 rounded"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">{invitation.email}</span>
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                      {invitation.role}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => controller.handleCancelInvitation(invitation._id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {members?.map((member) => (
            <div key={member._id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium">{member.name || member.email}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && member.role !== "owner" ? (
                  <div className="relative">
                    <button
                      onClick={() =>
                        controller.setRoleDropdownOpen(
                          controller.roleDropdownOpen === member._id ? null : member._id
                        )
                      }
                      className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                        member.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : member.role === "viewer"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {member.role}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {controller.roleDropdownOpen === member._id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10">
                        <button
                          onClick={() =>
                            controller.handleRoleChange(
                              member._id,
                              "admin",
                              member.name || member.email || "Unknown member",
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "admin" ? "font-medium" : ""}`}
                        >
                          Admin
                        </button>
                        <button
                          onClick={() =>
                            controller.handleRoleChange(
                              member._id,
                              "agent",
                              member.name || member.email || "Unknown member",
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "agent" ? "font-medium" : ""}`}
                        >
                          Agent
                        </button>
                        <button
                          onClick={() =>
                            controller.handleRoleChange(
                              member._id,
                              "viewer",
                              member.name || member.email || "Unknown member",
                              member.role
                            )
                          }
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${member.role === "viewer" ? "font-medium" : ""}`}
                        >
                          Viewer
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      member.role === "owner"
                        ? "bg-amber-100 text-amber-700"
                        : member.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : member.role === "viewer"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {member.role}
                  </span>
                )}
                {isAdmin && member.userId !== currentUserId && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      controller.handleRemoveMember(
                        member._id,
                        member.name || member.email || "Unknown member"
                      )
                    }
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {isOwner && (
          <div className="mt-4 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <h3 className="font-medium text-amber-800 mb-2">Transfer Ownership</h3>
            <p className="text-sm text-amber-700 mb-3">
              Transfer workspace ownership to another admin. This action cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => controller.setShowTransferOwnership(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Transfer Ownership
            </Button>
          </div>
        )}
      </Card>

      {controller.showRoleConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md">
            <h3 className="font-semibold text-lg mb-2">Confirm Role Change</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Change <strong>{controller.showRoleConfirm.memberName}</strong>&apos;s role from{" "}
              <strong>{controller.showRoleConfirm.currentRole}</strong> to{" "}
              <strong>{controller.showRoleConfirm.newRole}</strong>?
              {controller.showRoleConfirm.newRole === "admin" && (
                <span className="block mt-2 text-amber-600">
                  Admins have full management access to this workspace.
                </span>
              )}
              {(controller.showRoleConfirm.currentRole === "admin" ||
                controller.showRoleConfirm.currentRole === "owner") &&
                controller.showRoleConfirm.newRole !== "admin" &&
                controller.showRoleConfirm.newRole !== "owner" && (
                  <span className="block mt-2 text-amber-600">
                    This will revoke their administrative privileges.
                  </span>
                )}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => controller.setShowRoleConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  controller.executeRoleChange(
                    controller.showRoleConfirm!.membershipId,
                    controller.showRoleConfirm!.newRole as "admin" | "agent" | "viewer"
                  )
                }
              >
                Confirm Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {controller.showTransferOwnership && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md">
            <h3 className="font-semibold text-lg mb-2">Transfer Ownership</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select an admin to transfer ownership to. You will become an admin after the transfer.
            </p>
            <select
              value={controller.transferTargetId ?? ""}
              onChange={(e) => controller.setTransferTargetId(e.target.value as Id<"users">)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background mb-4"
            >
              <option value="">Select a team member...</option>
              {members
                ?.filter((m) => m.role === "admin" && m.userId !== currentUserId)
                .map((member) => (
                  <option key={member.userId} value={member.userId ?? ""}>
                    {member.name || member.email}
                  </option>
                ))}
            </select>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  controller.setShowTransferOwnership(false);
                  controller.setTransferTargetId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={controller.handleTransferOwnership}
                disabled={!controller.transferTargetId}
              >
                Transfer Ownership
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
