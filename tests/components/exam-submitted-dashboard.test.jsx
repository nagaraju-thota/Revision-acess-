import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({
  api: { getDomains: vi.fn(), getMyResults: vi.fn(), getMyResultDetail: vi.fn() },
}));
vi.mock("../../src/utils/pdfReport", () => ({ downloadResultPdf: vi.fn() }));

import { api } from "../../src/api/client";
import StudentDashboard from "../../src/components/Dashboard/StudentDashboard";
import ExamSubmitted from "../../src/components/Exam/ExamSubmitted";
import { downloadResultPdf } from "../../src/utils/pdfReport";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

describe("ExamSubmitted", () => {
  const result = { score: 3, total: 5 };

  it("shows the plain confirmation when there is no score", async () => {
    const onDone = vi.fn();
    renderWithProviders(<ExamSubmitted reason="manual" onDone={onDone} />);
    expect(screen.getByText("Exam submitted")).toBeInTheDocument();
    expect(screen.queryByText(/Download my results/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Back to sign in"));
    expect(onDone).toHaveBeenCalled();
  });

  it("shows the score, offers a PDF and the dashboard link", async () => {
    const onViewDashboard = vi.fn();
    renderWithProviders(<ExamSubmitted reason="timeout" result={result} onDone={() => {}} onViewDashboard={onViewDashboard} />);
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText(/Here's how you did/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Download my results (PDF)"));
    expect(downloadResultPdf).toHaveBeenCalledWith(result);
    await userEvent.click(screen.getByText(/View my dashboard/));
    expect(onViewDashboard).toHaveBeenCalled();
  });

  it("hides the dashboard link when no handler is passed", () => {
    renderWithProviders(<ExamSubmitted reason="manual" result={result} onDone={() => {}} />);
    expect(screen.queryByText(/View my dashboard/)).not.toBeInTheDocument();
  });

  it("toasts when PDF generation throws", async () => {
    downloadResultPdf.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    renderWithProviders(<ExamSubmitted reason="manual" result={result} onDone={() => {}} />);
    await userEvent.click(screen.getByText("Download my results (PDF)"));
    expect(await screen.findByText(/Couldn't generate the PDF/)).toBeInTheDocument();
  });

  it("explains violation terminations (with and without a count)", () => {
    const { unmount } = renderWithProviders(<ExamSubmitted reason="violations" violationCount={3} onDone={() => {}} />);
    expect(screen.getByText("Exam terminated — repeated violations")).toBeInTheDocument();
    expect(screen.getByText(/reaching 3 anti-cheating violations/)).toBeInTheDocument();
    unmount();
    renderWithProviders(<ExamSubmitted reason="violations" onDone={() => {}} />);
    expect(screen.getByText(/reaching 3 anti-cheating/)).toBeInTheDocument();
  });

  it("explains leaving the tab", () => {
    renderWithProviders(<ExamSubmitted reason="left-tab" onDone={() => {}} />);
    expect(screen.getByText("Exam ended — left the tab")).toBeInTheDocument();
  });
});

describe("StudentDashboard", () => {
  const student = { id: "S1", name: "Asha Rao" };
  const domains = [
    { id: "frontend", name: "Frontend", description: "UI", questionCount: 5, duration: 1800 },
    { id: "custom", name: "Custom", description: "Other", questionCount: 1, duration: 60 },
  ];
  const completed = [
    { resultId: 1, domainName: "Frontend", score: 3, total: 5, timeTaken: "10:00", submittedAt: "2026-01-01T10:00:00Z", reason: "submitted", violationCount: 0 },
    { resultId: 2, domainName: "Backend", score: 1, total: 5, timeTaken: "09:00", submittedAt: "2026-02-01T10:00:00Z", reason: "left-tab", violationCount: 1 },
    { resultId: 3, domainName: "DB", score: 0, total: 5, timeTaken: "01:00", reason: "violations", violationCount: 3 },
  ];

  const mount = (props = {}) =>
    renderWithProviders(<StudentDashboard student={student} onLogout={() => {}} onSelectDomain={() => {}} selecting={false} {...props} />);

  it("shows the scheduled tab with domains for a student who hasn't attempted", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: [] });
    const onSelectDomain = vi.fn();
    mount({ onSelectDomain });
    expect(screen.getByText("Welcome, Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Employee ID S1")).toBeInTheDocument();
    expect(await screen.findByText("5 questions · 30 min")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Frontend"));
    expect(onSelectDomain).toHaveBeenCalledWith(domains[0]);
  });

  it("disables domain cards while a selection is in flight", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: [] });
    mount({ selecting: true });
    expect((await screen.findByText("Custom")).closest("button")).toBeDisabled();
  });

  it("shows the empty completed tab", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({});
    mount();
    await screen.findByText("Frontend");
    await userEvent.click(screen.getByText(/Completed/));
    expect(await screen.findByText("No completed exams yet")).toBeInTheDocument();
  });

  it("shows the already-completed message on the scheduled tab", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: completed });
    mount();
    await userEvent.click(screen.getByText(/Scheduled/));
    expect(await screen.findByText("You've completed your assessment")).toBeInTheDocument();
    await userEvent.click(screen.getByText(/View my results/));
    expect(await screen.findByText("Your assessments are complete")).toBeInTheDocument();
  });

  it("lists results newest-first with status and violation badges, and the latest score", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: completed });
    mount({ student: { ...student, hasAttempted: true } });
    expect(await screen.findByText("Your assessments are complete")).toBeInTheDocument();
    expect(screen.getByText(/Thanks for completing it, Asha/)).toBeInTheDocument();
    expect(screen.getByText("Left tab")).toBeInTheDocument();
    expect(screen.getByText("Terminated")).toBeInTheDocument();
    expect(screen.getByText("Latest score")).toBeInTheDocument();
    expect(screen.getAllByText("Download PDF")).toHaveLength(3);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // result 3 has no submittedAt
  });

  it("uses the singular heading for one result and merges latestResult", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: [] });
    mount({ latestResult: { resultId: 9, domainName: "Frontend", score: 4, total: 5, timeTaken: "05:00", submittedAt: "2026-03-01T10:00:00Z", questions: [] } });
    expect(await screen.findByText("Your assessment is complete")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Download PDF"));
    // latestResult already has questions, so no detail fetch is needed
    expect(api.getMyResultDetail).not.toHaveBeenCalled();
    expect(downloadResultPdf).toHaveBeenCalled();
  });

  it("fetches the full detail before downloading a summary row", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: [completed[0]] });
    api.getMyResultDetail.mockResolvedValue({ result: { full: true } });
    mount({ student: { ...student, hasAttempted: true } });
    await userEvent.click(await screen.findByText("Download PDF"));
    await waitFor(() => expect(downloadResultPdf).toHaveBeenCalledWith({ full: true }));
    expect(api.getMyResultDetail).toHaveBeenCalledWith("S1", 1);
  });

  it("toasts a PDF failure (with and without a message)", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockResolvedValue({ results: [completed[0]] });
    api.getMyResultDetail.mockRejectedValueOnce(new Error("detail fail")).mockRejectedValueOnce({});
    mount({ student: { ...student, hasAttempted: true } });
    await userEvent.click(await screen.findByText("Download PDF"));
    expect(await screen.findByText("detail fail")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Download PDF"));
    expect(await screen.findByText("Couldn't generate the PDF.")).toBeInTheDocument();
  });

  it("toasts a domain load failure, ignores a results failure, and signs out", async () => {
    api.getDomains.mockRejectedValue(new Error("domains fail"));
    api.getMyResults.mockRejectedValue(new Error("results fail"));
    const onLogout = vi.fn();
    mount({ onLogout });
    expect(await screen.findByText("domains fail")).toBeInTheDocument();
    expect(screen.queryByText("results fail")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Sign out"));
    expect(onLogout).toHaveBeenCalled();
  });

  it("shows a skeleton on the completed tab while results load", async () => {
    api.getDomains.mockResolvedValue({ domains });
    api.getMyResults.mockReturnValue(new Promise(() => {}));
    mount({ student: { ...student, hasAttempted: true } });
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
