"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { Button, Card } from "@opencom/ui";
import { Home, Plus, X, GripVertical, Search, MessageSquare, FileText, Bell } from "lucide-react";
import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";

// Card type definitions for Home settings
const CARD_TYPES = [
  {
    type: "welcome",
    label: "Welcome Header",
    icon: Home,
    description: "Logo, greeting, and team intro",
  },
  { type: "search", label: "Search Help", icon: Search, description: "Inline article search" },
  {
    type: "conversations",
    label: "Recent Conversations",
    icon: MessageSquare,
    description: "Show active threads",
  },
  {
    type: "startConversation",
    label: "Start Conversation",
    icon: Plus,
    description: "CTA to begin messaging",
  },
  {
    type: "featuredArticles",
    label: "Featured Articles",
    icon: FileText,
    description: "Curated help content",
  },
  { type: "announcements", label: "Announcements", icon: Bell, description: "News and updates" },
] as const;

const TAB_TYPES = [
  {
    id: "home",
    label: "Home",
    description: "Landing space with customizable cards",
    locked: false,
  },
  {
    id: "messages",
    label: "Messages",
    description: "Conversation list and message composer",
    locked: true,
  },
  {
    id: "help",
    label: "Help Center",
    description: "Knowledge base browsing and search",
    locked: false,
  },
  {
    id: "tours",
    label: "Product Tours",
    description: "Interactive walkthrough launcher",
    locked: false,
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Checklist progress and guided tasks",
    locked: false,
  },
  {
    id: "tickets",
    label: "Tickets",
    description: "Support ticket list and creation",
    locked: false,
  },
] as const;

type CardType = (typeof CARD_TYPES)[number]["type"];
type TabId = (typeof TAB_TYPES)[number]["id"];
type VisibleTo = "all" | "visitors" | "users";
type HomeCardConfigPrimitive = string | number | boolean | null;
type HomeCardConfigObject = Record<string, HomeCardConfigPrimitive>;
type HomeCardConfigValue =
  | HomeCardConfigPrimitive
  | HomeCardConfigPrimitive[]
  | HomeCardConfigObject;
type HomeCardConfig = Record<string, HomeCardConfigValue>;

interface HomeCard {
  id: string;
  type: CardType;
  config?: HomeCardConfig;
  visibleTo: VisibleTo;
}

interface HomeTab {
  id: TabId;
  enabled: boolean;
  visibleTo: VisibleTo;
}

interface HomeConfigResponse {
  enabled: boolean;
  cards: HomeCard[];
  defaultSpace: "home" | "messages" | "help";
  tabs?: HomeTab[];
}

const DEFAULT_TABS: HomeTab[] = [
  { id: "home", enabled: true, visibleTo: "all" },
  { id: "messages", enabled: true, visibleTo: "all" },
  { id: "help", enabled: true, visibleTo: "all" },
  { id: "tours", enabled: true, visibleTo: "all" },
  { id: "tasks", enabled: true, visibleTo: "all" },
  { id: "tickets", enabled: true, visibleTo: "all" },
];

function normalizeTabs(tabs: HomeTab[] | undefined): HomeTab[] {
  const tabsById = new Map((tabs ?? []).map((tab) => [tab.id, tab]));
  return DEFAULT_TABS.map((defaultTab) => {
    if (defaultTab.id === "messages") {
      return { ...defaultTab };
    }
    const configuredTab = tabsById.get(defaultTab.id);
    if (!configuredTab) {
      return { ...defaultTab };
    }
    return {
      id: defaultTab.id,
      enabled: configuredTab.enabled,
      visibleTo: configuredTab.visibleTo,
    };
  });
}

export function HomeSettingsSection({
  workspaceId,
}: {
  workspaceId?: Id<"workspaces">;
}): React.JSX.Element | null {
  const homeConfig = useQuery(
    api.messengerSettings.getHomeConfig,
    workspaceId ? { workspaceId } : "skip"
  ) as HomeConfigResponse | undefined;

  const updateHomeConfig = useMutation(api.messengerSettings.updateHomeConfig);
  const toggleHomeEnabled = useMutation(api.messengerSettings.toggleHomeEnabled);

  const [enabled, setEnabled] = useState(false);
  const [cards, setCards] = useState<HomeCard[]>([]);
  const [tabs, setTabs] = useState<HomeTab[]>(DEFAULT_TABS);
  const [defaultSpace, setDefaultSpace] = useState<"home" | "messages" | "help">("messages");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (homeConfig) {
      setEnabled(homeConfig.enabled);
      setCards(homeConfig.cards as HomeCard[]);
      setDefaultSpace(homeConfig.defaultSpace);
      setTabs(normalizeTabs(homeConfig.tabs));
    }
  }, [homeConfig]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setIsSaving(true);
    try {
      await updateHomeConfig({
        workspaceId,
        homeConfig: {
          enabled,
          cards,
          defaultSpace,
          tabs: normalizeTabs(tabs),
        },
      });
    } catch (error) {
      console.error("Failed to save home settings:", error);
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!workspaceId) return;
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    try {
      await toggleHomeEnabled({ workspaceId, enabled: newEnabled });
    } catch (error) {
      console.error("Failed to toggle home:", error);
      setEnabled(!newEnabled);
    }
  };

  const addCard = (type: CardType) => {
    const newCard: HomeCard = {
      id: `${type}-${Date.now()}`,
      type,
      visibleTo: "all",
    };
    setCards([...cards, newCard]);
    setShowAddCard(false);
  };

  const removeCard = (id: string) => {
    setCards(cards.filter((c) => c.id !== id));
  };

  const updateCardVisibility = (id: string, visibleTo: VisibleTo) => {
    setCards(cards.map((c) => (c.id === id ? { ...c, visibleTo } : c)));
  };

  const updateTabVisibility = (id: TabId, visibleTo: VisibleTo) => {
    setTabs(
      tabs.map((tab) => (tab.id === id ? { ...tab, visibleTo: id === "messages" ? "all" : visibleTo } : tab))
    );
  };

  const updateTabEnabled = (id: TabId, enabledValue: boolean) => {
    if (id === "messages") {
      return;
    }
    setTabs(tabs.map((tab) => (tab.id === id ? { ...tab, enabled: enabledValue } : tab)));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCards = [...cards];
    const [draggedCard] = newCards.splice(draggedIndex, 1);
    newCards.splice(index, 0, draggedCard);
    setCards(newCards);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getCardIcon = (type: CardType) => {
    const cardDef = CARD_TYPES.find((c) => c.type === type);
    return cardDef?.icon ?? Home;
  };

  const getCardLabel = (type: CardType) => {
    const cardDef = CARD_TYPES.find((c) => c.type === type);
    return cardDef?.label ?? type;
  };

  if (!workspaceId) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Messenger Home</h2>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Configure a customizable Home space as the default entry point for your messenger. Add cards
        to help visitors find answers and take action.
      </p>

      {enabled && (
        <div className="space-y-6">
          {/* Default Space Fallback */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Space (when Home is disabled)</label>
            <select
              value={defaultSpace}
              onChange={(e) => setDefaultSpace(e.target.value as typeof defaultSpace)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            >
              <option value="home">Home</option>
              <option value="messages">Messages</option>
              <option value="help">Help Center</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Messenger Tabs</label>
            <div className="space-y-2">
              {TAB_TYPES.map((tabType) => {
                const tab = tabs.find((item) => item.id === tabType.id) ?? {
                  id: tabType.id,
                  enabled: true,
                  visibleTo: "all" as const,
                };
                const toggleDisabled = tabType.locked;
                const visibilityDisabled = tabType.locked;

                return (
                  <div
                    key={tabType.id}
                    className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{tabType.label}</p>
                      <p className="text-xs text-muted-foreground">{tabType.description}</p>
                    </div>
                    <select
                      value={tab.visibleTo}
                      onChange={(e) => updateTabVisibility(tabType.id, e.target.value as VisibleTo)}
                      disabled={visibilityDisabled}
                      className="px-2 py-1 text-xs border rounded bg-background disabled:opacity-60"
                    >
                      <option value="all">All</option>
                      <option value="visitors">Visitors only</option>
                      <option value="users">Users only</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => updateTabEnabled(tabType.id, !tab.enabled)}
                      disabled={toggleDisabled}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tab.enabled ? "bg-primary" : "bg-gray-300"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          tab.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              The Messages tab stays enabled for all visitors, matching Intercom-style behavior.
            </p>
          </div>

          {/* Card List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Home Cards</label>
              <Button variant="outline" size="sm" onClick={() => setShowAddCard(!showAddCard)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Card
              </Button>
            </div>

            {showAddCard && (
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
                {CARD_TYPES.map((cardType) => {
                  const Icon = cardType.icon;
                  const isAdded = cards.some((c) => c.type === cardType.type);
                  return (
                    <button
                      key={cardType.type}
                      onClick={() => !isAdded && addCard(cardType.type)}
                      disabled={isAdded}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isAdded
                          ? "bg-muted opacity-50 cursor-not-allowed"
                          : "bg-background hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{cardType.label}</p>
                        <p className="text-xs text-muted-foreground">{cardType.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {cards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No cards added yet</p>
                <p className="text-xs">Click &quot;Add Card&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cards.map((card, index) => {
                  const Icon = getCardIcon(card.type);
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 bg-background border rounded-lg ${
                        draggedIndex === index ? "opacity-50" : ""
                      }`}
                    >
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                      <Icon className="h-5 w-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{getCardLabel(card.type)}</p>
                      </div>
                      <select
                        value={card.visibleTo}
                        onChange={(e) => updateCardVisibility(card.id, e.target.value as VisibleTo)}
                        className="px-2 py-1 text-xs border rounded bg-background"
                      >
                        <option value="all">All</option>
                        <option value="visitors">Visitors only</option>
                        <option value="users">Users only</option>
                      </select>
                      <button
                        onClick={() => removeCard(card.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3 text-center">Home Preview</p>
            <div className="bg-background rounded-lg border overflow-hidden max-w-xs mx-auto">
              <div className="p-3 bg-primary text-primary-foreground text-sm font-medium">Home</div>
              <div className="p-3 space-y-2">
                {cards.map((card) => {
                  const Icon = getCardIcon(card.type);
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{getCardLabel(card.type)}</span>
                    </div>
                  );
                })}
                {cards.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Add cards to see preview
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Home Settings"}
          </Button>
        </div>
      )}

      {!enabled && (
        <div className="text-center py-6 text-muted-foreground">
          <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enable Messenger Home to configure cards</p>
          <p className="text-xs mt-1">
            The Home space provides a customizable entry point for your messenger
          </p>
        </div>
      )}
    </Card>
  );
}
