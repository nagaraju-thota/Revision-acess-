import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("../../src/utils/brandTheme", () => ({
  loadImageFromUrl: vi.fn(),
  extractDominantHsl: vi.fn(() => ({ h: 200, s: 60, l: 50 })),
  buildShadeRamp: vi.fn(() => ({ 50: "1 2 3", 600: "4 5 6" })),
}));

import { BrandProvider, useBrand } from "../../src/context/BrandContext";
import { ThemeProvider, useTheme } from "../../src/context/ThemeContext";
import { ToastProvider, useToast } from "../../src/context/ToastContext";
import { loadImageFromUrl } from "../../src/utils/brandTheme";

describe("ThemeContext", () => {
  function Probe() {
    const { theme, toggleTheme } = useTheme();
    return <button onClick={toggleTheme}>{theme}</button>;
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("defaults to light and persists the choice", async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("light");
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("uses a saved theme", () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("follows the OS preference when nothing is saved", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole("button")).toHaveTextContent("dark");
  });

  it("throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});

describe("ToastContext", () => {
  function Probe() {
    const toast = useToast();
    return (
      <>
        <button onClick={() => toast.success("saved")}>success</button>
        <button onClick={() => toast.error("boom", 0)}>error</button>
        <button onClick={() => toast.info("fyi")}>info</button>
        <button onClick={() => toast.show("custom", "unknown")}>show</button>
      </>
    );
  }

  it("shows toasts, dismisses them manually and auto-dismisses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ToastProvider><Probe /></ToastProvider>);

    await user.click(screen.getByText("success"));
    expect(screen.getByText("saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText("saved")).not.toBeInTheDocument();

    await user.click(screen.getByText("error"));
    expect(screen.getByText("boom")).toBeInTheDocument(); // duration 0 = sticky
    await user.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("boom")).not.toBeInTheDocument();

    await user.click(screen.getByText("info"));
    await user.click(screen.getByText("show"));
    expect(screen.getByText("fyi")).toBeInTheDocument();
    expect(screen.getByText("custom")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe("BrandContext", () => {
  function Probe() {
    const { logoSrc, companyName, paletteVersion } = useBrand();
    return <p>{`${logoSrc}|${companyName}|${paletteVersion}`}</p>;
  }

  beforeEach(() => {
    document.head.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove());
    document.documentElement.removeAttribute("style");
  });

  it("applies the extracted palette and bumps paletteVersion", async () => {
    loadImageFromUrl.mockResolvedValue({});
    render(<BrandProvider><Probe /></BrandProvider>);
    await waitFor(() => expect(screen.getByText(/\|1$/)).toBeInTheDocument());
    expect(screen.getByText("/exam_logo.png|AssessmentPortal|1")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue("--color-brand-600")).toBe("4 5 6");
  });

  it("creates the favicon link and reuses it afterwards", async () => {
    loadImageFromUrl.mockResolvedValue({});
    const { unmount } = render(<BrandProvider><Probe /></BrandProvider>);
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="icon"]').getAttribute("href")).toBe("/exam_logo.png");
    unmount();
    render(<BrandProvider><Probe /></BrandProvider>);
    expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(1);
  });

  it("keeps the default palette when the logo can't be loaded", async () => {
    loadImageFromUrl.mockRejectedValue(new Error("missing"));
    render(<BrandProvider><Probe /></BrandProvider>);
    await act(async () => {});
    expect(screen.getByText(/\|0$/)).toBeInTheDocument();
  });

  it("throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/BrandProvider/);
    spy.mockRestore();
  });
});
