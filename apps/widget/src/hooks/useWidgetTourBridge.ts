import { useEffect } from "react";
import { setGetAvailableToursCallback, setStartTourCallback } from "../main";

interface TourInfo {
  id: string;
  name: string;
  description?: string;
  status: "in_progress" | "completed" | "new";
  elementsAvailable: boolean;
}

interface UseWidgetTourBridgeOptions {
  onStartTour: (tourId: string) => void;
  onGetAvailableTours: () => TourInfo[];
}

export function useWidgetTourBridge({
  onStartTour,
  onGetAvailableTours,
}: UseWidgetTourBridgeOptions) {
  useEffect(() => {
    setStartTourCallback(onStartTour);
    setGetAvailableToursCallback(onGetAvailableTours);
    return () => {
      setStartTourCallback(null);
      setGetAvailableToursCallback(null);
    };
  }, [onGetAvailableTours, onStartTour]);
}
