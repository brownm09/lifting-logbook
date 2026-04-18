import { parse } from "csv-parse/sync";
import * as fs from "fs";
// import { runWithErrorHandling } from "@src/api";
// import * as uiUtils from "@src/api";

export const loadCsvFixture = (filename: string): any[][] => {
  const filePath = `${__dirname}/fixtures/${filename}`;
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, { skip_empty_lines: true });
};

/**
 * Either mocks runWithErrorHandling to immediately execute the callback
 * without error handling (true), or lets it use the real implementation
 * (false).
 * @param execCallback boolean - whether to execute the callback immediately
 */
export function setupRunWithErrorHandling(execCallback: boolean) {
  const uiUtils = jest.requireMock("@src/api/ui");
  // const uiUtils = jest.mocked(require("@src/api/ui/uiUtils"));
  (uiUtils.runWithErrorHandling as jest.Mock).mockImplementation((fn) => {
    if (execCallback) return fn();
    // Optionally, call the real implementation if needed
    const { runWithErrorHandling: realRunWithErrorHandling } =
      jest.requireActual("@src/api/ui");
    return realRunWithErrorHandling(fn);
  });
}

export function setupRepositoryMocks() {
  const repositories = jest.requireMock("@src/api/repositories");

  (repositories.CycleDashboardRepository as jest.Mock).mockImplementation(() =>
    jest.fn(),
  );
  (repositories.LiftingProgramSpecRepository as jest.Mock).mockImplementation(
    () => jest.fn(),
  );
  (repositories.TrainingMaxRepository as jest.Mock).mockImplementation(() =>
    jest.fn(),
  );
  (repositories.LiftRecordRepository as jest.Mock).mockImplementation(() =>
    jest.fn(),
  );
  (repositories.WorkoutRepository as jest.Mock).mockImplementation(() =>
    jest.fn(),
  );
  (repositories.SheetRepository as jest.Mock).mockImplementation(() =>
    jest.fn(),
  );
  return repositories;
}

export const gasMock = <T extends object>(): T => {
  const store: any = {};
  const proxy = new Proxy({} as T, {
    get: (_target, prop) => {
      if (!store[prop]) {
        // Create a spy that returns the proxy itself for chaining
        store[prop] = jest.fn().mockReturnValue(proxy);
      }
      return store[prop];
    },
  });
  return proxy;
};

export function printCoreMockCalls() {
  const core = jest.requireMock("@src/core/services/workout");
  console.log("extractLiftRecords calls:", core.extractLiftRecords.mock.calls);
  console.log("updateCycle calls:", core.updateCycle.mock.calls);
  console.log("updateMaxes calls:", core.updateMaxes.mock.calls);
  console.log("createGridV2 calls:", core.createGridV2.mock.calls);
}

export function printApiMockCalls() {
  const {
    SheetRepository,
    CycleDashboardRepository,
    LiftingProgramSpecRepository,
    TrainingMaxRepository,
    LiftRecordRepository,
    WorkoutRepository,
  } = jest.requireMock("@src/api/repositories");
  console.log("SheetRepository calls:", SheetRepository.mock.calls);
  console.log(
    "CycleDashboardRepository calls:",
    CycleDashboardRepository.mock.calls,
  );
  console.log(
    "LiftingProgramSpecRepository calls:",
    LiftingProgramSpecRepository.mock.calls,
  );
  console.log("TrainingMaxRepository calls:", TrainingMaxRepository.mock.calls);
  console.log("LiftRecordRepository calls:", LiftRecordRepository.mock.calls);
  console.log("WorkoutRepository calls:", WorkoutRepository.mock.calls);
}
