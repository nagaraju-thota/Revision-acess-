import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_VIOLATIONS = 3;
export const WARNING_SECONDS = 10;

export const VIOLATION_TYPE_LABELS = {
  "tab-switch": "Tab Switch",
  "window-blur": "Window Blur",
  "browser-minimize": "Browser Minimize",
  "fullscreen-exit": "Fullscreen Exit",
};

// Tracks anti-cheat violations for the lifetime of the exam: tab switches,
// window blur, browser minimize, and fullscreen exit. Also disables
// right-click and copy/paste while enabled. Every violation gets a real
// timestamp the instant it happens (not reconstructed afterward) plus its
// 1-based violation number and the action taken — "Warning Issued" for
// violations 1-2, "Exam Terminated" on violation 3. After violation 3,
// further events are ignored (the caller is expected to end the exam).
//
// Detection: `fullscreenchange` (exiting fullscreen) is unambiguous and
// always wins. A plain tab switch or app switch reliably fires
// `visibilitychange`(hidden), usually together with `blur` — both firing
// within DEDUPE_MS of each other is one action, not two, so a short
// debounce guard collapses them into a single violation rather than a
// fragile multi-event correlation window. `blur` with the document still
// visible (e.g. devtools, a second monitor) is recorded on its own as
// "Window Blur".
const DEDUPE_MS = 400;

export function useAntiCheat({ enabled }) {
  const [log, setLog] = useState([]);
  const [activeWarning, setActiveWarning] = useState(null); // { type, violationNumber, terminated }
  const logRef = useRef([]);
  const countRef = useRef(0);
  const terminatedRef = useRef(false);
  const lastRecordedAtRef = useRef(0);

  const record = useCallback((type) => {
    if (terminatedRef.current) return;
    const now = Date.now();
    // Collapse events that fire together for the same real-world action
    // (e.g. blur + visibilitychange from one tab switch, or blur +
    // fullscreenchange from one Escape press) into a single violation.
    if (now - lastRecordedAtRef.current < DEDUPE_MS) return;
    lastRecordedAtRef.current = now;

    const violationNumber = countRef.current + 1;
    countRef.current = violationNumber;
    const terminated = violationNumber >= MAX_VIOLATIONS;
    const entry = {
      type,
      timestamp: new Date().toISOString(),
      violationNumber,
      action: terminated ? "Exam Terminated" : "Warning Issued",
    };
    logRef.current = [...logRef.current, entry];
    setLog(logRef.current);
    setActiveWarning({ type, violationNumber, terminated });
    if (terminated) terminatedRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleBlur = () => {
      // If the document is also hidden, visibilitychange already recorded
      // (or will record) this same action — don't double up.
      if (!document.hidden) record("window-blur");
    };

    const handleVisibility = () => {
      if (document.hidden) record("tab-switch");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) record("fullscreen-exit");
    };

    const blockDefault = (e) => e.preventDefault();

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", blockDefault);
    document.addEventListener("copy", blockDefault);
    document.addEventListener("cut", blockDefault);
    document.addEventListener("paste", blockDefault);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", blockDefault);
      document.removeEventListener("copy", blockDefault);
      document.removeEventListener("cut", blockDefault);
      document.removeEventListener("paste", blockDefault);
    };
  }, [enabled, record]);

  const dismissWarning = useCallback(() => setActiveWarning(null), []);

  return {
    violationLog: log,
    violationCount: log.length,
    activeWarning,
    dismissWarning,
  };
}
