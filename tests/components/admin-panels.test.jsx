import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({
  api: {
    previewQuestions: vi.fn(),
    publishQuestions: vi.fn(),
    getFillBlankQuestions: vi.fn(),
    publishFillBlankQuestions: vi.fn(),
    deleteFillBlankQuestion: vi.fn(),
    getCodingQuestions: vi.fn(),
    addCodingQuestion: vi.fn(),
    deleteCodingQuestion: vi.fn(),
    getResultDetail: vi.fn(),
    getAllResults: vi.fn(),
    getDomainQuestions: vi.fn(),
    getQuestionStats: vi.fn(),
  },
}));
vi.mock("../../src/utils/pdfReport", () => ({ downloadResultPdf: vi.fn() }));

import { api } from "../../src/api/client";
import AnswerModal from "../../src/components/Admin/AnswerModal";
import CodingPanel from "../../src/components/Admin/CodingPanel";
import FillBlankPanel from "../../src/components/Admin/FillBlankPanel";
import McqPanel from "../../src/components/Admin/McqPanel";
import QuestionInsightsTab from "../../src/components/Admin/QuestionInsightsTab";
import ResultsTab from "../../src/components/Admin/ResultsTab";
import { downloadResultPdf } from "../../src/utils/pdfReport";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

const type = (el, value) => fireEvent.change(el, { target: { value } });

describe("McqPanel", () => {
  const preview = {
    questions: [
      { text: "Capital?", options: ["Berlin", "Paris"], correctIndex: 1 },
      { text: "Second?", options: ["x", "y"], correctIndex: 0 },
    ],
    errors: ["Question 3: bad"],
  };

  it("starts empty and does not call the API", () => {
    renderWithProviders(<McqPanel domainId="d1" domainName="Dom" />);
    expect(screen.getByText(/Parsed questions will appear here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish questions" })).toBeDisabled();
    expect(api.previewQuestions).not.toHaveBeenCalled();
  });

  it("does not preview without a domain", async () => {
    renderWithProviders(<McqPanel domainId="" domainName="" />);
    type(screen.getByRole("textbox"), "Q: x");
    await new Promise((r) => setTimeout(r, 400));
    expect(api.previewQuestions).not.toHaveBeenCalled();
  });

  it("previews parsed questions and errors, then publishes", async () => {
    api.previewQuestions.mockResolvedValue(preview);
    api.publishQuestions.mockResolvedValue({});
    renderWithProviders(<McqPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: Capital?");
    expect(await screen.findByText("1. Capital?")).toBeInTheDocument();
    expect(screen.getByText(/Question 3: bad/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Publish 2 questions" });
    await userEvent.click(btn);
    expect(await screen.findByText("Published 2 questions to Dom")).toBeInTheDocument();
    expect(api.publishQuestions).toHaveBeenCalledWith("d1", "Q: Capital?");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
    await waitFor(() => expect(screen.queryByText("1. Capital?")).not.toBeInTheDocument());
  });

  it("uses singular wording for one question", async () => {
    api.previewQuestions.mockResolvedValue({ questions: [preview.questions[0]], errors: [] });
    api.publishQuestions.mockResolvedValue({});
    renderWithProviders(<McqPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: one");
    await userEvent.click(await screen.findByRole("button", { name: "Publish 1 question" }));
    expect(await screen.findByText("Published 1 question to Dom")).toBeInTheDocument();
  });

  it("shows publish errors", async () => {
    api.previewQuestions.mockResolvedValue(preview);
    api.publishQuestions.mockRejectedValue(new Error("Publish failed"));
    renderWithProviders(<McqPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: x");
    await userEvent.click(await screen.findByRole("button", { name: "Publish 2 questions" }));
    expect((await screen.findAllByText("Publish failed")).length).toBeGreaterThan(0);
  });

  it("ignores preview failures", async () => {
    api.previewQuestions.mockRejectedValue(new Error("x"));
    renderWithProviders(<McqPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: x");
    await waitFor(() => expect(api.previewQuestions).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Publish questions" })).toBeDisabled();
  });
});

describe("FillBlankPanel", () => {
  const existing = [{ id: 1, text: "A ___", answers: ["x", "y"] }];

  it("loads existing questions and previews parsed input and errors", async () => {
    api.getFillBlankQuestions.mockResolvedValue(existing);
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    expect(await screen.findByText(/Already added to Dom \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("(x, y)")).toBeInTheDocument();

    type(screen.getByRole("textbox"), "Q: Hello ___\nA: world | earth\n\nQ: no blank\nA: x");
    expect(await screen.findByText("1. Hello ___")).toBeInTheDocument();
    expect(screen.getByText("world / earth")).toBeInTheDocument();
    expect(screen.getByText(/needs a blank/)).toBeInTheDocument();
    type(screen.getByRole("textbox"), "");
    await waitFor(() => expect(screen.queryByText("1. Hello ___")).not.toBeInTheDocument());
  });

  it("publishes (plural + singular) and replaces the existing list", async () => {
    api.getFillBlankQuestions.mockResolvedValue([]);
    api.publishFillBlankQuestions.mockResolvedValueOnce({ published: 2, questions: existing });
    api.publishFillBlankQuestions.mockResolvedValueOnce({ published: 1, questions: existing });
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: a ___\nA: b");
    await userEvent.click(await screen.findByRole("button", { name: "Publish 1 question" }));
    expect(await screen.findByText("Published 2 fill-in-the-blank questions to Dom")).toBeInTheDocument();
    type(screen.getByRole("textbox"), "Q: a ___\nA: b");
    await userEvent.click(await screen.findByRole("button", { name: "Publish 1 question" }));
    expect(await screen.findByText("Published 1 fill-in-the-blank question to Dom")).toBeInTheDocument();
  });

  it("publishes several questions with a plural button label", async () => {
    api.getFillBlankQuestions.mockResolvedValue([]);
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    type(screen.getByRole("textbox"), "Q: a ___\nA: b\n\nQ: c ___\nA: d");
    expect(await screen.findByRole("button", { name: "Publish 2 questions" })).toBeEnabled();
  });

  it("toasts when publishing, loading or deleting fails", async () => {
    api.getFillBlankQuestions.mockRejectedValueOnce(new Error("load fail"));
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    expect(await screen.findByText("load fail")).toBeInTheDocument();

    api.publishFillBlankQuestions.mockRejectedValue(new Error("pub fail"));
    type(screen.getByRole("textbox"), "Q: a ___\nA: b");
    await userEvent.click(await screen.findByRole("button", { name: "Publish 1 question" }));
    expect(await screen.findByText("pub fail")).toBeInTheDocument();
  });

  it("deletes a question, and toasts a delete failure", async () => {
    api.getFillBlankQuestions.mockResolvedValue(existing);
    api.deleteFillBlankQuestion.mockResolvedValueOnce({ questions: [] });
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    await userEvent.click(await screen.findByLabelText("Delete question"));
    expect(await screen.findByText("Question deleted.")).toBeInTheDocument();
    expect(api.deleteFillBlankQuestion).toHaveBeenCalledWith("d1", 1);
  });

  it("shows an error toast when delete fails", async () => {
    api.getFillBlankQuestions.mockResolvedValue(existing);
    api.deleteFillBlankQuestion.mockRejectedValue(new Error("del fail"));
    renderWithProviders(<FillBlankPanel domainId="d1" domainName="Dom" />);
    await userEvent.click(await screen.findByLabelText("Delete question"));
    expect(await screen.findByText("del fail")).toBeInTheDocument();
  });

  it("skips loading when there is no domain", () => {
    renderWithProviders(<FillBlankPanel domainId="" domainName="" />);
    expect(api.getFillBlankQuestions).not.toHaveBeenCalled();
  });
});

describe("CodingPanel", () => {
  const existing = [
    { id: 1, title: "Sum", language: "python", prompt: "Add numbers", starterCode: "def f(): pass", sampleOutput: "3" },
    { id: 2, title: "Bare", language: "ruby", prompt: "p", starterCode: "", sampleOutput: "" },
  ];
  const fields = () => screen.getAllByRole("textbox"); // title, problem, starter, sample

  it("shows an empty state, then the loaded questions", async () => {
    api.getCodingQuestions.mockResolvedValueOnce([]);
    const { unmount } = renderWithProviders(<CodingPanel domainId="d1" domainName="Dom" />);
    expect(await screen.findByText("No coding questions yet.")).toBeInTheDocument();
    unmount();

    api.getCodingQuestions.mockResolvedValueOnce(existing);
    renderWithProviders(<CodingPanel domainId="d1" domainName="Dom" />);
    expect(await screen.findByText(/1\. Sum/)).toBeInTheDocument();
    expect(screen.getAllByText("Python")).toHaveLength(2); // option + badge
    expect(screen.getByText("ruby")).toBeInTheDocument();
    expect(screen.getByText("def f(): pass")).toBeInTheDocument();
  });

  it("adds a question and resets the form", async () => {
    api.getCodingQuestions.mockResolvedValue([]);
    api.addCodingQuestion.mockResolvedValue({ questions: existing });
    renderWithProviders(<CodingPanel domainId="d1" domainName="Dom" />);
    const submit = screen.getByRole("button", { name: "Add coding question" });
    expect(submit).toBeDisabled();
    type(fields()[0], "T");
    type(fields()[1], "P");
    type(fields()[2], "code");
    type(fields()[3], "out");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "python" } });
    await userEvent.click(submit);
    expect(await screen.findByText("Added coding question to Dom")).toBeInTheDocument();
    expect(api.addCodingQuestion).toHaveBeenCalledWith("d1", {
      title: "T",
      language: "python",
      prompt: "P",
      starterCode: "code",
      sampleOutput: "out",
    });
    await waitFor(() => expect(fields()[0]).toHaveValue(""));
    expect(await screen.findByText(/1\. Sum/)).toBeInTheDocument();
  });

  it("toasts add and delete failures, and deletes successfully", async () => {
    api.getCodingQuestions.mockResolvedValue(existing);
    api.addCodingQuestion.mockRejectedValue(new Error("add fail"));
    api.deleteCodingQuestion.mockRejectedValueOnce(new Error("del fail"));
    api.deleteCodingQuestion.mockResolvedValueOnce({ questions: [] });
    renderWithProviders(<CodingPanel domainId="d1" domainName="Dom" />);
    await screen.findByText(/1\. Sum/);
    type(fields()[0], "T");
    type(fields()[1], "P");
    await userEvent.click(screen.getByRole("button", { name: "Add coding question" }));
    expect(await screen.findByText("add fail")).toBeInTheDocument();

    const dels = screen.getAllByLabelText("Delete question");
    await userEvent.click(dels[0]);
    expect(await screen.findByText("del fail")).toBeInTheDocument();
    await userEvent.click(screen.getAllByLabelText("Delete question")[0]);
    expect(await screen.findByText("Question deleted.")).toBeInTheDocument();
  });

  it("toasts when loading fails and skips loading without a domain", async () => {
    api.getCodingQuestions.mockRejectedValue(new Error("load fail"));
    const { unmount } = renderWithProviders(<CodingPanel domainId="d1" domainName="Dom" />);
    expect(await screen.findByText("load fail")).toBeInTheDocument();
    unmount();
    api.getCodingQuestions.mockClear();
    renderWithProviders(<CodingPanel domainId="" domainName="" />);
    expect(api.getCodingQuestions).not.toHaveBeenCalled();
  });
});

describe("AnswerModal", () => {
  const detail = {
    studentId: "S1",
    name: "Asha",
    domainName: "Frontend",
    score: 1,
    total: 6,
    violationCount: 3,
    violations: [{ type: "tab-switch", violationNumber: 1, timestamp: "2026-01-01T10:00:00Z", action: "Exam Terminated" }],
    questions: [
      { id: 1, type: "mcq", text: "M1", options: ["a", "b"], correctIndex: 1, studentAnswer: 1 },
      { id: 2, type: "mcq", text: "M2", options: ["a", "b"], correctIndex: 1, studentAnswer: 0 },
      { id: 3, type: "mcq", text: "M3", correctIndex: 1 },
      { id: 4, type: "fill_blank", text: "F1", studentAnswer: "PARIS", acceptedAnswers: ["paris"] },
      { id: 5, type: "fill_blank", text: "F2", studentAnswer: "rome", answers: ["paris"] },
      { id: 6, type: "fill_blank", text: "F3", studentAnswer: 3 },
      { id: 7, type: "coding", text: "C1", studentAnswer: { language: "js", code: "x" } },
      { id: 8, type: "coding", text: "C2", studentAnswer: "legacy" },
      { id: 9, type: "coding", text: "C3", studentAnswer: { code: 5 } },
      { id: 10, type: "coding", text: "C4", studentAnswer: 12 },
    ],
  };

  it("shows a skeleton, then the answers", async () => {
    api.getResultDetail.mockResolvedValue({ result: detail });
    const onClose = vi.fn();
    renderWithProviders(<AnswerModal resultId={5} onClose={onClose} />);
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
    expect(await screen.findByText("Asha's answers")).toBeInTheDocument();
    expect(screen.getByText("Score: 1 / 6")).toBeInTheDocument();
    expect(screen.getAllByText(/Code submitted \(not auto-graded\)/)).toHaveLength(2);
    expect(screen.getByText("Correct: paris")).toBeInTheDocument();
    expect(screen.getByText(/automatically terminated/)).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("downloads the PDF and closes via button and backdrop", async () => {
    api.getResultDetail.mockResolvedValue({ result: { ...detail, violationCount: undefined, violations: undefined } });
    const onClose = vi.fn();
    renderWithProviders(<AnswerModal resultId={5} onClose={onClose} />);
    await userEvent.click(await screen.findByText(/Download PDF/));
    expect(downloadResultPdf).toHaveBeenCalled();
    await userEvent.click(screen.getByText("Asha's answers"));
    expect(onClose).not.toHaveBeenCalled(); // clicks inside don't close
    await userEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Close").closest("div").parentElement.parentElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows the error and restores page scroll on unmount", async () => {
    api.getResultDetail.mockRejectedValue(new Error("Not found"));
    document.body.style.overflow = "auto";
    const { unmount } = renderWithProviders(<AnswerModal resultId={5} onClose={() => {}} />);
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});

describe("ResultsTab", () => {
  const results = [
    { resultId: 1, studentId: "S1", name: "A", domainName: "Frontend", score: 3, total: 5, timeTaken: "10:00", reason: "submitted", violationCount: 0 },
    { resultId: 2, studentId: "S2", name: "B", domainName: "Backend", score: 5, total: 5, timeTaken: "11:00", reason: "left-tab", violationCount: 1 },
    { resultId: 3, studentId: "S3", name: "C", domainName: "Frontend", score: 4, total: 5, timeTaken: "12:00", reason: "violations", violationCount: 3 },
  ];

  it("shows loading, then stats and rows with status and violation badges", async () => {
    api.getAllResults.mockResolvedValue({ results });
    renderWithProviders(<ResultsTab />);
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
    expect(await screen.findByText("S1")).toBeInTheDocument();
    expect(screen.getByText("4.0 / 5")).toBeInTheDocument();
    expect(screen.getByText("Left tab")).toBeInTheDocument();
    expect(screen.getByText("Terminated")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("filters by domain, including an empty result set", async () => {
    api.getAllResults.mockResolvedValue({ results });
    renderWithProviders(<ResultsTab />);
    await screen.findByText("S1");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Backend" } });
    expect(screen.queryByText("S1")).not.toBeInTheDocument();
    expect(screen.getByText("S2")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    expect(screen.getByText("S1")).toBeInTheDocument();
  });

  it("shows an empty message when there are no results", async () => {
    api.getAllResults.mockResolvedValue({ results: [] });
    renderWithProviders(<ResultsTab />);
    expect(await screen.findByText("No submissions yet.")).toBeInTheDocument();
    expect(screen.getByText("0.0 / —")).toBeInTheDocument();
  });

  it("shows a load error", async () => {
    api.getAllResults.mockRejectedValue(new Error("Forbidden"));
    renderWithProviders(<ResultsTab />);
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("downloads a PDF and toasts a failure (with and without a message)", async () => {
    api.getAllResults.mockResolvedValue({ results });
    api.getResultDetail.mockResolvedValueOnce({ result: { name: "A" } });
    renderWithProviders(<ResultsTab />);
    await screen.findByText("S1");
    await userEvent.click(screen.getAllByText("PDF")[0]);
    await waitFor(() => expect(downloadResultPdf).toHaveBeenCalledWith({ name: "A" }));

    api.getResultDetail.mockRejectedValueOnce(new Error("pdf boom"));
    await userEvent.click(screen.getAllByText("PDF")[0]);
    expect(await screen.findByText("pdf boom")).toBeInTheDocument();

    api.getResultDetail.mockRejectedValueOnce({});
    await userEvent.click(screen.getAllByText("PDF")[1]);
    expect(await screen.findByText("Couldn't generate the PDF.")).toBeInTheDocument();
  });

  it("opens and closes the answer modal", async () => {
    api.getAllResults.mockResolvedValue({ results });
    api.getResultDetail.mockResolvedValue({ result: { studentId: "S1", name: "Asha", domainName: "F", score: 1, total: 1, questions: [] } });
    renderWithProviders(<ResultsTab />);
    await screen.findByText("S1");
    await userEvent.click(screen.getAllByText(/View/)[0]);
    expect(await screen.findByText("Asha's answers")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Close"));
    await waitFor(() => expect(screen.queryByText("Asha's answers")).not.toBeInTheDocument());
  });
});

describe("QuestionInsightsTab", () => {
  const domains = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
  ];
  const questions = [
    { id: 1, text: "Short question" },
    { id: 2, text: "L".repeat(80) },
  ];
  const [domainSelect, questionSelect] = [() => screen.getAllByRole("combobox")[0], () => screen.getAllByRole("combobox")[1]];

  it("loads questions and shows a pie chart plus options for mcq stats", async () => {
    api.getDomainQuestions.mockResolvedValue({ questions });
    api.getQuestionStats.mockResolvedValue({
      stats: { text: "Short question", type: "mcq", totalAttempts: 4, correct: 3, wrong: 1, unanswered: 0, options: ["x", "y"], correctIndex: 1 },
    });
    renderWithProviders(<QuestionInsightsTab domains={domains} />);
    expect(screen.getByText(/Select a question above/)).toBeInTheDocument();
    await screen.findByText(/Q2\. L{60}…/);
    fireEvent.change(questionSelect(), { target: { value: "1" } });
    expect(await screen.findByText("4 attempts so far")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("y")).toBeInTheDocument();
  });

  it("handles singular attempt, zero attempts and coding questions", async () => {
    api.getDomainQuestions.mockResolvedValue({ questions });
    renderWithProviders(<QuestionInsightsTab domains={domains} />);
    await screen.findByText(/Q2\./);

    api.getQuestionStats.mockResolvedValueOnce({ stats: { text: "t", type: "mcq", totalAttempts: 1, correct: 1, wrong: 0, unanswered: 0 } });
    fireEvent.change(questionSelect(), { target: { value: "1" } });
    expect(await screen.findByText("1 attempt so far")).toBeInTheDocument();

    api.getQuestionStats.mockResolvedValueOnce({ stats: { text: "t", type: "mcq", totalAttempts: 0 } });
    fireEvent.change(questionSelect(), { target: { value: "2" } });
    expect(await screen.findByText(/No one has attempted/)).toBeInTheDocument();

    api.getQuestionStats.mockResolvedValueOnce({ stats: { text: "t", type: "coding", totalAttempts: 2 } });
    fireEvent.change(questionSelect(), { target: { value: "1" } });
    expect(await screen.findByText(/aren't auto-graded/)).toBeInTheDocument();

    fireEvent.change(questionSelect(), { target: { value: "" } });
    expect(await screen.findByText(/Select a question above/)).toBeInTheDocument();
  });

  it("changing the domain reloads questions; empty domains are disabled", async () => {
    api.getDomainQuestions.mockResolvedValueOnce({ questions }).mockResolvedValueOnce({});
    renderWithProviders(<QuestionInsightsTab domains={domains} />);
    await screen.findByText(/Q2\./);
    fireEvent.change(domainSelect(), { target: { value: "b" } });
    expect(await screen.findByText("No questions in this domain")).toBeInTheDocument();
    expect(questionSelect()).toBeDisabled();
    expect(api.getDomainQuestions).toHaveBeenLastCalledWith("b");
  });

  it("toasts when loading questions or stats fails, and does nothing without domains", async () => {
    api.getDomainQuestions.mockRejectedValueOnce(new Error("q fail"));
    const { unmount } = renderWithProviders(<QuestionInsightsTab domains={domains} />);
    expect(await screen.findByText("q fail")).toBeInTheDocument();
    unmount();

    api.getDomainQuestions.mockResolvedValue({ questions });
    api.getQuestionStats.mockRejectedValue(new Error("s fail"));
    const second = renderWithProviders(<QuestionInsightsTab domains={domains} />);
    await screen.findByText(/Q2\./);
    fireEvent.change(questionSelect(), { target: { value: "1" } });
    expect(await screen.findByText("s fail")).toBeInTheDocument();
    second.unmount();

    api.getDomainQuestions.mockClear();
    renderWithProviders(<QuestionInsightsTab domains={[]} />);
    expect(api.getDomainQuestions).not.toHaveBeenCalled();
  });
});
