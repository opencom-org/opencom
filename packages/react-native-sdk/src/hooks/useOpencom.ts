import { useEffect, useState, useCallback } from "react";
import { OpencomSDK } from "../OpencomSDK";
import type {
  VisitorState,
  SDKConfig,
  UserIdentification,
  EventProperties,
} from "@opencom/sdk-core";

export function useOpencom() {
  const [isInitialized, setIsInitialized] = useState(OpencomSDK.isInitialized());
  const [visitorState, setVisitorState] = useState<VisitorState | null>(
    isInitialized ? OpencomSDK.getVisitorState() : null
  );

  useEffect(() => {
    // Check initialization status periodically until initialized
    if (!isInitialized) {
      const checkInterval = setInterval(() => {
        if (OpencomSDK.isInitialized()) {
          setIsInitialized(true);
          setVisitorState(OpencomSDK.getVisitorState());
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Subscribe to SDK events
    const unsubscribe = OpencomSDK.addEventListener((event) => {
      if (event.type === "visitor_created" || event.type === "visitor_identified") {
        setVisitorState(OpencomSDK.getVisitorState());
      }
    });

    return unsubscribe;
  }, [isInitialized]);

  const initialize = useCallback(async (config: SDKConfig) => {
    await OpencomSDK.initialize(config);
    setIsInitialized(true);
    setVisitorState(OpencomSDK.getVisitorState());
  }, []);

  const identify = useCallback(async (user: UserIdentification) => {
    await OpencomSDK.identify(user);
    setVisitorState(OpencomSDK.getVisitorState());
  }, []);

  const trackEvent = useCallback(async (name: string, properties?: EventProperties) => {
    await OpencomSDK.trackEvent(name, properties);
  }, []);

  const logout = useCallback(async () => {
    await OpencomSDK.logout();
    setVisitorState(OpencomSDK.getVisitorState());
  }, []);

  const presentMessenger = useCallback(() => {
    OpencomSDK.present();
  }, []);

  const presentHelpCenter = useCallback(() => {
    OpencomSDK.presentHelpCenter();
  }, []);

  const presentCarousel = useCallback((carouselId: string) => {
    OpencomSDK.presentCarousel(carouselId);
  }, []);

  return {
    isInitialized,
    visitorState,
    visitorId: visitorState?.visitorId ?? null,
    initialize,
    identify,
    trackEvent,
    logout,
    presentMessenger,
    presentHelpCenter,
    presentCarousel,
  };
}
