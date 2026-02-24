import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type ReactNode,
} from "react";
import { Modal } from "react-native";
import { ConvexReactClient } from "convex/react";
import { OpencomSDK } from "../OpencomSDK";
import { OpencomLauncher } from "./OpencomLauncher";
import { OpencomOutbound } from "./OpencomOutbound";
import { OpencomSurveyRuntime } from "./OpencomSurveyRuntime";
import { OpencomContextProvider } from "./OpencomProvider";
import { MessengerContent, type MainTab, type MessengerView } from "./MessengerContent";
import type { UserIdentification } from "@opencom/sdk-core";

// ============================================================================
// Types
// ============================================================================

/**
 * User information for identification.
 * Pass this to identify the user in the messenger.
 */
export interface OpencomUser {
  /** User's email address (required for identification) */
  email: string;
  /** Optional display name */
  name?: string;
  /** Optional user ID from your system */
  userId?: string;
  /** Optional custom attributes */
  customAttributes?: Record<string, string | number | boolean>;
}

/**
 * Configuration for the Opencom component.
 */
export interface OpencomConfig {
  /** Your Opencom workspace ID */
  workspaceId: string;
  /** Convex URL for real-time data */
  convexUrl: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Props for the Opencom component.
 */
export interface OpencomProps {
  /** SDK configuration (workspaceId, convexUrl) */
  config: OpencomConfig;
  /** User information for identification (optional - prompts for email if not provided) */
  user?: OpencomUser;
  /** HMAC hash for secure identity verification (optional) */
  userHash?: string;
  /** Enable Messages tab (default: true) */
  enableMessages?: boolean;
  /** Enable Help Center tab (default: true) */
  enableHelpCenter?: boolean;
  /** Enable Tickets tab (default: true) */
  enableTickets?: boolean;
  /** Enable Product Tours (default: true) */
  enableTours?: boolean;
  /** Enable Checklists (default: true) */
  enableChecklists?: boolean;
  /** Enable Outbound Messages (default: true) */
  enableOutbound?: boolean;
  /** Enable Runtime Surveys (default: true) */
  enableSurveys?: boolean;
  /** Enable Carousels (default: true) */
  enableCarousels?: boolean;
  /** Callback when messenger opens */
  onOpen?: () => void;
  /** Callback when messenger closes */
  onClose?: () => void;
  /** Callback when user is identified */
  onUserIdentified?: (user: OpencomUser) => void;
  /** Callback for identity verification errors */
  onIdentityVerificationError?: (error: Error) => void;
  /** Children to render (your app content) */
  children?: ReactNode;
}

/**
 * Ref methods for imperative control of the Opencom component.
 */
export interface OpencomRef {
  /** Open the messenger */
  present: () => void;
  /** Close the messenger */
  dismiss: () => void;
  /** Open the Help Center tab */
  presentHelpCenter: () => void;
  /** Open the Messages tab */
  presentMessages: () => void;
  /** Open the Tickets tab */
  presentTickets: () => void;
  /** Open the Checklists tab */
  presentChecklists: () => void;
  /** Open a specific conversation */
  presentConversation: (conversationId: string) => void;
  /** Open a specific article */
  presentArticle: (articleId: string) => void;
  /** Identify the current user */
  identify: (user: OpencomUser, userHash?: string) => Promise<void>;
  /** Log out the current user */
  logout: () => Promise<void>;
}

// MainTab and MessengerView types are re-exported from MessengerContent

// ============================================================================
// Context for internal state sharing
// ============================================================================

interface OpencomInternalContextValue {
  isInitialized: boolean;
  workspaceId: string;
}

const OpencomInternalContext = React.createContext<OpencomInternalContextValue | null>(null);

// Hook for internal context - reserved for future use
// function useOpencomInternal(): OpencomInternalContextValue {
//   const context = React.useContext(OpencomInternalContext);
//   if (!context) {
//     throw new Error("useOpencomInternal must be used within Opencom");
//   }
//   return context;
// }

// ============================================================================
// Main Opencom Component
// ============================================================================

/**
 * All-in-one Opencom messenger component.
 *
 * @example
 * ```tsx
 * import { Opencom } from '@opencom/react-native-sdk';
 *
 * function App() {
 *   return (
 *     <Opencom
 *       config={{
 *         workspaceId: "your-workspace-id",
 *         convexUrl: "https://your-convex-url.convex.cloud",
 *       }}
 *       user={{ email: "user@example.com", name: "John" }}
 *       enableTickets={true}
 *       enableHelpCenter={true}
 *     >
 *       <YourAppContent />
 *     </Opencom>
 *   );
 * }
 * ```
 */
export const Opencom = forwardRef<OpencomRef, OpencomProps>(function Opencom(
  {
    config,
    user,
    userHash,
    enableMessages = true,
    enableHelpCenter = true,
    enableTours = true,
    enableTickets = true,
    enableChecklists = true,
    enableOutbound = true,
    enableSurveys = true,
    onOpen,
    onClose,
    onUserIdentified,
    onIdentityVerificationError,
    children,
  },
  ref
) {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [convexClient, setConvexClient] = useState<ConvexReactClient | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [messengerView, setMessengerView] = useState<MessengerView>("tabs");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [identifiedUser, setIdentifiedUser] = useState<OpencomUser | null>(user ?? null);

  // Initialize SDK
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!config.workspaceId || !config.convexUrl) {
        console.error("[Opencom] Missing workspaceId or convexUrl in config");
        return;
      }

      try {
        await OpencomSDK.initialize(config);
        const client = new ConvexReactClient(config.convexUrl);

        if (mounted) {
          setConvexClient(client);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("[Opencom] Failed to initialize:", error);
      }
    }

    init();

    return () => {
      mounted = false;
      OpencomSDK.reset().catch(console.error);
    };
  }, [config.workspaceId, config.convexUrl]);

  // Identify user when prop changes
  useEffect(() => {
    if (!isInitialized || !user) return;

    async function identify() {
      try {
        const identification: UserIdentification = {
          email: user!.email,
          name: user!.name,
          userId: user!.userId,
          userHash: userHash,
          customAttributes: user!.customAttributes,
        };

        await OpencomSDK.identify(identification);
        setIdentifiedUser(user!);
        onUserIdentified?.(user!);
      } catch (error) {
        console.error("[Opencom] Failed to identify user:", error);
        if (userHash) {
          onIdentityVerificationError?.(error as Error);
        }
      }
    }

    identify();
  }, [isInitialized, user?.email, user?.name, user?.userId, userHash]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    present: () => {
      setIsOpen(true);
      setMessengerView("tabs");
      onOpen?.();
    },
    dismiss: () => {
      setIsOpen(false);
      setMessengerView("tabs");
      setSelectedConversationId(null);
      setSelectedArticleId(null);
      onClose?.();
    },
    presentHelpCenter: () => {
      setActiveTab("help");
      setMessengerView("tabs");
      setIsOpen(true);
      onOpen?.();
    },
    presentMessages: () => {
      setActiveTab("messages");
      setMessengerView("tabs");
      setIsOpen(true);
      onOpen?.();
    },
    presentTickets: () => {
      setActiveTab("tickets");
      setMessengerView("tabs");
      setIsOpen(true);
      onOpen?.();
    },
    presentChecklists: () => {
      setActiveTab("tasks");
      setMessengerView("tabs");
      setIsOpen(true);
      onOpen?.();
    },
    presentConversation: (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setMessengerView("conversation");
      setIsOpen(true);
      onOpen?.();
    },
    presentArticle: (articleId: string) => {
      setSelectedArticleId(articleId);
      setActiveTab("help");
      setMessengerView("article");
      setIsOpen(true);
      onOpen?.();
    },
    identify: async (newUser: OpencomUser, _userHash?: string) => {
      const identification: UserIdentification = {
        email: newUser.email,
        name: newUser.name,
        userId: newUser.userId,
        userHash: _userHash,
        customAttributes: newUser.customAttributes,
      };
      await OpencomSDK.identify(identification);
      setIdentifiedUser(newUser);
      onUserIdentified?.(newUser);
    },
    logout: async () => {
      await OpencomSDK.logout();
      setIdentifiedUser(null);
    },
  }));

  // Handlers
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setMessengerView("tabs");
    setSelectedConversationId(null);
    setSelectedArticleId(null);
    onClose?.();
  }, [onClose]);

  // Determine available tabs (home is handled dynamically in MessengerContent based on homeConfig)
  const availableTabs: MainTab[] = ["home"]; // Home always included, visibility controlled by homeConfig
  if (enableMessages) availableTabs.push("messages");
  if (enableHelpCenter) availableTabs.push("help");
  if (enableTours) availableTabs.push("tours");
  if (enableChecklists) availableTabs.push("tasks");
  if (enableTickets) availableTabs.push("tickets");

  // Don't render until initialized
  if (!isInitialized || !convexClient) {
    return <>{children}</>;
  }

  return (
    <OpencomInternalContext.Provider value={{ isInitialized, workspaceId: config.workspaceId }}>
      <OpencomContextProvider
        value={{ isInitialized, workspaceId: config.workspaceId }}
        client={convexClient}
      >
        {/* App content */}
        {children}

        {/* Launcher button */}
        {!isOpen && <OpencomLauncher onPress={handleOpen} testID="opencom-launcher" />}

        {/* Outbound messages */}
        {!isOpen && enableOutbound && <OpencomOutbound onOpenMessenger={handleOpen} />}

        {!isOpen && enableSurveys && <OpencomSurveyRuntime />}

        {/* Messenger modal - needs its own provider since Modal creates separate React tree */}
        <Modal visible={isOpen} animationType="slide" onRequestClose={handleClose}>
          <OpencomContextProvider
            value={{ isInitialized, workspaceId: config.workspaceId }}
            client={convexClient}
          >
            <MessengerContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              messengerView={messengerView}
              setMessengerView={setMessengerView}
              selectedConversationId={selectedConversationId}
              setSelectedConversationId={setSelectedConversationId}
              selectedArticleId={selectedArticleId}
              setSelectedArticleId={setSelectedArticleId}
              availableTabs={availableTabs}
              onClose={handleClose}
              enableMessages={enableMessages}
              enableHelpCenter={enableHelpCenter}
              enableTickets={enableTickets}
              enableChecklists={enableChecklists}
              workspaceId={config.workspaceId}
              visitorId={null}
              isIdentified={!!identifiedUser}
            />
          </OpencomContextProvider>
        </Modal>
      </OpencomContextProvider>
    </OpencomInternalContext.Provider>
  );
});

// MessengerContent component is now in ./MessengerContent.tsx

export default Opencom;
