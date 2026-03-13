import { operationsAiTables } from "./operationsAiTables";
import { operationsMessengerTables } from "./operationsMessengerTables";
import { operationsReportingTables } from "./operationsReportingTables";
import { operationsWorkflowTables } from "./operationsWorkflowTables";

export const operationsTables = {
  ...operationsAiTables,
  ...operationsWorkflowTables,
  ...operationsReportingTables,
  ...operationsMessengerTables,
};
