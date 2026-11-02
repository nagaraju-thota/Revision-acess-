import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/api/client", () => ({ api: { getExam: vi.fn(), submitExam: vi.fn() } }));
vi.mock("../src/components/Login/RegisterPage", () => ({
  default: ({ onRegistered, onGoToLogin }) => (
    <div>
      <p>register-page</p>
      <button onClick={() => onRegistered("S9")}>do-register</button>
      <button onClick={onGoToLogin}>reg-to-login</button>
    </div>
  ),
}));
vi.mock("../src/components/Login/LoginPage", () => ({
  default: ({ onStudentLogin, onAdminLogin, onGoToRegister, prefillStudentId }) => (
    <div>
      <p>login-page {prefillStudentId}</p>
      <button onClick={() => onStudentLogin({ id: "S9", name: "Asha" })}>student-login</button>
      <button onClick={() => onAdminLogin({ name: "Root" })}>admin-login</button>
      <button onClick={onGoToRegister}>login-to-register</button>
    </div>
  ),
}));
vi.mock("../src/components/Admin/AdminDashboard", () => ({
  default: ({ admin, onLogout }) => (
    <div>
      <p>admin-dashboard {admin.name}</p>
      <button onClick={onLogout}>admin-logout</button>
    </div>
  ),
}));
vi.mock("../src/components/Dashboard/StudentDashboard", () => ({
  default: ({ student, onLogout, onSelectDomain, selecting, latestResult }) => (
    <div>
      <p>student-dashboard {student.name} {selecting ? "selecting" : "idle"} {latestResult ? `score-${latestResult.score}` : "no-result"}</p>
      <button onClick={() => onSelectDomain({ id: "frontend" })}>pick-domain</button>
      <button onClick={onLogout}>student-logout</button>
    </div>
  ),
}));
vi.mock("../src/components/Exam/ExamIntro", () => ({
  default: ({ exam, onStart, onBack }) => (
    <div>
      <p>intro {exam.title}</p>
      <button onClick={onStart}>start</button>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));
vi.mock("../src/components/Exam/ExamRunner", () => ({
  default: ({ onSubmit }) => (
    <div>
      <p>runner</p>
      <button onClick={() => onSubmit({ 1: 0 }, "manual", "01:00", { count: 2, log: [{ type: "x" }] })}>submit-full</button>
      <button onClick={() => onSubmit({}, "timeout", "02:00")}>submit-default</button>
    </div>
  ),
}));
vi.mock("../src/components/Exam/ExamSubmitted", () => ({
  default: ({ reason, violationCount, result, onDone, onViewDashboard }) => (
    <div>
      <p>submitted {reason} {violationCount} {result ? `score-${result.score}` : "no-result"}</p>
      <button onClick={onDone}>done</button>
      <button onClick={onViewDashboard}>to-dashboard</button>
    </div>
  ),
}));

import { api } from "../src/api/client";
import ExamPlatform from "../src/App";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

const click = (text) => fireEvent.click(screen.getByText(text));

describe("App stage machine", () => {
  it("starts on register and moves to login (with the new id prefilled)", () => {
    render(<ExamPlatform />);
    expect(screen.getByText("register-page")).toBeInTheDocument();
    click("do-register");
    expect(screen.getByText("login-page S9")).toBeInTheDocument();
  });

  it("navigates between register and login", () => {
    render(<ExamPlatform />);
    click("reg-to-login");
    expect(screen.getByText(/login-page/)).toBeInTheDocument();
    click("login-to-register");
    expect(screen.getByText("register-page")).toBeInTheDocument();
  });

  it("admin login goes to the admin dashboard and logout returns to login", () => {
    render(<ExamPlatform />);
    click("reg-to-login");
    click("admin-login");
    expect(screen.getByText("admin-dashboard Root")).toBeInTheDocument();
    click("admin-logout");
    expect(screen.getByText(/login-page/)).toBeInTheDocument();
  });

  it("runs the full student flow: login -> pick domain -> intro -> exam -> submitted -> dashboard", async () => {
    api.getExam.mockResolvedValue({ exam: { title: "Frontend Exam", questions: [] } });
    api.submitExam.mockResolvedValue({ result: { score: 4 } });
    render(<ExamPlatform />);
    click("reg-to-login");
    click("student-login");
    expect(screen.getByText(/student-dashboard Asha idle no-result/)).toBeInTheDocument();

    click("pick-domain");
    expect(await screen.findByText("intro Frontend Exam")).toBeInTheDocument();
    expect(api.getExam).toHaveBeenCalledWith("frontend", "S9");

    click("back");
    expect(screen.getByText(/student-dashboard/)).toBeInTheDocument();
    click("pick-domain");
    await screen.findByText("intro Frontend Exam");
    click("start");
    expect(screen.getByText("runner")).toBeInTheDocument();

    click("submit-full");
    expect(await screen.findByText("submitted manual 2 score-4")).toBeInTheDocument();
    expect(api.submitExam).toHaveBeenCalledWith({
      studentId: "S9",
      name: "Asha",
      domainId: "frontend",
      answers: { 1: 0 },
      timeTaken: "01:00",
      reason: "manual",
      violationCount: 2,
      violations: [{ type: "x" }],
    });

    click("to-dashboard");
    expect(screen.getByText(/student-dashboard Asha idle score-4/)).toBeInTheDocument();
    click("student-logout");
    expect(screen.getByText(/login-page/)).toBeInTheDocument();
  });

  it("uses default violations when none are passed and ends via 'done'", async () => {
    api.getExam.mockResolvedValue({ exam: { title: "E", questions: [] } });
    api.submitExam.mockResolvedValue({});
    render(<ExamPlatform />);
    click("reg-to-login");
    click("student-login");
    click("pick-domain");
    await screen.findByText("intro E");
    click("start");
    click("submit-default");
    expect(await screen.findByText("submitted timeout 0 no-result")).toBeInTheDocument();
    expect(api.submitExam.mock.calls[0][0]).toMatchObject({ violationCount: 0, violations: [] });
    click("done");
    expect(screen.getByText(/login-page/)).toBeInTheDocument();
  });

  it("still shows the submitted screen if the submit request fails", async () => {
    api.getExam.mockResolvedValue({ exam: { title: "E", questions: [] } });
    api.submitExam.mockRejectedValue(new Error("offline"));
    render(<ExamPlatform />);
    click("reg-to-login");
    click("student-login");
    click("pick-domain");
    await screen.findByText("intro E");
    click("start");
    click("submit-full");
    await waitFor(() => expect(api.submitExam).toHaveBeenCalled());
    expect(screen.getByText("submitted manual 2 no-result")).toBeInTheDocument();
  });

  it("toasts and stays on the dashboard when the exam window is closed", async () => {
    api.getExam.mockRejectedValue(new Error("This exam opens at 10:00"));
    render(<ExamPlatform />);
    click("reg-to-login");
    click("student-login");
    click("pick-domain");
    expect(await screen.findByText("This exam opens at 10:00")).toBeInTheDocument();
    expect(screen.getByText(/student-dashboard/)).toBeInTheDocument();
  });
});
