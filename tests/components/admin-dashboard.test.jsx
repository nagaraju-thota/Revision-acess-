import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({ api: { getDomains: vi.fn() } }));
vi.mock("../../src/components/Admin/ResultsTab", () => ({ default: () => <div>results-tab</div> }));
vi.mock("../../src/components/Admin/AddQuestionsTab", () => ({ default: ({ domains }) => <div>add-tab {domains.length}</div> }));
vi.mock("../../src/components/Admin/ExamTimerTab", () => ({
  default: ({ onUpdated }) => <button onClick={onUpdated}>timer-tab</button>,
}));
vi.mock("../../src/components/Admin/AddDomainTab", () => ({ default: ({ domains }) => <div>domain-tab {domains.length}</div> }));
vi.mock("../../src/components/Admin/QuestionInsightsTab", () => ({ default: () => <div>insights-tab</div> }));
vi.mock("../../src/components/Admin/ExamScheduleTab", () => ({ default: () => <div>schedule-tab</div> }));

import { api } from "../../src/api/client";
import AdminDashboard from "../../src/components/Admin/AdminDashboard";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

describe("AdminDashboard", () => {
  it("shows the admin name, results tab by default, and signs out", async () => {
    api.getDomains.mockResolvedValue({ domains: [{ id: "a" }] });
    const onLogout = vi.fn();
    renderWithProviders(<AdminDashboard admin={{ name: "Root" }} onLogout={onLogout} />);
    expect(screen.getByText("Admin (Root)")).toBeInTheDocument();
    expect(screen.getByText("results-tab")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Sign out"));
    expect(onLogout).toHaveBeenCalled();
    await act(async () => {});
  });

  it("switches between every tab once domains are loaded", async () => {
    api.getDomains.mockResolvedValue({ domains: [{ id: "a" }, { id: "b" }] });
    renderWithProviders(<AdminDashboard admin={{ name: "Root" }} onLogout={() => {}} />);
    await act(async () => {});
    await userEvent.click(screen.getByText("Add questions"));
    expect(screen.getByText("add-tab 2")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Exam timer"));
    expect(screen.getByText("timer-tab")).toBeInTheDocument();
    await userEvent.click(screen.getByText("timer-tab")); // onUpdated reloads domains
    expect(api.getDomains).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByText("Domains"));
    expect(screen.getByText("domain-tab 2")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Insights"));
    expect(screen.getByText("insights-tab")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Schedule"));
    expect(screen.getByText("schedule-tab")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Results"));
    expect(screen.getByText("results-tab")).toBeInTheDocument();
  });

  it("shows a loading hint on tabs that need domains when none loaded", async () => {
    api.getDomains.mockRejectedValue(new Error("down"));
    renderWithProviders(<AdminDashboard admin={{ name: "Root" }} onLogout={() => {}} />);
    await act(async () => {});
    for (const tab of ["Add questions", "Exam timer", "Insights"]) {
      await userEvent.click(screen.getByText(tab));
      expect(screen.getByText("Loading domains…")).toBeInTheDocument();
    }
  });
});
