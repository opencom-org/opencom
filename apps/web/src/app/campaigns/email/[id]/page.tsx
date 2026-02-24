"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, Send, Eye, BarChart3 } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

function EmailCampaignEditor() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as Id<"emailCampaigns">;
  const { activeWorkspace } = useAuth();

  const campaign = useQuery(api.emailCampaigns.get, { id: campaignId });
  const stats = useQuery(api.emailCampaigns.getStats, { id: campaignId });
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const updateCampaign = useMutation(api.emailCampaigns.update);
  const sendCampaign = useMutation(api.emailCampaigns.send);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [content, setContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setSubject(campaign.subject);
      setPreviewText(campaign.previewText || "");
      setContent(campaign.content);
      setAudienceRules((campaign.audienceRules ?? campaign.targeting) as AudienceRule | null);
    }
  }, [campaign]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCampaign({
        id: campaignId,
        name,
        subject,
        previewText: previewText || undefined,
        content,
        targeting: audienceRules ?? undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!confirm("Are you sure you want to send this campaign?")) return;
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
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {campaign.status === "draft" && (
            <Button onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Send Campaign
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 p-6 overflow-auto ${showPreview ? "w-1/2" : ""}`}>
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject"
                className="text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preview Text</label>
              <Input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Text shown in email preview (optional)"
              />
              <p className="text-xs text-gray-500 mt-1">
                This text appears after the subject line in email clients
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Content</label>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b px-3 py-2 flex gap-2">
                  <button
                    className="px-2 py-1 text-sm hover:bg-gray-200 rounded"
                    onClick={() => setContent(content + "<h1>Heading</h1>")}
                  >
                    H1
                  </button>
                  <button
                    className="px-2 py-1 text-sm hover:bg-gray-200 rounded"
                    onClick={() => setContent(content + "<p>Paragraph</p>")}
                  >
                    P
                  </button>
                  <button
                    className="px-2 py-1 text-sm hover:bg-gray-200 rounded font-bold"
                    onClick={() => setContent(content + "<strong>Bold</strong>")}
                  >
                    B
                  </button>
                  <button
                    className="px-2 py-1 text-sm hover:bg-gray-200 rounded"
                    onClick={() => setContent(content + '<a href="">Link</a>')}
                  >
                    Link
                  </button>
                  <button
                    className="px-2 py-1 text-sm hover:bg-gray-200 rounded"
                    onClick={() => setContent(content + "{{user.name}}")}
                  >
                    {"{{name}}"}
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-64 p-4 font-mono text-sm focus:outline-none resize-none"
                  placeholder="<p>Hello {{user.name}},</p>&#10;&#10;<p>Your email content here...</p>"
                />
              </div>
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
                  Campaign Analytics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-sm text-gray-500">Recipients</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.openRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Open Rate</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.clickRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Click Rate</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold">{stats.bounceRate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500">Bounce Rate</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showPreview && (
          <div className="w-1/2 border-l bg-gray-100 p-6 overflow-auto">
            <div className="max-w-lg mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2 text-sm">
                <div className="font-medium">{subject || "No subject"}</div>
                <div className="text-gray-400 text-xs">{previewText || "Preview text..."}</div>
              </div>
              <div className="p-6">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(content || "<p>Email content preview</p>"),
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailCampaignPage() {
  return (
    <AppLayout>
      <EmailCampaignEditor />
    </AppLayout>
  );
}
