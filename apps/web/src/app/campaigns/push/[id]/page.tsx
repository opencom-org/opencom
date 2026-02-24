"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, Send, Smartphone, BarChart3 } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";

function PushCampaignEditor() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as Id<"pushCampaigns">;
  const { activeWorkspace } = useAuth();

  const campaign = useQuery(api.pushCampaigns.get, { id: campaignId });
  const stats = useQuery(api.pushCampaigns.getStats, { id: campaignId });
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const updateCampaign = useMutation(api.pushCampaigns.update);
  const sendCampaign = useMutation(api.pushCampaigns.send);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setTitle(campaign.title);
      setBody(campaign.body);
      setImageUrl(campaign.imageUrl || "");
      setDeepLink(campaign.deepLink || "");
      setAudienceRules((campaign.audienceRules ?? campaign.targeting) as AudienceRule | null);
    }
  }, [campaign]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCampaign({
        id: campaignId,
        name,
        title,
        body,
        imageUrl: imageUrl || undefined,
        deepLink: deepLink || undefined,
        targeting: audienceRules ?? undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!confirm("Are you sure you want to send this push notification?")) return;
    await sendCampaign({ id: campaignId });
    router.push("/campaigns");
  };

  if (!campaign) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-lg font-semibold border-none p-0 focus:ring-0"
              placeholder="Campaign name"
            />
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  campaign.status === "sent"
                    ? "bg-green-100 text-green-800"
                    : campaign.status === "sending"
                      ? "bg-primary/10 text-primary"
                      : campaign.status === "scheduled"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                }`}
              >
                {campaign.status}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {campaign.status === "draft" && (
            <Button onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Send Push
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter notification title"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/50 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notification Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter notification message"
                className="w-full h-24 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                maxLength={150}
              />
              <p className="text-xs text-gray-500 mt-1">{body.length}/150 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL (optional)
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
              />
              <p className="text-xs text-gray-500 mt-1">Rich push notification image</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deep Link (optional)
              </label>
              <Input
                value={deepLink}
                onChange={(e) => setDeepLink(e.target.value)}
                placeholder="myapp://screen/details"
              />
              <p className="text-xs text-gray-500 mt-1">Navigate to specific screen when tapped</p>
            </div>

            <div className="bg-white border rounded-lg p-6">
              <h3 className="font-medium mb-4">Audience Targeting</h3>
              <p className="text-sm text-gray-500 mb-4">
                Target specific users based on their properties, custom attributes, or behavior.
              </p>
              <AudienceRuleBuilder
                value={audienceRules}
                onChange={setAudienceRules}
                eventNames={eventNames ?? []}
                workspaceId={activeWorkspace?._id}
              />
            </div>

            {campaign.status === "sent" && stats && (
              <div className="bg-white border rounded-lg p-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Push Analytics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-gray-500">Recipients</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Delivery Rate</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.openRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Open Rate</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.failed}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 border-l bg-gray-100 p-6 overflow-auto">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Preview
          </h3>
          <div className="bg-gray-800 rounded-3xl p-4 shadow-xl">
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/50 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  APP
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {title || "Notification Title"}
                  </div>
                  <div className="text-gray-600 text-xs line-clamp-2">
                    {body || "Notification body text"}
                  </div>
                </div>
                <div className="text-gray-400 text-xs">now</div>
              </div>
              {imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PushCampaignPage() {
  return (
    <AppLayout>
      <PushCampaignEditor />
    </AppLayout>
  );
}
