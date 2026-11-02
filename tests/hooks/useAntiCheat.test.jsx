import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { MAX_VIOLATIONS, VIOLATION_TYPE_LABELS, WARNING_SECONDS, useAntiCheat } from "../../src/hooks/useAntiCheat";

function setHidden(value) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
}
function setFullscreenElement(value) {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => value });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  setHidden(false);
  setFullscreenElement(document.body);
});
afterEach(() => {
  vi.useRealTimers();
  setHidden(false);
  setFullscreenElement(null);
});

const nextViolation = () => act(() => vi.advanceTimersByTime(1000));

describe("constants", () => {
  it("exposes limits and labels", () => {
    expect(MAX_VIOLATIONS).toBe(3);
    expect(WARNING_SECONDS).toBe(10);
    expect(VIOLATION_TYPE_LABELS["tab-switch"]).toBe("Tab Switch");
  });
});

describe("useAntiCheat", () => {
  it("records nothing while disabled", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: false }));
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.violationCount).toBe(0);
  });

  it("records a window blur when the document is still visible", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.violationCount).toBe(1);
    expect(result.current.violationLog[0]).toMatchObject({
      type: "window-blur",
      violationNumber: 1,
      action: "Warning Issued",
      timestamp: "2026-01-01T10:00:00.000Z",
    });
    expect(result.current.activeWarning).toEqual({ type: "window-blur", violationNumber: 1, terminated: false });
  });

  it("ignores blur when the document is hidden (tab switch covers it)", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    setHidden(true);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.violationCount).toBe(0);
  });

  it("records a tab switch on visibilitychange when hidden, not when visible", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.violationCount).toBe(0);
    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.violationLog[0].type).toBe("tab-switch");
  });

  it("records a fullscreen exit only when there is no fullscreen element", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.violationCount).toBe(0);
    setFullscreenElement(null);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(result.current.violationLog[0].type).toBe("fullscreen-exit");
  });

  it("collapses events fired together into a single violation", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    setHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.violationCount).toBe(1);
  });

  it("terminates on the third violation and ignores anything after", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    for (let i = 0; i < 3; i++) {
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      nextViolation();
    }
    expect(result.current.violationCount).toBe(3);
    expect(result.current.violationLog[2].action).toBe("Exam Terminated");
    expect(result.current.activeWarning.terminated).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current.violationCount).toBe(3);
  });

  it("dismissWarning clears the active warning", () => {
    const { result } = renderHook(() => useAntiCheat({ enabled: true }));
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    act(() => result.current.dismissWarning());
    expect(result.current.activeWarning).toBeNull();
  });

  it("blocks right-click and copy/cut/paste while enabled, and stops after unmount", () => {
    const { unmount } = renderHook(() => useAntiCheat({ enabled: true }));
    for (const type of ["contextmenu", "copy", "cut", "paste"]) {
      const ev = new Event(type, { cancelable: true });
      document.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    }
    unmount();
    const ev = new Event("copy", { cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
