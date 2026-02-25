import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { MessageCircle, X, Plus, Search, Map, CheckSquare, Ticket, Home } from "./icons";
import { Home as HomeComponent, useHomeConfig } from "./components/Home";
import { ConversationList } from "./components/ConversationList";
import { ConversationView } from "./components/ConversationView";
import { HelpCenter } from "./components/HelpCenter";
import { ArticleDetail } from "./components/ArticleDetail";
import { TourPicker } from "./components/TourPicker";
import { TasksList } from "./components/TasksList";
import { TicketsList } from "./components/TicketsList";
import { TicketDetail } from "./components/TicketDetail";
import { TicketCreate } from "./components/TicketCreate";
import type { Id } from "@opencom/convex/dataModel";
import {
  setStartTourCallback,
  setGetAvailableToursCallback,
  type UserIdentification,
} from "./main";
import { TourOverlay } from "./TourOverlay";
import { OutboundOverlay } from "./OutboundOverlay";
import { TooltipOverlay } from "./TooltipOverlay";
import { SurveyOverlay } from "./SurveyOverlay";
import { useWidgetSession } from "./hooks/useWidgetSession";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { useEventTracking } from "./hooks/useEventTracking";
import { useNavigationTracking } from "./hooks/useNavigationTracking";
import { checkElementsAvailable } from "./utils/dom";
import { selectSurveyForDelivery, type SurveyDeliveryCandidate } from "@opencom/sdk-core";
import {
  buildWidgetUnreadSnapshot,
  getWidgetUnreadIncreases,
  loadWidgetCuePreferences,
  shouldSuppressWidgetCue,
} from "./lib/widgetNotificationCues";

type WidgetView =
  | "launcher"
  | "conversation-list"
  | "conversation"
  | "article-search"
  | "article-detail"
  | "tour-picker"
  | "checklist"
  | "tickets"
  | "ticket-detail"
  | "ticket-create";

// Main tabs that show in the bottom nav
type MainTab = "home" | "messages" | "help" | "tours" | "tasks" | "tickets";
type BlockingExperience = "tour" | "outbound_post" | "survey_large";

interface WidgetProps {
  workspaceId?: string;
  initialUser?: UserIdentification;
  convexUrl?: string;
  trackPageViews?: boolean;
  onboardingVerificationToken?: string;
  verificationToken?: string; // Deprecated alias
  clientVersion?: string;
  clientIdentifier?: string;
}

type TicketFormValue = string | number | boolean | string[] | null;
type TicketFormData = Record<string, TicketFormValue>;

function normalizeTicketFormData(formData: Record<string, unknown>): TicketFormData {
  const normalized: TicketFormData = {};
  for (const [key, value] of Object.entries(formData)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      normalized[key] = value;
      continue;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      normalized[key] = value;
      continue;
    }

    normalized[key] = null;
  }
  return normalized;
}

export function Widget({
  workspaceId: _workspaceId,
  initialUser,
  convexUrl,
  trackPageViews,
  onboardingVerificationToken,
  verificationToken,
  clientVersion,
  clientIdentifier,
}: WidgetProps) {
  // ── View / navigation state ────────────────────────────────────────
  const [view, setView] = useState<WidgetView>("launcher");
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [userInfo, setUserInfo] = useState<UserIdentification | undefined>(initialUser);
  const [originError, setOriginError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugWorkspaceId, setDebugWorkspaceId] = useState(_workspaceId || "");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(_workspaceId);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<Id<"articles"> | null>(null);
  const [previousView, setPreviousView] = useState<WidgetView>("conversation-list");
  const [forcedTourId, setForcedTourId] = useState<Id<"tours"> | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<Id<"tickets"> | null>(null);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [sessionShownSurveyIds, setSessionShownSurveyIds] = useState<Set<string>>(new Set());
  const [completedSurveyIds, setCompletedSurveyIds] = useState<Set<string>>(new Set());
  const [surveyEligibilityUnavailable, setSurveyEligibilityUnavailable] = useState(false);
  const [activeBlockingExperience, setActiveBlockingExperience] =
    useState<BlockingExperience | null>(null);
  const [tourBlockingActive, setTourBlockingActive] = useState(false);
  const [outboundBlockingState, setOutboundBlockingState] = useState<{
    hasPendingPost: boolean;
    hasActivePost: boolean;
  }>({
    hasPendingPost: false,
    hasActivePost: false,
  });
  const locationFetchedRef = useRef(false);
  const widgetCuePreferencesRef = useRef({
    browserNotifications: true,
    sound: false,
  });
  const unreadSnapshotRef = useRef<Record<string, number> | null>(null);

  // ── Tooltip trigger context ────────────────────────────────────────
  const [tooltipTriggerContext, setTooltipTriggerContext] = useState<{
    currentUrl?: string;
    timeOnPageSeconds?: number;
    scrollPercent?: number;
    firedEventName?: string;
    isExitIntent?: boolean;
  }>({
    currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
  });

  // Check if workspace ID looks valid (basic format check)
  const isValidIdFormat = !!(activeWorkspaceId && /^[a-z0-9]{32}$/.test(activeWorkspaceId));

  // ── Extracted hooks ────────────────────────────────────────────────
  // Validate workspace exists (only if ID format is valid)
  const workspaceValidation = useQuery(
    api.workspaces.get,
    isValidIdFormat ? { id: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const { sessionId, visitorId, setVisitorId, visitorIdRef, sessionToken, sessionTokenRef } =
    useWidgetSession({
      activeWorkspaceId,
      userInfo,
      workspaceValidation,
      isOpen: view !== "launcher",
      onboardingVerificationToken,
      verificationToken,
      clientVersion,
      clientIdentifier,
    });

  const { messengerSettings, effectiveTheme } = useWidgetSettings(
    activeWorkspaceId,
    isValidIdFormat
  );

  const { handleTrackEvent } = useEventTracking({
    visitorId,
    activeWorkspaceId,
    sessionId,
    sessionTokenRef,
    userInfo,
    setUserInfo,
    onTrackEventName: (name) => {
      setTooltipTriggerContext((prev) => ({ ...prev, firedEventName: name }));
    },
  });

  useNavigationTracking({
    trackPageViews,
    visitorId,
    activeWorkspaceId,
    sessionId,
    sessionTokenRef,
    onTrackEvent: handleTrackEvent,
    onTooltipContextChange: setTooltipTriggerContext,
  });

  // ── Mutations still used directly ──────────────────────────────────
  const createConversation = useMutation(api.conversations.createForVisitor);
  const markAsReadMutation = useMutation(api.conversations.markAsRead);
  const addTicketComment = useMutation(api.tickets.addComment);
  const createTicket = useMutation(api.tickets.create);

  // ── Queries ────────────────────────────────────────────────────────
  const visitorTickets = useQuery(
    api.tickets.listByVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  );

  const selectedTicket = useQuery(
    api.tickets.get,
    selectedTicketId
      ? {
          id: selectedTicketId,
          visitorId: visitorId ?? undefined,
          sessionToken: sessionToken ?? undefined,
        }
      : "skip"
  );

  const ticketForm = useQuery(
    api.ticketForms.getDefaultForVisitor,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const visitorConversations = useQuery(
    api.conversations.listByVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  );

  const totalUnread = useQuery(
    api.conversations.getTotalUnreadForVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  );

  const normalizedUnreadCount = useMemo(() => {
    if (typeof totalUnread === "number") {
      return Number.isFinite(totalUnread) && totalUnread > 0 ? Math.floor(totalUnread) : 0;
    }
    const parsedCount = Number(totalUnread ?? 0);
    return Number.isFinite(parsedCount) && parsedCount > 0 ? Math.floor(parsedCount) : 0;
  }, [totalUnread]);

  const articleSearchResults = useQuery(
    api.articles.searchForVisitor,
    isValidIdFormat && visitorId && sessionToken && articleSearchQuery.length >= 2
      ? {
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          visitorId,
          sessionToken,
          query: articleSearchQuery,
        }
      : "skip"
  );

  // List published articles for browsing (when not searching), filtered by visitor audience
  const publishedArticles = useQuery(
    api.articles.listForVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { workspaceId: activeWorkspaceId as Id<"workspaces">, visitorId, sessionToken }
      : "skip"
  );

  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return undefined;

    const fromSearch = articleSearchResults?.find((article) => article._id === selectedArticleId);
    if (fromSearch) return fromSearch;

    return publishedArticles?.find((article) => article._id === selectedArticleId);
  }, [selectedArticleId, articleSearchResults, publishedArticles]);

  const selectedConversation = useMemo(() => {
    if (!conversationId) {
      return null;
    }
    return (
      visitorConversations?.find((conversation) => conversation._id === conversationId) ?? null
    );
  }, [visitorConversations, conversationId]);

  // Automation settings for self-serve features (getOrCreate returns defaults for new workspaces)
  const automationSettings = useQuery(
    api.automationSettings.getOrCreate,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  // Common issue buttons for quick actions
  const commonIssueButtons = useQuery(
    api.commonIssueButtons.list,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  // Office hours for reply time expectations
  const officeHoursStatus = useQuery(
    api.officeHours.isCurrentlyOpen,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const expectedReplyTime = useQuery(
    api.officeHours.getExpectedReplyTime,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  // Tour queries
  const availableTours = useQuery(
    api.tourProgress.getAvailableTours,
    isValidIdFormat && visitorId && sessionToken
      ? {
          visitorId,
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          sessionToken,
          currentUrl: window.location.href,
        }
      : "skip"
  );

  const allTours = useQuery(
    api.tours.listAll,
    isValidIdFormat && visitorId && sessionToken
      ? { workspaceId: activeWorkspaceId as Id<"workspaces">, visitorId, sessionToken }
      : "skip"
  );

  // Checklist query for showing empty state
  const eligibleChecklists = useQuery(
    api.checklists.getEligible,
    isValidIdFormat && visitorId && sessionToken
      ? { workspaceId: activeWorkspaceId as Id<"workspaces">, visitorId, sessionToken }
      : "skip"
  );

  const activeSurveys = useQuery(
    api.surveys.getActiveSurveys,
    isValidIdFormat && visitorId && sessionToken
      ? {
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          visitorId,
          sessionToken,
        }
      : "skip"
  );
  type ActiveSurvey = NonNullable<typeof activeSurveys>[number];
  const [displayedSurvey, setDisplayedSurvey] = useState<ActiveSurvey | null>(null);

  // Available tooltips based on audience rules and triggers
  const availableTooltips = useQuery(
    api.tooltips.getAvailableTooltips,
    isValidIdFormat && visitorId && sessionToken
      ? {
          workspaceId: activeWorkspaceId as Id<"workspaces">,
          visitorId,
          sessionToken,
          triggerContext: tooltipTriggerContext,
        }
      : "skip"
  );

  const candidateSurvey = useMemo(() => {
    if (!activeSurveys || surveyEligibilityUnavailable) {
      return null;
    }
    return selectSurveyForDelivery(
      activeSurveys as Array<SurveyDeliveryCandidate<Id<"surveys">>>,
      {
        currentUrl: tooltipTriggerContext.currentUrl ?? window.location.href,
        timeOnPageSeconds: tooltipTriggerContext.timeOnPageSeconds,
        firedEventName: tooltipTriggerContext.firedEventName,
      },
      {
        sessionShownSurveyIds,
        completedSurveyIds,
      }
    ) as ActiveSurvey | null;
  }, [
    activeSurveys,
    surveyEligibilityUnavailable,
    tooltipTriggerContext.currentUrl,
    tooltipTriggerContext.timeOnPageSeconds,
    tooltipTriggerContext.firedEventName,
    sessionShownSurveyIds,
    completedSurveyIds,
  ]);

  const hasForcedTourCandidate = Boolean(
    forcedTourId &&
      allTours?.some((tourData) => tourData.tour._id === forcedTourId && tourData.steps.length > 0)
  );
  const hasRegularTourCandidate = Boolean(
    availableTours?.some((tourData) => tourData.steps.length > 0)
  );
  const hasTourBlockingCandidate = Boolean(
    visitorId &&
      activeWorkspaceId &&
      isValidIdFormat &&
      (hasRegularTourCandidate || hasForcedTourCandidate)
  );
  const hasOutboundPostBlockingCandidate = outboundBlockingState.hasPendingPost;
  const hasOutboundPostBlockingActive = outboundBlockingState.hasActivePost;
  const hasLargeSurveyBlockingCandidate = Boolean(
    candidateSurvey && candidateSurvey.format === "large" && !displayedSurvey
  );
  const hasLargeSurveyBlockingActive = displayedSurvey?.format === "large";

  useEffect(() => {
    if (activeBlockingExperience !== null) {
      return;
    }

    // Priority order for blockers:
    // 1. tours (guided workflows), 2. outbound post, 3. large surveys.
    if (hasTourBlockingCandidate) {
      setActiveBlockingExperience("tour");
      return;
    }

    if (hasOutboundPostBlockingCandidate) {
      setActiveBlockingExperience("outbound_post");
      return;
    }

    if (hasLargeSurveyBlockingCandidate) {
      setActiveBlockingExperience("survey_large");
    }
  }, [
    activeBlockingExperience,
    hasTourBlockingCandidate,
    hasOutboundPostBlockingCandidate,
    hasLargeSurveyBlockingCandidate,
  ]);

  useEffect(() => {
    if (activeBlockingExperience === null) {
      return;
    }

    if (activeBlockingExperience === "tour") {
      if (tourBlockingActive || hasTourBlockingCandidate) {
        return;
      }
      setActiveBlockingExperience(null);
      return;
    }

    if (activeBlockingExperience === "outbound_post") {
      if (hasOutboundPostBlockingActive || hasOutboundPostBlockingCandidate) {
        return;
      }
      setActiveBlockingExperience(null);
      return;
    }

    if (hasLargeSurveyBlockingActive || hasLargeSurveyBlockingCandidate) {
      return;
    }
    setActiveBlockingExperience(null);
  }, [
    activeBlockingExperience,
    tourBlockingActive,
    hasTourBlockingCandidate,
    hasOutboundPostBlockingActive,
    hasOutboundPostBlockingCandidate,
    hasLargeSurveyBlockingActive,
    hasLargeSurveyBlockingCandidate,
  ]);

  const allowTourBlocking = activeBlockingExperience === "tour";
  const allowOutboundPostBlocking = activeBlockingExperience === "outbound_post";
  const allowLargeSurveyBlocking = activeBlockingExperience === "survey_large";
  const hasAnyPendingBlockingCandidate =
    hasTourBlockingCandidate || hasOutboundPostBlockingCandidate || hasLargeSurveyBlockingCandidate;

  // Validate origin when workspaceId is provided (only if ID format is valid)
  const originValidation = useQuery(
    api.workspaces.validateOrigin,
    isValidIdFormat
      ? { workspaceId: activeWorkspaceId as Id<"workspaces">, origin: window.location.origin }
      : "skip"
  );

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWorkspaceError("workspaceId is required");
      return;
    }
    if (!isValidIdFormat) {
      setWorkspaceError("Invalid workspace ID format");
      return;
    }
    if (workspaceValidation === null) {
      setWorkspaceError("Workspace not found");
      return;
    }
    setWorkspaceError(null); // Clear error if workspace is valid
    if (originValidation && !originValidation.valid) {
      setOriginError(originValidation.reason);
    } else {
      setOriginError(null);
    }
  }, [activeWorkspaceId, isValidIdFormat, workspaceValidation, originValidation]);

  useEffect(() => {
    if (!(isValidIdFormat && visitorId && sessionToken && activeWorkspaceId)) {
      setSurveyEligibilityUnavailable(false);
      return;
    }
    if (activeSurveys !== undefined) {
      setSurveyEligibilityUnavailable(false);
      return;
    }

    const timeout = setTimeout(() => {
      setSurveyEligibilityUnavailable(true);
      console.warn(
        "[Opencom Widget] Survey eligibility unavailable, continuing without survey overlay"
      );
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isValidIdFormat, visitorId, sessionToken, activeWorkspaceId, activeSurveys]);

  const playWidgetCueSound = () => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gainNode.gain.setValueAtTime(0.045, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.onended = () => {
      void context.close();
    };
  };

  useEffect(() => {
    const refreshCuePreferences = () => {
      widgetCuePreferencesRef.current = loadWidgetCuePreferences(window.localStorage);
    };
    refreshCuePreferences();
    window.addEventListener("storage", refreshCuePreferences);
    return () => {
      window.removeEventListener("storage", refreshCuePreferences);
    };
  }, []);

  useEffect(() => {
    if (!visitorConversations) {
      return;
    }

    const previousSnapshot = unreadSnapshotRef.current;
    const currentSnapshot = buildWidgetUnreadSnapshot(
      visitorConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByVisitor: conversation.unreadByVisitor,
      }))
    );
    unreadSnapshotRef.current = currentSnapshot;

    if (!previousSnapshot) {
      return;
    }

    const increasedConversationIds = getWidgetUnreadIncreases({
      previous: previousSnapshot,
      conversations: visitorConversations.map((conversation) => ({
        _id: conversation._id,
        unreadByVisitor: conversation.unreadByVisitor,
      })),
    });
    if (increasedConversationIds.length === 0) {
      return;
    }

    const cueView =
      view === "conversation" || view === "launcher" ? view : ("conversation-list" as const);

    for (const increasedConversationId of increasedConversationIds) {
      const conversation = visitorConversations.find(
        (entry) => entry._id === increasedConversationId
      );
      if (!conversation) {
        continue;
      }

      const suppressCue = shouldSuppressWidgetCue({
        conversationId: increasedConversationId,
        activeConversationId: conversationId,
        widgetView: cueView,
        isDocumentVisible: document.visibilityState === "visible",
        hasWindowFocus: document.hasFocus(),
      });
      if (suppressCue) {
        continue;
      }

      const preferences = widgetCuePreferencesRef.current;
      if (preferences.sound) {
        playWidgetCueSound();
      }

      if (
        preferences.browserNotifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification("New message from support", {
          body: conversation.lastMessage?.content ?? "Tap to open the conversation.",
          tag: `opencom-widget-${conversation._id}`,
        });
        notification.onclick = () => {
          window.focus();
          setActiveTab("messages");
          setConversationId(conversation._id);
          setView("conversation");
        };
      }
    }
  }, [conversationId, view, visitorConversations]);

  useEffect(() => {
    if (displayedSurvey || !candidateSurvey) {
      return;
    }

    if (candidateSurvey.format === "large") {
      if (!allowLargeSurveyBlocking) {
        return;
      }
    } else if (activeBlockingExperience !== null || hasAnyPendingBlockingCandidate) {
      return;
    }

    const surveyId = candidateSurvey._id.toString();
    setSessionShownSurveyIds((prev) => {
      if (prev.has(surveyId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(surveyId);
      return next;
    });
    setDisplayedSurvey(candidateSurvey);
  }, [
    displayedSurvey,
    candidateSurvey,
    allowLargeSurveyBlocking,
    activeBlockingExperience,
    hasAnyPendingBlockingCandidate,
  ]);

  useEffect(() => {
    setDisplayedSurvey(null);
    setSessionShownSurveyIds(new Set());
    setCompletedSurveyIds(new Set());
    setActiveBlockingExperience(null);
    setTourBlockingActive(false);
    setOutboundBlockingState({ hasPendingPost: false, hasActivePost: false });
  }, [sessionId, visitorId, activeWorkspaceId]);

  useEffect(() => {
    unreadSnapshotRef.current = null;
  }, [sessionId, visitorId, activeWorkspaceId]);

  // Handle debug workspace ID update
  const handleDebugWorkspaceUpdate = () => {
    setActiveWorkspaceId(debugWorkspaceId);
    // Reset conversation state when workspace changes
    setConversationId(null);
    setVisitorId(null);
  };

  const handleNewConversation = async () => {
    // Wait briefly for visitor initialization if it hasn't completed yet
    let vid = visitorIdRef.current;
    if (!vid) {
      for (let i = 0; i < 30 && !visitorIdRef.current; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      vid = visitorIdRef.current;
    }
    if (!vid || !activeWorkspaceId) {
      console.warn("[Opencom Widget] Cannot create conversation - visitor not initialized", {
        visitorId: vid,
        activeWorkspaceId,
      });
      return;
    }
    try {
      const newConv = await createConversation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId: vid,
        sessionToken: sessionTokenRef.current ?? "",
      });
      if (newConv) {
        setConversationId(newConv._id);
        setView("conversation");
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  const handleSelectConversation = (convId: Id<"conversations">) => {
    setConversationId(convId);
    setView("conversation");
    markAsReadMutation({
      id: convId,
      readerType: "visitor",
      visitorId: visitorId ?? undefined,
      sessionToken: sessionTokenRef.current ?? undefined,
    }).catch(console.error);
  };

  const handleBackToList = () => {
    setView("conversation-list");
  };

  // (identify, trackEvent, and navigation tracking are now in extracted hooks)

  // Tour API callbacks
  const handleStartTour = useCallback((tourId: string) => {
    setForcedTourId(tourId as Id<"tours">);
  }, []);

  const handleGetAvailableTours = useCallback(() => {
    if (!allTours) return [];
    return allTours.map((t) => ({
      id: t.tour._id,
      name: t.tour.name,
      description: t.tour.description,
      status: t.tourStatus as "in_progress" | "completed" | "new",
      elementsAvailable: t.elementSelectors.every((sel: string) => document.querySelector(sel)),
    }));
  }, [allTours]);

  useEffect(() => {
    setStartTourCallback(handleStartTour);
    setGetAvailableToursCallback(handleGetAvailableTours);
  }, [handleStartTour, handleGetAvailableTours]);

  const handleTourComplete = useCallback(() => {
    setForcedTourId(null);
  }, []);

  const handleTourDismiss = useCallback(() => {
    setForcedTourId(null);
  }, []);

  const handleTourBlockingActiveChange = useCallback((isActive: boolean) => {
    setTourBlockingActive(isActive);
  }, []);

  const handleOutboundBlockingStateChange = useCallback(
    (state: { hasPendingPost: boolean; hasActivePost: boolean }) => {
      setOutboundBlockingState((prev) => {
        if (
          prev.hasPendingPost === state.hasPendingPost &&
          prev.hasActivePost === state.hasActivePost
        ) {
          return prev;
        }
        return state;
      });
    },
    []
  );

  useEffect(() => {
    async function fetchLocation() {
      if (locationFetchedRef.current || !convexUrl || !activeWorkspaceId) return;
      locationFetchedRef.current = true;

      try {
        const httpUrl = convexUrl.replace(".cloud", ".site");
        const response = await fetch(`${httpUrl}/geolocation`, {
          headers: {
            "X-Workspace-Id": activeWorkspaceId,
          },
        });
        const location = await response.json();
        if (location.city || location.country) {
          setUserInfo((prev) => ({
            ...prev,
            customAttributes: {
              ...prev?.customAttributes,
              location,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to fetch location:", error);
      }
    }

    fetchLocation();
  }, [convexUrl, activeWorkspaceId]);

  // (session lifecycle, heartbeat, token refresh are now in useWidgetSession hook)
  // (article suggestions, email capture, message sending are now in ConversationView component)

  // Home configuration for customizable home page
  const homeConfig = useHomeConfig(
    isValidIdFormat ? (activeWorkspaceId as Id<"workspaces">) : undefined,
    !!userInfo?.userId
  );

  // Determine initial tab based on home config
  useEffect(() => {
    if (homeConfig !== undefined) {
      if (!homeConfig?.enabled) {
        const defaultSpace = homeConfig?.defaultSpace || "messages";
        if (defaultSpace === "help") {
          setActiveTab("help");
        } else {
          setActiveTab("messages");
        }
      }
    }
  }, [homeConfig]);

  // Debug panel for dev mode
  const debugPanel = (
    <div className="opencom-debug">
      <div className="opencom-debug-header">
        <span>🔧 Debug Panel</span>
        <button onClick={() => setShowDebug(false)} className="opencom-debug-close">
          ×
        </button>
      </div>
      <div className="opencom-debug-content">
        <div className="opencom-debug-row">
          <label>Workspace ID:</label>
          <input
            type="text"
            value={debugWorkspaceId}
            onChange={(e) => setDebugWorkspaceId(e.target.value)}
            className="opencom-debug-input"
            placeholder="Enter workspace ID"
          />
        </div>
        <button onClick={handleDebugWorkspaceUpdate} className="opencom-debug-btn">
          Update Workspace
        </button>
        <div className="opencom-debug-info">
          <p>
            <strong>Active:</strong> {activeWorkspaceId || "none"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            {workspaceError
              ? `❌ ${workspaceError}`
              : workspaceValidation
                ? "✅ Valid"
                : "⏳ Loading..."}
          </p>
          <p>
            <strong>Visitor:</strong> {visitorId || "none"}
          </p>
          <p>
            <strong>Conversation:</strong> {conversationId || "none"}
          </p>
        </div>
      </div>
    </div>
  );

  // If workspace validation failed, show error with debug option
  if (workspaceError) {
    console.error("[Opencom Widget] Workspace validation failed:", workspaceError);
    return (
      <div className="opencom-widget">
        {showDebug && debugPanel}
        <div className="opencom-error">
          <p>Widget Error: {workspaceError}</p>
          <button onClick={() => setShowDebug(!showDebug)} className="opencom-debug-toggle">
            {showDebug ? "Hide Debug" : "Debug"}
          </button>
        </div>
      </div>
    );
  }

  // If origin validation failed, don't render the widget
  if (originError) {
    console.error("[Opencom Widget] Origin validation failed:", originError);
    return null;
  }

  const handleOpenWidget = () => {
    // Always open to conversation list first
    setView("conversation-list");
  };

  const handleCloseWidget = () => {
    setView("launcher");
  };

  // ── Navigation handlers ───────────────────────────────────────────
  const handleBackFromArticle = () => {
    setSelectedArticleId(null);
    setActiveTab("help");
    setView("conversation-list");
  };

  const handleStartConversationFromArticle = async () => {
    let vid = visitorIdRef.current;
    if (!vid) {
      for (let i = 0; i < 30 && !visitorIdRef.current; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      vid = visitorIdRef.current;
    }
    if (!vid || !activeWorkspaceId || !selectedArticle) return;
    try {
      const newConv = await createConversation({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId: vid,
        sessionToken: sessionTokenRef.current ?? "",
      });
      if (newConv) {
        setConversationId(newConv._id);
        setView("conversation");
        setSelectedArticleId(null);
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  const handleSelectTour = (tourId: Id<"tours">) => {
    setForcedTourId(tourId);
    setView(previousView);
  };

  const handleBackFromTickets = () => {
    if (view === "ticket-detail") {
      setSelectedTicketId(null);
    }
    setActiveTab("tickets");
    setView("conversation-list");
  };

  const handleSubmitTicket = async (formData: Record<string, unknown>) => {
    if (!visitorId || !activeWorkspaceId || isSubmittingTicket) return;

    const ticketFields = (ticketForm?.fields ?? []) as Array<{ id: string; label?: string }>;
    const getFieldValueByHint = (hints: string[]): string | undefined => {
      const matchingField = ticketFields.find((field) => {
        const fieldKey = `${field.label ?? ""} ${field.id}`.toLowerCase();
        return hints.some((hint) => fieldKey.includes(hint));
      });
      if (!matchingField) return undefined;

      const value = formData[matchingField.id];
      return typeof value === "string" ? value : undefined;
    };

    const subject =
      (formData.subject as string) ||
      (formData.Subject as string) ||
      getFieldValueByHint(["subject", "title"]) ||
      "Support Request";
    const description =
      (formData.description as string) ||
      (formData.Description as string) ||
      getFieldValueByHint(["description", "details", "message"]);

    if (!subject.trim()) {
      alert("Please provide a subject for your ticket");
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const ticketId = await createTicket({
        workspaceId: activeWorkspaceId as Id<"workspaces">,
        visitorId,
        sessionToken: sessionTokenRef.current ?? undefined,
        subject: subject.trim(),
        description: description?.trim(),
        formId: ticketForm?._id,
        formData: normalizeTicketFormData(formData),
      });
      setSelectedTicketId(ticketId);
      setView("ticket-detail");
    } catch (error) {
      console.error("Failed to create ticket:", error);
      alert("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleAddTicketComment = async (content: string) => {
    if (!selectedTicketId || !visitorId) return;
    try {
      await addTicketComment({
        ticketId: selectedTicketId,
        visitorId,
        content,
        sessionToken: sessionTokenRef.current ?? undefined,
      });
    } catch (error) {
      console.error("Failed to add comment:", error);
    }
  };

  const handleSurveyComplete = () => {
    if (displayedSurvey) {
      const surveyId = displayedSurvey._id.toString();
      setCompletedSurveyIds((prev) => {
        const next = new Set(prev);
        next.add(surveyId);
        return next;
      });
    }
    setDisplayedSurvey(null);
    setTooltipTriggerContext((prev) => ({ ...prev, firedEventName: undefined }));
  };

  const handleSurveyDismiss = () => {
    setDisplayedSurvey(null);
    setTooltipTriggerContext((prev) => ({ ...prev, firedEventName: undefined }));
  };

  // Get header title and actions based on active tab
  const getTabHeader = () => {
    switch (activeTab) {
      case "home":
        return { title: "Home", showNew: false };
      case "messages":
        return { title: "Conversations", showNew: true };
      case "help":
        return { title: "Help Center", showNew: false };
      case "tours":
        return { title: "Product Tours", showNew: false };
      case "tasks":
        return { title: "Tasks", showNew: false };
      case "tickets":
        return { title: "My Tickets", showNew: false };
      default:
        return { title: "Home", showNew: false };
    }
  };

  // ── Main tabbed shell ──────────────────────────────────────────────
  const renderMainShell = () => {
    const header = getTabHeader();
    return (
      <div className="opencom-chat">
        <div className="opencom-header">
          <span>{header.title}</span>
          <div className="opencom-header-actions">
            {header.showNew && (
              <button
                onClick={handleNewConversation}
                className="opencom-new-conv"
                title="New conversation"
              >
                <Plus />
              </button>
            )}
            <button onClick={handleCloseWidget} className="opencom-close">
              <X />
            </button>
          </div>
        </div>
        <div className="opencom-tab-content">
          {activeTab === "home" && homeConfig?.enabled && (
            <HomeComponent
              workspaceId={activeWorkspaceId as Id<"workspaces">}
              visitorId={visitorId}
              sessionToken={sessionToken}
              isIdentified={!!userInfo?.userId}
              settings={{
                primaryColor: messengerSettings.primaryColor,
                backgroundColor: messengerSettings.backgroundColor,
                logo: messengerSettings.logo,
                welcomeMessage: messengerSettings.welcomeMessage,
                teamIntroduction: messengerSettings.teamIntroduction,
              }}
              conversations={visitorConversations}
              onStartConversation={handleNewConversation}
              onSelectConversation={handleSelectConversation}
              onSelectArticle={(id) => {
                setSelectedArticleId(id);
                setPreviousView(view);
                setView("article-detail");
              }}
              onSearch={(query) => {
                setArticleSearchQuery(query);
                setActiveTab("help");
              }}
            />
          )}
          {activeTab === "messages" && (
            <ConversationList
              conversations={visitorConversations}
              onSelectConversation={handleSelectConversation}
              onNewConversation={handleNewConversation}
            />
          )}
          {activeTab === "help" && (
            <HelpCenter
              articleSearchQuery={articleSearchQuery}
              onSearchChange={setArticleSearchQuery}
              articleSearchResults={articleSearchResults}
              publishedArticles={publishedArticles}
              onSelectArticle={(id) => {
                setSelectedArticleId(id);
                setView("article-detail");
              }}
            />
          )}
          {activeTab === "tours" && (
            <TourPicker allTours={allTours} onSelectTour={handleSelectTour} />
          )}
          {activeTab === "tasks" && (
            <TasksList
              visitorId={visitorId}
              activeWorkspaceId={activeWorkspaceId}
              sessionToken={sessionToken}
              isValidIdFormat={isValidIdFormat}
              eligibleChecklists={eligibleChecklists}
              onStartTour={handleStartTour}
            />
          )}
          {activeTab === "tickets" && (
            <div className="opencom-tickets-view">
              <TicketsList
                tickets={visitorTickets}
                onSelectTicket={(id) => {
                  setSelectedTicketId(id);
                  setView("ticket-detail");
                }}
              />
              <div className="opencom-ticket-create-btn-container">
                <button
                  className="opencom-ticket-create-btn"
                  onClick={() => {
                    setSelectedTicketId(null);
                    setView("ticket-create");
                  }}
                  type="button"
                >
                  <Plus />
                  <span>New Ticket</span>
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="opencom-bottom-nav">
          {homeConfig?.enabled && (
            <button
              onClick={() => setActiveTab("home")}
              className={`opencom-nav-item ${activeTab === "home" ? "opencom-nav-item-active" : ""}`}
              title="Home"
            >
              <Home />
              <span>Home</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("messages")}
            className={`opencom-nav-item ${activeTab === "messages" ? "opencom-nav-item-active" : ""}`}
            title="Conversations"
          >
            <MessageCircle />
            <span>Messages</span>
            {normalizedUnreadCount > 0 && (
              <span className="opencom-nav-badge opencom-nav-badge-alert">
                {normalizedUnreadCount > 99 ? "99+" : normalizedUnreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("help")}
            className={`opencom-nav-item ${activeTab === "help" ? "opencom-nav-item-active" : ""}`}
            title="Help Center"
          >
            <Search />
            <span>Help</span>
          </button>
          <button
            onClick={() => setActiveTab("tours")}
            className={`opencom-nav-item ${activeTab === "tours" ? "opencom-nav-item-active" : ""}`}
            title="Product Tours"
          >
            <Map />
            <span>Tours</span>
            {(() => {
              const availableCount =
                allTours?.filter((t: { elementSelectors: string[] }) =>
                  checkElementsAvailable(t.elementSelectors)
                ).length || 0;
              return availableCount > 0 ? (
                <span className="opencom-nav-badge">{availableCount}</span>
              ) : null;
            })()}
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`opencom-nav-item ${activeTab === "tasks" ? "opencom-nav-item-active" : ""}`}
            title="Tasks"
          >
            <CheckSquare />
            <span>Tasks</span>
          </button>
          <button
            onClick={() => setActiveTab("tickets")}
            className={`opencom-nav-item ${activeTab === "tickets" ? "opencom-nav-item-active" : ""}`}
            title="My Tickets"
          >
            <Ticket />
            <span>Tickets</span>
          </button>
        </div>
      </div>
    );
  };

  // ── Return ─────────────────────────────────────────────────────────
  return (
    <div className={`opencom-widget ${effectiveTheme === "dark" ? "opencom-theme-dark" : ""}`}>
      {showDebug && debugPanel}
      {view === "launcher" && messengerSettings.showLauncher && (
        <button
          onClick={handleOpenWidget}
          className={`opencom-launcher ${normalizedUnreadCount > 0 ? "opencom-launcher-has-unread" : ""}`}
          data-testid="widget-launcher"
          aria-label={
            normalizedUnreadCount > 0
              ? `Open chat widget, ${normalizedUnreadCount} unread messages`
              : "Open chat widget"
          }
        >
          {messengerSettings.launcherIconUrl ? (
            <img src={messengerSettings.launcherIconUrl} alt="" className="opencom-launcher-icon" />
          ) : (
            <MessageCircle />
          )}
          {normalizedUnreadCount > 0 && (
            <span className="opencom-unread-badge">
              {normalizedUnreadCount > 99 ? "99+" : normalizedUnreadCount}
            </span>
          )}
        </button>
      )}
      {view === "conversation-list" && renderMainShell()}
      {view === "conversation" && conversationId && visitorId && activeWorkspaceId && (
        <ConversationView
          conversationId={conversationId}
          visitorId={visitorId}
          conversationStatus={selectedConversation?.status ?? "open"}
          activeWorkspaceId={activeWorkspaceId}
          sessionId={sessionId}
          sessionTokenRef={sessionTokenRef}
          sessionToken={sessionToken}
          userInfo={userInfo}
          automationSettings={automationSettings}
          officeHoursStatus={
            officeHoursStatus
              ? {
                  isOpen: officeHoursStatus.isOpen,
                  offlineMessage: officeHoursStatus.offlineMessage ?? undefined,
                }
              : undefined
          }
          expectedReplyTime={expectedReplyTime ?? undefined}
          commonIssueButtons={commonIssueButtons}
          onBack={handleBackToList}
          onClose={handleCloseWidget}
          onSelectArticle={(id) => {
            setSelectedArticleId(id);
            setPreviousView(view);
            setView("article-detail");
          }}
        />
      )}
      {view === "article-detail" && (
        <ArticleDetail
          article={selectedArticle ?? undefined}
          onBack={handleBackFromArticle}
          onClose={handleCloseWidget}
          onStartConversation={handleStartConversationFromArticle}
        />
      )}
      {view === "ticket-create" && (
        <TicketCreate
          ticketForm={ticketForm ?? undefined}
          onBack={handleBackFromTickets}
          onClose={handleCloseWidget}
          onSubmit={handleSubmitTicket}
          isSubmitting={isSubmittingTicket}
        />
      )}
      {view === "ticket-detail" && (
        <TicketDetail
          ticket={selectedTicket ?? undefined}
          onBack={handleBackFromTickets}
          onClose={handleCloseWidget}
          onAddComment={handleAddTicketComment}
        />
      )}

      {/* Tour Overlay */}
      {visitorId &&
        activeWorkspaceId &&
        isValidIdFormat &&
        ((availableTours && availableTours.length > 0) || (forcedTourId && allTours)) && (
          <TourOverlay
            workspaceId={activeWorkspaceId as Id<"workspaces">}
            visitorId={visitorId}
            sessionToken={sessionToken}
            availableTours={
              (forcedTourId && allTours
                ? allTours.map((t) => ({
                    tour: t.tour,
                    steps: t.steps,
                    progress:
                      t.tourStatus !== "new" ? { currentStep: 0, status: t.tourStatus } : undefined,
                  }))
                : availableTours) || []
            }
            forcedTourId={forcedTourId}
            allowBlockingTour={allowTourBlocking}
            onBlockingActiveChange={handleTourBlockingActiveChange}
            onTourComplete={handleTourComplete}
            onTourDismiss={handleTourDismiss}
          />
        )}

      {/* Outbound Messages Overlay */}
      {visitorId && activeWorkspaceId && isValidIdFormat && (
        <OutboundOverlay
          workspaceId={activeWorkspaceId as Id<"workspaces">}
          visitorId={visitorId}
          sessionToken={sessionToken}
          sessionId={sessionId}
          currentUrl={window.location.href}
          allowBlockingPost={allowOutboundPostBlocking}
          onBlockingStateChange={handleOutboundBlockingStateChange}
          onStartTour={handleStartTour}
          onOpenMessenger={() => {
            setView("conversation-list");
            setActiveTab("messages");
          }}
          onStartConversation={() => {
            handleNewConversation();
          }}
          onNavigateTab={(tabId) => {
            setActiveTab(tabId as MainTab);
            setView("conversation-list");
          }}
          onOpenArticle={(articleId) => {
            setSelectedArticleId(articleId);
            setView("article-detail");
          }}
        />
      )}

      {/* Tooltip Overlay */}
      {availableTooltips && availableTooltips.length > 0 && (
        <TooltipOverlay tooltips={availableTooltips} />
      )}

      {/* Survey Overlay */}
      {visitorId && activeWorkspaceId && isValidIdFormat && displayedSurvey && (
        <SurveyOverlay
          survey={displayedSurvey}
          visitorId={visitorId}
          sessionId={sessionId}
          sessionToken={sessionToken ?? undefined}
          onComplete={handleSurveyComplete}
          onDismiss={handleSurveyDismiss}
          primaryColor={messengerSettings.primaryColor}
        />
      )}
    </div>
  );
}
