import type { Id } from "@opencom/convex/dataModel";
import { Map } from "../icons";
import { checkElementsAvailable } from "../utils/dom";

interface TourData {
  tour: { _id: Id<"tours">; name: string; description?: string };
  elementSelectors: string[];
  tourStatus: string;
}

interface TourPickerProps {
  allTours: TourData[] | undefined;
  onSelectTour: (tourId: Id<"tours">) => void;
}

export function TourPicker({ allTours, onSelectTour }: TourPickerProps) {
  return (
    <div className="opencom-tour-picker">
      {allTours && allTours.length > 0 ? (
        allTours.map((tourData) => {
          const elementsAvailable = checkElementsAvailable(tourData.elementSelectors);
          return (
            <button
              key={tourData.tour._id}
              className={`opencom-tour-item ${!elementsAvailable ? "opencom-tour-item-unavailable" : ""}`}
              onClick={() => elementsAvailable && onSelectTour(tourData.tour._id)}
              disabled={!elementsAvailable}
            >
              <div className="opencom-tour-item-icon">
                <Map />
              </div>
              <div className="opencom-tour-item-content">
                <span className="opencom-tour-item-name">{tourData.tour.name}</span>
                {tourData.tour.description && (
                  <span className="opencom-tour-item-description">{tourData.tour.description}</span>
                )}
                <div className="opencom-tour-item-meta">
                  <span
                    className={`opencom-tour-status opencom-tour-status-${tourData.tourStatus}`}
                  >
                    {tourData.tourStatus === "completed"
                      ? "Completed"
                      : tourData.tourStatus === "in_progress"
                        ? "In Progress"
                        : "New"}
                  </span>
                  {!elementsAvailable && (
                    <span className="opencom-tour-unavailable-text">
                      Not available on this page
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })
      ) : (
        <div className="opencom-empty-list">
          <div className="opencom-empty-icon">
            <Map />
          </div>
          <h3>No Tours Available</h3>
          <p>There are no product tours available at this time.</p>
        </div>
      )}
    </div>
  );
}
