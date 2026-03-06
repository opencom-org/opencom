import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { MessageCircle, Plus } from "./icons";
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
import { type UserIdentification } from "./main";
import { TourOverlay } from "./TourOverlay";
import { OutboundOverlay } from "./OutboundOverlay";
import { TooltipOverlay } from "./TooltipOverlay";
import { SurveyOverlay } from "./SurveyOverlay";
import { useWidgetSession } from "./hooks/useWidgetSession";
import { useWidgetSettings } from "./hooks/useWidgetSettings";
import { useEventTracking } from "./hooks/useEventTracking";
import { useNavigationTracking } from "./hooks/useNavigationTracking";
import { useWidgetShellValidation } from "./hooks/useWidgetShellValidation";
import { useBlockingExperienceArbitration } from "./hooks/useBlockingExperienceArbitration";
import { useWidgetTabVisibility, type MainTab, type TabConfig } from "./hooks/useWidgetTabVisibility";
import { useWidgetUnreadCues } from "./hooks/useWidgetUnreadCues";
import { useWidgetTourBridge } from "./hooks/useWidgetTourBridge";
import { useWidgetConversationFlow } from "./hooks/useWidgetConversationFlow";
import { useWidgetArticleNavigation } from "./hooks/useWidgetArticleNavigation";
import { useWidgetTicketFlow } from "./hooks/useWidgetTicketFlow";
import { checkElementsAvailable } from "./utils/dom";
import { selectSurveyForDelivery, type SurveyDeliveryCandidate } from "@opencom/sdk-core";
import {
  getWidgetTabHeader,
  resolveWidgetActiveTab,
} from "./widgetShell/helpers";
import type { WidgetProps, WidgetView } from "./widgetShell/types";
import { WidgetMainShell } from "./widgetShell/WidgetMainShell";

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
  const [showDebug, setShowDebug] = useState(false);
  const [debugWorkspaceId, setDebugWorkspaceId] = useState(_workspaceId || "");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(_workspaceId);
  const [forcedTourId, setForcedTourId] = useState<Id<"tours"> | null>(null);
  const [sessionShownSurveyIds, setSessionShownSurveyIds] = useState<Set<string>>(new Set());
  const [completedSurveyIds, setCompletedSurveyIds] = useState<Set<string>>(new Set());
  const [surveyEligibilityUnavailable, setSurveyEligibilityUnavailable] = useState(false);
  const [tourBlockingActive, setTourBlockingActive] = useState(false);
  const [outboundBlockingState, setOutboundBlockingState] = useState<{
    hasPendingPost: boolean;
    hasActivePost: boolean;
  }>({
    hasPendingPost: false,
    hasActivePost: false,
  });
  const locationFetchedRef = useRef(false);

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

  const {
    isValidIdFormat,
    workspaceValidation,
    workspaceError,
    originError,
  } = useWidgetShellValidation(activeWorkspaceId);

  // Shell ownership boundaries:
  // - `useWidgetShellValidation` handles workspace + origin gating.
  // - `useBlockingExperienceArbitration` handles blocker priority and release.
  // - `useWidgetTabVisibility` owns tab visibility/fallback semantics.
  // - `useWidgetUnreadCues` owns unread cue side effects and suppression rules.
  // - `useWidgetTourBridge` owns host callback registration/update/cleanup.

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
  const {
    articleSearchQuery,
    setArticleSearchQuery,
    selectedArticleId,
    clearSelectedArticle,
    selectedHelpCollectionKey,
    setSelectedHelpCollectionKey,
    isCollapsingLargeArticle,
    isLargeArticleView,
    clearArticlePresentation,
    openArticleDetail,
    handleBackFromArticle,
    handleToggleArticleLargeScreen,
  } = useWidgetArticleNavigation({
    view,
    onViewChange: setView,
    onTabChange: setActiveTab,
  });

  // ── Queries ────────────────────────────────────────────────────────
  const visitorConversations = useQuery(
    api.conversations.listByVisitor,
    isValidIdFormat && visitorId && sessionToken
      ? { visitorId, sessionToken, workspaceId: activeWorkspaceId as Id<"workspaces"> }
      : "skip"
  );

  const {
    conversationId,
    selectedConversation,
    openConversation,
    clearConversationSelection,
    resetDraftConversationState,
    openFreshConversation,
    handleNewConversation,
    handleSelectConversation,
    handleBackToList,
    syncConversationReadState,
  } = useWidgetConversationFlow({
    activeWorkspaceId,
    visitorId,
    visitorIdRef,
    sessionTokenRef,
    visitorConversations,
    onViewChange: setView,
  });

  const {
    visitorTickets,
    selectedTicket,
    ticketForm,
    isSubmittingTicket,
    ticketErrorFeedback,
    handleBackFromTickets,
    openTicketCreate,
    handleSelectTicket,
    handleSubmitTicket,
    handleAddTicketComment,
  } = useWidgetTicketFlow({
    activeWorkspaceId,
    isValidIdFormat,
    visitorId,
    sessionToken,
    sessionTokenRef,
    onViewChange: setView,
    onTabChange: setActiveTab,
  });

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
  const publishedCollections = useQuery(
    api.collections.listHierarchy,
    isValidIdFormat ? { workspaceId: activeWorkspaceId as Id<"workspaces"> } : "skip"
  );

  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return undefined;

    const fromSearch = articleSearchResults?.find((article) => article._id === selectedArticleId);
    if (fromSearch) return fromSearch;

    return publishedArticles?.find((article) => article._id === selectedArticleId);
  }, [selectedArticleId, articleSearchResults, publishedArticles]);

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

  /*
   * TODO(2026-02-25): Add dedicated scheduler E2E coverage by Friday, 2026-02-27.
   * Scope:
   * - Seed tour + outbound post + large survey at the same time and assert order:
   *   tour -> outbound post -> large survey.
   * - Assert deferred experiences are not tracked as "shown" until visible.
   * - Assert queue release behavior for each blocker exit path:
   *   tour complete, tour dismiss, outbound dismiss, survey complete, survey dismiss.
   * - Assert forced tours preempt queued blockers and queued blockers resume after tour exit.
   * - Run the same assertions in compact/mobile viewport to catch stacking and interaction regressions.
   */
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
  const {
    activeBlockingExperience,
    setActiveBlockingExperience,
    allowTourBlocking,
    allowOutboundPostBlocking,
    allowLargeSurveyBlocking,
    hasAnyPendingBlockingCandidate,
  } = useBlockingExperienceArbitration({
    hasTourBlockingCandidate,
    hasOutboundPostBlockingCandidate,
    hasOutboundPostBlockingActive,
    hasLargeSurveyBlockingCandidate,
    hasLargeSurveyBlockingActive,
    tourBlockingActive,
  });

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

  const handleOpenConversationFromCue = useCallback(
    (id: Id<"conversations">) => {
      setActiveTab("messages");
      openConversation(id);
    },
    [openConversation]
  );

  const { resetUnreadSnapshot } = useWidgetUnreadCues({
    conversationId,
    view,
    visitorConversations,
    onOpenConversation: handleOpenConversationFromCue,
  });

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
    setSelectedHelpCollectionKey(null);
    clearArticlePresentation();
  }, [sessionId, visitorId, activeWorkspaceId, clearArticlePresentation, setActiveBlockingExperience, setSelectedHelpCollectionKey]);

  useEffect(() => {
    resetUnreadSnapshot();
    resetDraftConversationState();
  }, [sessionId, visitorId, activeWorkspaceId, resetDraftConversationState, resetUnreadSnapshot]);

  // Handle debug workspace ID update
  const handleDebugWorkspaceUpdate = () => {
    setActiveWorkspaceId(debugWorkspaceId);
    // Reset conversation state when workspace changes
    clearConversationSelection();
    setVisitorId(null);
  };

  // (identify, trackEvent, and navigation tracking are now in extracted hooks)

  // Tour API callbacks
  const handleStartTour = useCallback((tourId: string) => {
    setView("launcher");
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

  useWidgetTourBridge({
    onStartTour: handleStartTour,
    onGetAvailableTours: handleGetAvailableTours,
  });

  const handleTourComplete = useCallback(() => {
    setForcedTourId(null);
  }, []);

  const handleTourDismiss = useCallback(() => {
    setForcedTourId(null);
  }, []);

  const handleTourBlockingActiveChange = useCallback((isActive: boolean) => {
    setTourBlockingActive(isActive);
  }, []);

  useEffect(() => {
    if (tourBlockingActive && view !== "launcher") {
      setView("launcher");
    }
  }, [tourBlockingActive, view]);

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
  const isIdentifiedVisitor = !!(userInfo?.userId || userInfo?.email);
  const homeConfig = useHomeConfig(
    isValidIdFormat ? (activeWorkspaceId as Id<"workspaces">) : undefined,
    isIdentifiedVisitor
  );

  const { fallbackTab, isTabVisible } = useWidgetTabVisibility({
    activeTab,
    setActiveTab,
    homeConfig: homeConfig as { enabled?: boolean; defaultSpace?: "home" | "messages" | "help"; tabs?: TabConfig[] },
  });

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

  const handleOpenWidget = () => {
    // Always open to conversation list first
    setView("conversation-list");
  };

  const handleCloseWidget = () => {
    if (view === "conversation" && conversationId) {
      syncConversationReadState(conversationId);
    }
    clearArticlePresentation();
    setView("launcher");
  };

  const handleStartConversationFromArticle = async () => {
    if (!selectedArticle) {
      return;
    }

    const createdConversationId = await openFreshConversation();
    if (createdConversationId) {
      clearSelectedArticle();
      clearArticlePresentation();
    }
  };

  const handleSelectTour = (tourId: Id<"tours">) => {
    handleStartTour(tourId);
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

  const availableTourCount = useMemo(
    () =>
      allTours?.filter((tour: { elementSelectors: string[] }) =>
        checkElementsAvailable(tour.elementSelectors)
      ).length || 0,
    [allTours]
  );

  // ── Main tabbed shell ──────────────────────────────────────────────
  const renderMainShell = () => {
    const resolvedActiveTab = resolveWidgetActiveTab(activeTab, fallbackTab, isTabVisible);
    const header = getWidgetTabHeader(resolvedActiveTab);

    return (
      <WidgetMainShell
        title={header.title}
        showNewConversationAction={header.showNew}
        resolvedActiveTab={resolvedActiveTab}
        isTabVisible={isTabVisible}
        onNewConversation={handleNewConversation}
        onCloseWidget={handleCloseWidget}
        onTabChange={setActiveTab}
        normalizedUnreadCount={normalizedUnreadCount}
        availableTourCount={availableTourCount}
      >
        {resolvedActiveTab === "home" && homeConfig?.enabled && (
          <HomeComponent
            workspaceId={activeWorkspaceId as Id<"workspaces">}
            visitorId={visitorId}
            sessionToken={sessionToken}
            isIdentified={isIdentifiedVisitor}
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
            onSelectArticle={openArticleDetail}
            onSearch={(query) => {
              setArticleSearchQuery(query);
              setActiveTab("help");
            }}
          />
        )}
        {resolvedActiveTab === "messages" && (
          <ConversationList
            conversations={visitorConversations}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        )}
        {resolvedActiveTab === "help" && (
          <HelpCenter
            articleSearchQuery={articleSearchQuery}
            onSearchChange={setArticleSearchQuery}
            articleSearchResults={articleSearchResults}
            publishedArticles={publishedArticles}
            collections={publishedCollections}
            selectedCollectionKey={selectedHelpCollectionKey}
            onSelectedCollectionKeyChange={setSelectedHelpCollectionKey}
            onSelectArticle={openArticleDetail}
          />
        )}
        {resolvedActiveTab === "tours" && <TourPicker allTours={allTours} onSelectTour={handleSelectTour} />}
        {resolvedActiveTab === "tasks" && (
          <TasksList
            visitorId={visitorId}
            activeWorkspaceId={activeWorkspaceId}
            sessionToken={sessionToken}
            isValidIdFormat={isValidIdFormat}
            eligibleChecklists={eligibleChecklists}
            onStartTour={handleStartTour}
          />
        )}
        {resolvedActiveTab === "tickets" && (
          <div className="opencom-tickets-view">
            <TicketsList tickets={visitorTickets} onSelectTicket={handleSelectTicket} />
            <div className="opencom-ticket-create-btn-container">
              <button
                className="opencom-ticket-create-btn"
                onClick={openTicketCreate}
                type="button"
              >
                <Plus />
                <span>New Ticket</span>
              </button>
            </div>
          </div>
        )}
      </WidgetMainShell>
    );
  };

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

  if (originError) {
    console.error("[Opencom Widget] Origin validation failed:", originError);
    return null;
  }

  // ── Return ─────────────────────────────────────────────────────────
  return (
    <div
      className={`opencom-widget ${effectiveTheme === "dark" ? "opencom-theme-dark" : ""} ${isLargeArticleView ? "opencom-widget-article-large" : ""}`}
    >
      {isLargeArticleView && <div className="opencom-widget-article-backdrop" aria-hidden="true" />}
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
          onSelectArticle={openArticleDetail}
        />
      )}
      {view === "article-detail" && (
        <ArticleDetail
          article={selectedArticle ?? undefined}
          isLargeScreen={isLargeArticleView}
          isCollapsingLargeScreen={isCollapsingLargeArticle}
          onToggleLargeScreen={handleToggleArticleLargeScreen}
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
          errorFeedback={ticketErrorFeedback}
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
            const requestedTab = tabId as MainTab;
            setActiveTab(isTabVisible(requestedTab) ? requestedTab : fallbackTab);
            setView("conversation-list");
          }}
          onOpenArticle={openArticleDetail}
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
