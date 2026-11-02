import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({
  api: { getDomains: vi.fn(), updateDomainDuration: vi.fn() },
}));

import { api } from "../../src/api/client";
import AntiCheatReport from "../../src/components/Admin/AntiCheatReport";
import ExamTimerTab from "../../src/components/Admin/ExamTimerTab";
import DomainSelect from "../../src/components/Domains/DomainSelect";
import ExamIntro from "../../src/components/Exam/ExamIntro";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

describe("DomainSelect", () => {
  const domains = [
    { id: "frontend", name: "Frontend", description: "UI", questionCount: 5, duration: 1800 },
    { id: "custom", name: "Custom", description: "Other", questionCount: 1, duration: 60 },
  ];

  it("lists domains with question count and minutes, and selects one", async () => {
    api.getDomains.mockResolvedValue({ domains });
    const onSelect = vi.fn();
    renderWithProviders(<DomainSelect student={{ name: "Asha" }} onLogout={() => {}} onSelect={onSelect} selecting={false} />);
    expect(screen.getByText("Welcome, Asha")).toBeInTheDocument();
    expect(await screen.findByText("5 questions · 30 min")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Frontend"));
    expect(onSelect).toHaveBeenCalledWith(domains[0]);
  });

  it("disables cards while a selection is in flight", async () => {
    api.getDomains.mockResolvedValue({ domains });
    const { rerender } = renderWithProviders(<DomainSelect student={{ name: "A" }} onLogout={() => {}} onSelect={() => {}} selecting />);
    expect((await screen.findByText("Custom")).closest("button")).toBeDisabled();
    expect(rerender).toBeDefined();
  });

  it("shows a toast when loading fails and supports sign out", async () => {
    api.getDomains.mockRejectedValue(new Error("Network down"));
    const onLogout = vi.fn();
    renderWithProviders(<DomainSelect student={{ name: "A" }} onLogout={onLogout} onSelect={() => {}} />);
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Sign out"));
    expect(onLogout).toHaveBeenCalled();
  });
});

describe("ExamIntro", () => {
  const exam = { title: "Frontend Exam", duration: 900, questions: [{}, {}, {}] };

  it("shows exam details and starts after requesting fullscreen", async () => {
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue();
    const onStart = vi.fn();
    renderWithProviders(<ExamIntro exam={exam} onStart={onStart} onBack={() => {}} />);
    expect(screen.getByText("Frontend Exam")).toBeInTheDocument();
    expect(screen.getByText(/3 questions, 15 minutes/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Start exam"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
  });

  it("uses singular wording for a one-question exam and still starts if fullscreen is refused", async () => {
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    const onStart = vi.fn();
    const onBack = vi.fn();
    renderWithProviders(<ExamIntro exam={{ ...exam, questions: [{}] }} onStart={onStart} onBack={onBack} />);
    expect(screen.getByText(/1 question, 15 minutes/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Start exam"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    await userEvent.click(screen.getByText("Choose a different domain"));
    expect(onBack).toHaveBeenCalled();
  });

  it("starts even when the browser has no fullscreen API", async () => {
    document.documentElement.requestFullscreen = undefined;
    const onStart = vi.fn();
    renderWithProviders(<ExamIntro exam={exam} onStart={onStart} onBack={() => {}} />);
    await userEvent.click(screen.getByText("Start exam"));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
  });
});

describe("AntiCheatReport", () => {
  it("shows the clean state by default", () => {
    renderWithProviders(<AntiCheatReport />);
    expect(screen.getByText("0 / 3 violations")).toBeInTheDocument();
    expect(screen.getByText(/No violations recorded/)).toBeInTheDocument();
  });

  it("lists violations and the termination banner", () => {
    renderWithProviders(
      <AntiCheatReport
        violationCount={3}
        terminated
        violations={[
          { type: "tab-switch", timestamp: "2026-01-01T10:00:00Z", violationNumber: 1, action: "Warning Issued" },
          { type: "mystery", timestamp: "2026-01-01T10:01:00Z", violationNumber: 5, action: "Warning Issued" },
          { type: "fullscreen-exit", timestamp: "2026-01-01T10:02:00Z", violationNumber: 3, action: "Exam Terminated" },
        ]}
      />
    );
    expect(screen.getByText("3 / 3 violations")).toBeInTheDocument();
    expect(screen.getByText(/automatically terminated/)).toBeInTheDocument();
    expect(screen.getByText("Tab Switch")).toBeInTheDocument();
    expect(screen.getByText("mystery")).toBeInTheDocument();
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Exam Terminated")).toBeInTheDocument();
  });

  it("falls back to the raw value for an unparseable timestamp", () => {
    renderWithProviders(<AntiCheatReport violationCount={1} violations={[{ type: "tab-switch", timestamp: "not-a-date", violationNumber: 1, action: "Warning Issued" }]} />);
    expect(screen.getByText("Invalid Date")).toBeInTheDocument();
  });
});

describe("ExamTimerTab", () => {
  const domains = [
    { id: "a", name: "Alpha", questionCount: 3, duration: 600 },
    { id: "b", name: "Beta", questionCount: 1, duration: 1200 },
  ];

  it("saves a new duration in seconds", async () => {
    api.updateDomainDuration.mockResolvedValue({});
    const onUpdated = vi.fn();
    renderWithProviders(<ExamTimerTab domains={domains} onUpdated={onUpdated} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(10);
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "15");
    await userEvent.click(screen.getAllByText("Save")[0]);
    await waitFor(() => expect(api.updateDomainDuration).toHaveBeenCalledWith("a", 900));
    expect(await screen.findByText("Timer updated to 15 min for Alpha")).toBeInTheDocument();
    expect(onUpdated).toHaveBeenCalled();
  });

  it("rejects empty / non-positive values", async () => {
    renderWithProviders(<ExamTimerTab domains={domains} />);
    const inputs = screen.getAllByRole("spinbutton");
    await userEvent.clear(inputs[1]);
    await userEvent.type(inputs[1], "0");
    await userEvent.click(screen.getAllByText("Save")[1]);
    expect(screen.getByText(/greater than 0/)).toBeInTheDocument();
    expect(api.updateDomainDuration).not.toHaveBeenCalled();
  });

  it("shows API errors", async () => {
    api.updateDomainDuration.mockRejectedValue(new Error("Server said no"));
    renderWithProviders(<ExamTimerTab domains={domains} />);
    await userEvent.click(screen.getAllByText("Save")[0]);
    expect((await screen.findAllByText("Server said no")).length).toBeGreaterThan(0);
    await act(async () => {});
  });
});
