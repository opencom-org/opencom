"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  Mail,
  Bell,
  Smartphone,
  GitBranch,
  Search,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";

type CampaignTab = "email" | "push" | "carousels" | "series";

function CampaignsContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [activeTab, setActiveTab] = useState<CampaignTab>("email");
  const [searchQuery, setSearchQuery] = useState("");
  const [carouselActionError, setCarouselActionError] = useState<string | null>(null);

  const emailCampaigns = useQuery(
    api.emailCampaigns.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const pushCampaigns = useQuery(
    api.pushCampaigns.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const carousels = useQuery(
    api.carousels.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const seriesList = useQuery(
    api.series.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createEmailCampaign = useMutation(api.emailCampaigns.create);
  const createPushCampaign = useMutation(api.pushCampaigns.create);
  const createCarousel = useMutation(api.carousels.create);
  const createSeries = useMutation(api.series.create);
  const duplicateCarousel = useMutation(api.carousels.duplicate);

  const deleteEmailCampaign = useMutation(api.emailCampaigns.remove);
  const deletePushCampaign = useMutation(api.pushCampaigns.remove);
  const deleteCarousel = useMutation(api.carousels.remove);
  const deleteSeries = useMutation(api.series.remove);

  const pauseEmailCampaign = useMutation(api.emailCampaigns.pause);
  const pausePushCampaign = useMutation(api.pushCampaigns.pause);
  const pauseCarousel = useMutation(api.carousels.pause);
  const pauseSeries = useMutation(api.series.pause);

  const activateCarousel = useMutation(api.carousels.activate);
  const activateSeries = useMutation(api.series.activate);

  const handleDeleteCarousel = async (id: Id<"carousels">) => {
    setCarouselActionError(null);
    if (!confirm("Delete this carousel? This also removes impression analytics.")) {
      return;
    }
    try {
      await deleteCarousel({ id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete carousel.";
      if (message.toLowerCase().includes("not found")) {
        router.refresh();
        return;
      }
      setCarouselActionError(message);
    }
  };

  const handleDuplicateCarousel = async (id: Id<"carousels">) => {
    setCarouselActionError(null);
    try {
      const duplicateId = await duplicateCarousel({ id });
      router.push(`/campaigns/carousels/${duplicateId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to duplicate carousel.";
      setCarouselActionError(message);
    }
  };

  const handleToggleCarouselStatus = async (carousel: { _id: Id<"carousels">; status: string }) => {
    setCarouselActionError(null);
    try {
      if (carousel.status === "active") {
        await pauseCarousel({ id: carousel._id });
      } else {
        await activateCarousel({ id: carousel._id });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update carousel status.";
      setCarouselActionError(message);
      router.refresh();
    }
  };

  const handleCreateEmail = async () => {
    if (!activeWorkspace?._id) return;
    const id = await createEmailCampaign({
      workspaceId: activeWorkspace._id,
      name: "New Email Campaign",
      subject: "Your subject line",
      content: "<p>Your email content here</p>",
    });
    router.push(`/campaigns/email/${id}`);
  };

  const handleCreatePush = async () => {
    if (!activeWorkspace?._id) return;
    const id = await createPushCampaign({
      workspaceId: activeWorkspace._id,
      name: "New Push Campaign",
      title: "Notification Title",
      body: "Notification body text",
    });
    router.push(`/campaigns/push/${id}`);
  };

  const handleCreateCarousel = async () => {
    if (!activeWorkspace?._id) return;
    const id = await createCarousel({
      workspaceId: activeWorkspace._id,
      name: "New Carousel",
      screens: [
        {
          id: "screen-1",
          title: "Welcome",
          body: "Swipe to learn more",
        },
      ],
    });
    router.push(`/campaigns/carousels/${id}`);
  };

  const handleCreateSeries = async () => {
    if (!activeWorkspace?._id) return;
    const id = await createSeries({
      workspaceId: activeWorkspace._id,
      name: "New Series",
      description: "Multi-step campaign flow",
    });
    router.push(`/campaigns/series/${id}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "sent":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "paused":
      case "scheduled":
        return "bg-yellow-100 text-yellow-800";
      case "sending":
        return "bg-primary/10 text-primary";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const tabs = [
    { id: "email" as const, label: "Email", icon: Mail, count: emailCampaigns?.length || 0 },
    { id: "push" as const, label: "Push", icon: Bell, count: pushCampaigns?.length || 0 },
    {
      id: "carousels" as const,
      label: "Carousels",
      icon: Smartphone,
      count: carousels?.length || 0,
    },
    { id: "series" as const, label: "Series", icon: GitBranch, count: seriesList?.length || 0 },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-gray-500">Orchestrate multi-channel outreach campaigns</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "email" && (
            <Button onClick={handleCreateEmail}>
              <Plus className="h-4 w-4 mr-2" />
              New Email Campaign
            </Button>
          )}
          {activeTab === "push" && (
            <Button onClick={handleCreatePush}>
              <Plus className="h-4 w-4 mr-2" />
              New Push Campaign
            </Button>
          )}
          {activeTab === "carousels" && (
            <Button onClick={handleCreateCarousel}>
              <Plus className="h-4 w-4 mr-2" />
              New Carousel
            </Button>
          )}
          {activeTab === "series" && (
            <Button onClick={handleCreateSeries}>
              <Plus className="h-4 w-4 mr-2" />
              New Series
            </Button>
          )}
        </div>
      </div>

      {activeTab === "carousels" && carouselActionError && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          data-testid="carousels-action-error"
        >
          {carouselActionError}
        </div>
      )}

      <div className="flex border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {activeTab === "email" && (
        <EmailCampaignsList
          campaigns={emailCampaigns?.filter((c: NonNullable<typeof emailCampaigns>[number]) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          onDelete={deleteEmailCampaign}
          onPause={pauseEmailCampaign}
          getStatusBadge={getStatusBadge}
        />
      )}

      {activeTab === "push" && (
        <PushCampaignsList
          campaigns={pushCampaigns?.filter((c: NonNullable<typeof pushCampaigns>[number]) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          onDelete={deletePushCampaign}
          onPause={pausePushCampaign}
          getStatusBadge={getStatusBadge}
        />
      )}

      {activeTab === "carousels" && (
        <CarouselsList
          carousels={carousels?.filter((c: NonNullable<typeof carousels>[number]) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          onDelete={handleDeleteCarousel}
          onDuplicate={handleDuplicateCarousel}
          onToggleStatus={handleToggleCarouselStatus}
          getStatusBadge={getStatusBadge}
        />
      )}

      {activeTab === "series" && (
        <SeriesList
          series={seriesList?.filter((s: NonNullable<typeof seriesList>[number]) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
          )}
          onDelete={deleteSeries}
          onPause={pauseSeries}
          onActivate={activateSeries}
          getStatusBadge={getStatusBadge}
        />
      )}
    </div>
  );
}

function EmailCampaignsList({
  campaigns,
  onDelete,
  onPause,
  getStatusBadge,
}: {
  campaigns:
    | Array<{
        _id: Id<"emailCampaigns">;
        name: string;
        subject: string;
        status: string;
        createdAt: number;
      }>
    | undefined;
  onDelete: (args: { id: Id<"emailCampaigns"> }) => Promise<null>;
  onPause: (args: { id: Id<"emailCampaigns"> }) => Promise<null>;
  getStatusBadge: (status: string) => string;
}) {
  if (!campaigns?.length) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">No email campaigns yet</h3>
        <p className="text-gray-500">Create your first email campaign to reach your audience</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Subject</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
            <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.map((campaign) => (
            <tr key={campaign._id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <Link
                  href={`/campaigns/email/${campaign._id}`}
                  className="font-medium hover:text-primary"
                >
                  {campaign.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-gray-500">{campaign.subject}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(campaign.status)}`}
                >
                  {campaign.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-1">
                  {campaign.status === "sending" && (
                    <Button variant="ghost" size="sm" onClick={() => onPause({ id: campaign._id })}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Link href={`/campaigns/email/${campaign._id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete({ id: campaign._id })}
                    className="text-red-600 hover:text-red-700"
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
  );
}

function PushCampaignsList({
  campaigns,
  onDelete,
  onPause,
  getStatusBadge,
}: {
  campaigns:
    | Array<{
        _id: Id<"pushCampaigns">;
        name: string;
        title: string;
        status: string;
        createdAt: number;
      }>
    | undefined;
  onDelete: (args: { id: Id<"pushCampaigns"> }) => Promise<null>;
  onPause: (args: { id: Id<"pushCampaigns"> }) => Promise<null>;
  getStatusBadge: (status: string) => string;
}) {
  if (!campaigns?.length) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">No push campaigns yet</h3>
        <p className="text-gray-500">Create your first push campaign to engage mobile users</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Title</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
            <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.map((campaign) => (
            <tr key={campaign._id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <Link
                  href={`/campaigns/push/${campaign._id}`}
                  className="font-medium hover:text-primary"
                >
                  {campaign.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-gray-500">{campaign.title}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(campaign.status)}`}
                >
                  {campaign.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(campaign.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-1">
                  {campaign.status === "sending" && (
                    <Button variant="ghost" size="sm" onClick={() => onPause({ id: campaign._id })}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Link href={`/campaigns/push/${campaign._id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete({ id: campaign._id })}
                    className="text-red-600 hover:text-red-700"
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
  );
}

function CarouselsList({
  carousels,
  onDelete,
  onDuplicate,
  onToggleStatus,
  getStatusBadge,
}: {
  carousels:
    | Array<{
        _id: Id<"carousels">;
        name: string;
        screens: unknown[];
        status: string;
        createdAt: number;
      }>
    | undefined;
  onDelete: (id: Id<"carousels">) => Promise<void>;
  onDuplicate: (id: Id<"carousels">) => Promise<void>;
  onToggleStatus: (carousel: { _id: Id<"carousels">; status: string }) => Promise<void>;
  getStatusBadge: (status: string) => string;
}) {
  if (!carousels?.length) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <Smartphone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">No carousels yet</h3>
        <p className="text-gray-500">Create mobile carousels for in-app onboarding</p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Screens</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
            <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {carousels.map((carousel) => (
            <tr
              key={carousel._id}
              className="hover:bg-gray-50"
              data-testid={`carousel-row-${carousel._id}`}
            >
              <td className="px-6 py-4">
                <Link
                  href={`/campaigns/carousels/${carousel._id}`}
                  className="font-medium hover:text-primary"
                >
                  {carousel.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-gray-500">{carousel.screens.length} screens</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(carousel.status)}`}
                >
                  {carousel.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(carousel.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-1">
                  <Button
                    data-testid={`carousel-status-toggle-${carousel._id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleStatus({ _id: carousel._id, status: carousel.status })}
                  >
                    {carousel.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    data-testid={`carousel-duplicate-${carousel._id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicate(carousel._id)}
                    title="Duplicate carousel"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Link href={`/campaigns/carousels/${carousel._id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    data-testid={`carousel-delete-${carousel._id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(carousel._id)}
                    className="text-red-600 hover:text-red-700"
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
  );
}

function SeriesList({
  series,
  onDelete,
  onPause,
  onActivate,
  getStatusBadge,
}: {
  series:
    | Array<{
        _id: Id<"series">;
        name: string;
        description?: string;
        status: string;
        createdAt: number;
      }>
    | undefined;
  onDelete: (args: { id: Id<"series"> }) => Promise<null>;
  onPause: (args: { id: Id<"series"> }) => Promise<null>;
  onActivate: (args: { id: Id<"series"> }) => Promise<null>;
  getStatusBadge: (status: string) => string;
}) {
  if (!series?.length) {
    return (
      <div className="text-center py-12 border rounded-lg bg-white">
        <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">No series yet</h3>
        <p className="text-gray-500">
          Create multi-step campaign flows to orchestrate user journeys
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Name</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Description</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
            <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Created</th>
            <th className="text-right px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {series.map((s) => (
            <tr key={s._id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <Link
                  href={`/campaigns/series/${s._id}`}
                  className="font-medium hover:text-primary"
                >
                  {s.name}
                </Link>
              </td>
              <td className="px-6 py-4 text-gray-500">{s.description || "-"}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(s.status)}`}
                >
                  {s.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(s.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      s.status === "active" ? onPause({ id: s._id }) : onActivate({ id: s._id })
                    }
                  >
                    {s.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Link href={`/campaigns/series/${s._id}`}>
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete({ id: s._id })}
                    className="text-red-600 hover:text-red-700"
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
  );
}

export default function CampaignsPage() {
  return (
    <AppLayout>
      <CampaignsContent />
    </AppLayout>
  );
}
