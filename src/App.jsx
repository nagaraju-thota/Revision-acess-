import { useState } from "react";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider, useToast } from "./context/ToastContext";
import { BrandProvider } from "./context/BrandContext";
import RegisterPage from "./components/Login/RegisterPage";
import LoginPage from "./components/Login/LoginPage";
import ExamIntro from "./components/Exam/ExamIntro";
import ExamRunner from "./components/Exam/ExamRunner";
import ExamSubmitted from "./components/Exam/ExamSubmitted";
import AdminDashboard from "./components/Admin/AdminDashboard";
import StudentDashboard from "./components/Dashboard/StudentDashboard";
import { api } from "./api/client";

// stages: register -> login -> dashboard -> intro -> exam -> submitted -> dashboard
//         register -> login -> admin
// "register" is the very first screen — students create their one-time
// account there before they can even reach the login page. "dashboard" is
// the student's home base: it lets them start their scheduled assessment
// (Scheduled tab) and, once finished, review score/violations and download
// their PDF report (Completed tab) — see components/Dashboard.
// Domains/DomainSelect.jsx is no longer wired into this flow (dashboard's
// Scheduled tab replaced it) but is left in place, unmodified, in case it's
// needed again.
function ExamPlatformInner() {
  const toast = useToast();
  const [stage, setStage] = useState("register");
  const [student, setStudent] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [domain, setDomain] = useState(null);
  const [exam, setExam] = useState(null);
  const [submitReason, setSubmitReason] = useState("manual");
  const [violationCount, setViolationCount] = useState(0);
  // Full result payload from the backend's /exam/submit response (score,
  // total, per-question correctIndex, submittedAt, resultId, ...) — see
  // handleSubmit below. Null until that response lands (or if it fails),
  // in which case ExamSubmitted just falls back to its plain confirmation.
  const [result, setResult] = useState(null);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [prefillStudentId, setPrefillStudentId] = useState("");

  const handleRegistered = (id) => {
    setPrefillStudentId(id);
    setStage("login");
  };

  const handleStudentLogin = (s) => {
    setStudent(s);
    setStage("dashboard");
  };

  const handleAdminLogin = (a) => {
    setAdmin(a);
    setStage("admin");
  };

  const selectDomain = async (d) => {
    setDomainsLoading(true);
    try {
      // student.id lets the backend enforce the global exam schedule/grace
      // period (see Admin/ExamScheduleTab.jsx) and check this specific
      // student's override once the window's closed for everyone else.
      // If the window isn't open, this throws with the backend's message
      // ("This exam opens at ..." / "The window to start this exam has
      // closed...") and the catch below surfaces it as a toast.
      const { exam } = await api.getExam(d.id, student?.id);
      setDomain(d);
      setExam(exam);
      setStage("intro");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDomainsLoading(false);
    }
  };

  // violations: { count, log: [{ type, timestamp, violationNumber, action }] }
  // — see hooks/useAntiCheat.js. Passed straight through to the backend so
  // the admin's Anti-Cheating Report has the full, real-timestamped history.
  const handleSubmit = async (answers, reason, timeTaken, violations = { count: 0, log: [] }) => {
    setSubmitReason(reason);
    setViolationCount(violations.count);
    setResult(null);
    setStage("submitted");
    try {
      // The backend scores the exam (it holds the correct answers — the
      // student's browser never does) and is expected to respond with
      // { result } in the same shape admin/results/:id already returns:
      // { resultId, studentId, name, domainId, domainName, score, total,
      //   timeTaken, reason, submittedAt, questions: [{ id, text, options,
      //   correctIndex, studentAnswer }], violationCount, violations }.
      // ExamSubmitted uses this directly for the score readout and reuses
      // utils/pdfReport.js (the same PDF builder the admin dashboard uses)
      // for the student's own download. If a response doesn't include a
      // usable score, ExamSubmitted quietly falls back to the plain
      // confirmation it always showed before.
      const data = await api.submitExam({
        studentId: student.id,
        name: student.name,
        domainId: domain.id,
        answers,
        timeTaken,
        reason,
        violationCount: violations.count,
        violations: violations.log,
      });
      setResult(data?.result ?? null);
    } catch {
      // Submission still shown to the student as complete; a real deployment
      // would retry/queue this in the background.
    }
  };

  const logout = () => {
    setStudent(null);
    setAdmin(null);
    setDomain(null);
    setExam(null);
    setStage("login");
  };

  if (stage === "register")
    return <RegisterPage onRegistered={handleRegistered} onGoToLogin={() => setStage("login")} />;
  if (stage === "login")
    return (
      <LoginPage
        onStudentLogin={handleStudentLogin}
        onAdminLogin={handleAdminLogin}
        onGoToRegister={() => setStage("register")}
        prefillStudentId={prefillStudentId}
      />
    );
  if (stage === "admin") return <AdminDashboard admin={admin} onLogout={logout} />;
  if (stage === "dashboard")
    return (
      <StudentDashboard
        student={student}
        onLogout={logout}
        onSelectDomain={selectDomain}
        selecting={domainsLoading}
        latestResult={result}
      />
    );
  if (stage === "intro") return <ExamIntro exam={exam} onStart={() => setStage("exam")} onBack={() => setStage("dashboard")} />;
  if (stage === "exam") return <ExamRunner exam={exam} student={student} onSubmit={handleSubmit} />;
  if (stage === "submitted")
    return (
      <ExamSubmitted
        reason={submitReason}
        violationCount={violationCount}
        result={result}
        onDone={logout}
        onViewDashboard={() => setStage("dashboard")}
      />
    );
  return null;
}

export default function ExamPlatform() {
  return (
    <ThemeProvider>
      <BrandProvider>
        <ToastProvider>
          <ExamPlatformInner />
        </ToastProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}
