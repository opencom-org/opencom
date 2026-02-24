"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { Pencil, Trash2, Play, Pause, Search, MessageSquare, Bell, Flag } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type MessageType = "chat" | "post" | "banner";
type MessageStatus = "draft" | "active" | "paused" | "archived";

function OutboundContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MessageType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | MessageStatus>("all");

  const messages = useQuery(
    api.outboundMessages.list,
    activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          type: typeFilter === "all" ? undefined : typeFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip"
  );

  const createMessage = useMutation(api.outboundMessages.create);
  const deleteMessage = useMutation(api.outboundMessages.remove);
  const activateMessage = useMutation(api.outboundMessages.activate);
  const pauseMessage = useMutation(api.outboundMessages.pause);

  const handleCreate = async (type: MessageType) => {
    if (!activeWorkspace?._id) return;
    const messageId = await createMessage({
      workspaceId: activeWorkspace._id,
      type,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Message`,
      content:
        type === "chat"
          ? { text: "Hello! How can we help you today?" }
          : type === "post"
            ? {
                title: "Announcement",
                body: "We have exciting news to share!",
                buttons: [
                  { text: "Learn More", action: "open_new_conversation" as const },
                  { text: "Dismiss", action: "dismiss" as const },
                ],
              }
            : { text: "Check out our latest update!", style: "inline", dismissible: true },
    });
    router.push(`/outbound/${messageId}`);
  };

  const handleDelete = async (id: Id<"outboundMessages">) => {
    if (confirm("Are you sure you want to delete this message?")) {
      await deleteMessage({ id });
    }
  };

  const handleToggleStatus = async (message: NonNullable<typeof messages>[number]) => {
    if (message.status === "active") {
      await pauseMessage({ id: message._id });
    } else {
      await activateMessage({ id: message._id });
    }
  };

  const filteredMessages = messages?.filter((msg: NonNullable<typeof messages>[number]) =>
    msg.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: MessageType) => {
    switch (type) {
      case "chat":
        return <MessageSquare className="h-4 w-4" />;
      case "post":
        return <Bell className="h-4 w-4" />;
      case "banner":
        return <Flag className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Outbound Messages</h1>
          <p className="text-gray-500">Proactively engage users with in-app messages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCreate("chat")}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
          <Button variant="outline" onClick={() => handleCreate("post")}>
            <Bell className="h-4 w-4 mr-2" />
            Post
          </Button>
          <Button onClick={() => handleCreate("banner")}>
            <Flag className="h-4 w-4 mr-2" />
            Banner
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Types</option>
          <option value="chat">Chat</option>
          <option value="post">Post</option>
          <option value="banner">Banner</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filteredMessages?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No outbound messages yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first message to proactively engage users
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => handleCreate("chat")}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat Message
            </Button>
            <Button variant="outline" onClick={() => handleCreate("post")}>
              <Bell className="h-4 w-4 mr-2" />
              Post Message
            </Button>
            <Button onClick={() => handleCreate("banner")}>
              <Flag className="h-4 w-4 mr-2" />
              Banner
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMessages?.map((msg: NonNullable<typeof messages>[number]) => (
                <tr key={msg._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/outbound/${msg._id}`} className="hover:text-primary">
                      <div className="font-medium">{msg.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-md">
                        {msg.content.text || msg.content.title || msg.content.body || "No content"}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(msg.type)}
                      <span className="capitalize">{msg.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(msg.status)}`}
                    >
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(msg.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(msg)}
                        title={msg.status === "active" ? "Pause" : "Activate"}
                      >
                        {msg.status === "active" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Link href={`/outbound/${msg._id}`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(msg._id)}
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OutboundPage() {
  return (
    <AppLayout>
      <OutboundContent />
    </AppLayout>
  );
}
