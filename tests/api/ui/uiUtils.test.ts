import { runWithErrorHandling } from "@src/api";

describe("runWithErrorHandling", () => {
  let alertMock: jest.Mock = jest.fn();
  let logMock: jest.Mock = jest.fn();

  beforeAll(() => {
    global.SpreadsheetApp = {
      getUi: () => ({
        alert: alertMock,
        ButtonSet: { OK: "OK" },
      }),
    } as any;
    global.Logger = { log: logMock } as any;
  });

  beforeEach(() => {
    alertMock.mockClear();
    logMock.mockClear();
  });

  it("should execute the function without error", () => {
    const fn = jest.fn();
    runWithErrorHandling(fn);
    expect(fn).toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should show an alert and log error if function throws", () => {
    const error = new Error("fail");
    const fn = jest.fn(() => {
      throw error;
    });
    runWithErrorHandling(fn);
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining("Automation Error"),
      expect.stringContaining("fail"),
      "OK",
    );
    expect(logMock).toHaveBeenCalledWith(
      expect.stringContaining("Error: fail"),
    );
  });
});
