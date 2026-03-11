import { MessageSquare, MousePointer, Video } from "lucide-react";
import type { StepType } from "./tourEditorTypes";

type TourStepTypeIconProps = {
  type: StepType;
  className?: string;
};

export function TourStepTypeIcon({
  type,
  className = "h-4 w-4",
}: TourStepTypeIconProps) {
  switch (type) {
    case "pointer":
      return <MousePointer className={className} />;
    case "post":
      return <MessageSquare className={className} />;
    case "video":
      return <Video className={className} />;
  }
}
