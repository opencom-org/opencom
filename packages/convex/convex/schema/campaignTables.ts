import { campaignCarouselTables } from "./campaignCarouselTables";
import { campaignEmailTables } from "./campaignEmailTables";
import { campaignPushTables } from "./campaignPushTables";
import { campaignSeriesTables } from "./campaignSeriesTables";
import { campaignSurveyTables } from "./campaignSurveyTables";

export const campaignTables = {
  ...campaignEmailTables,
  ...campaignPushTables,
  ...campaignCarouselTables,
  ...campaignSeriesTables,
  ...campaignSurveyTables,
};
