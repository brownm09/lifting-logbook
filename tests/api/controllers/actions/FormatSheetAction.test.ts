jest.mock("@src/api/ui", () => ({
  ...jest.requireActual("@src/api/ui"),
  cropSheet: jest.fn(),
  runWithErrorHandling: jest.fn(),
}));

import { FormatSheetAction } from "@src/api/controllers";
import * as ui from "@src/api/ui";
import { createSheetMock, createSpreadsheetMock } from "@tests/gasMocks";
import { setupRunWithErrorHandling } from "@tests/testUtils";

describe("FormatSheetAction", () => {
  const mockSheet = createSheetMock("RPT_2026_Cycle_1_20260101", [
    ["Header"],
    ["Data"],
  ]);
  // Add getLastColumn as a jest mock
  const ssMock = createSpreadsheetMock([mockSheet]);
  let toastSpy: jest.SpyInstance;

  beforeEach(() => {
    global.SpreadsheetApp = {
      getActiveSpreadsheet: jest.fn(() => ssMock),
      getActiveSheet: jest.fn().mockReturnValue(mockSheet as any),
    } as any;
    toastSpy = jest.spyOn(ssMock, "toast").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe("run", () => {
    it("should format the sheet", () => {
      setupRunWithErrorHandling(true);
      new FormatSheetAction().run();
      expect(ui.cropSheet).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Sheet "RPT_2026_Cycle_1_20260101" formatted successfully.',
        ),
        "Success",
      );
    });
  });
});
