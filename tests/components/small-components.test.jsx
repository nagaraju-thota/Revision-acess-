import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { vi } from "vitest";

import ScoreRing from "../../src/components/Dashboard/ScoreRing";
import QuestionPieChart from "../../src/components/Admin/QuestionPieChart";
import ExamQuestionPalette from "../../src/components/Exam/ExamQuestionPalette";
import SubmitConfirmModal from "../../src/components/Exam/SubmitConfirmModal";
import ViolationWarningModal from "../../src/components/Exam/ViolationWarningModal";
import BrandMark from "../../src/components/Shared/BrandMark";
import Footer from "../../src/components/Shared/Footer";
import { Skeleton, SkeletonCardGrid, SkeletonLines, SkeletonTable } from "../../src/components/Shared/Skeleton";
import ThemeToggle from "../../src/components/Shared/ThemeToggle";
import { BrandProvider } from "../../src/context/BrandContext";
import { ThemeProvider } from "../../src/context/ThemeContext";

describe("ScoreRing", () => {
  it("shows the rounded percentage", () => {
    render(<ScoreRing score={1} total={3} />);
    expect(screen.getByText("33%")).toBeInTheDocument();
  });
  it("shows 0% when total is 0", () => {
    render(<ScoreRing score={0} total={0} size={40} strokeWidth={4} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("QuestionPieChart", () => {
  it("renders nothing when there is no data", () => {
    const { container } = render(<QuestionPieChart correct={0} wrong={0} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("shows the legend and percentages, hiding 'Unanswered' when zero", () => {
    render(<QuestionPieChart correct={3} wrong={1} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Wrong")).toBeInTheDocument();
    expect(screen.queryByText("Unanswered")).not.toBeInTheDocument();
  });
  it("shows 'Unanswered' when present", () => {
    render(<QuestionPieChart correct={1} wrong={1} unanswered={2} />);
    expect(screen.getByText("Unanswered")).toBeInTheDocument();
  });
});

describe("ExamQuestionPalette", () => {
  const questions = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const answers = { a: 1, b: 1 };
  const isAnswered = (q, ans) => ans[q.id] !== undefined;

  it("labels each cell by state and reports progress", async () => {
    const onSelect = vi.fn();
    render(
      <ExamQuestionPalette
        examTitle="Frontend"
        questions={questions}
        current={0}
        answers={answers}
        markedForReview={{ b: true, c: true }}
        isAnswered={isAnswered}
        onSelect={onSelect}
      />
    );
    expect(screen.getByLabelText("Go to question 1 (current)")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to question 2 (answered marked)")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to question 3 (marked)")).toBeInTheDocument();
    expect(screen.getByLabelText("Go to question 4 (not attempted)")).toBeInTheDocument();
    expect(screen.getByText("2/4 Answered")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Go to question 4 (not attempted)"));
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("marks an answered, unmarked question as answered", () => {
    render(
      <ExamQuestionPalette
        examTitle="T"
        questions={questions}
        current={3}
        answers={answers}
        markedForReview={{}}
        isAnswered={isAnswered}
        onSelect={() => {}}
      />
    );
    expect(screen.getByLabelText("Go to question 1 (answered)")).toBeInTheDocument();
  });
});

describe("SubmitConfirmModal", () => {
  it("warns about unanswered questions (plural and singular) and fires callbacks", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<SubmitConfirmModal answeredCount={2} total={5} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/3 questions still unanswered/)).toBeInTheDocument();
    expect(screen.getByText(/they will be/)).toBeInTheDocument();
    rerender(<SubmitConfirmModal answeredCount={4} total={5} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/1 question still unanswered/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Submit exam"));
    await userEvent.click(screen.getByText("Continue exam"));
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows no warning when everything is answered", () => {
    render(<SubmitConfirmModal answeredCount={5} total={5} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/still unanswered/)).not.toBeInTheDocument();
  });
});

describe("ViolationWarningModal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts down and returns to the exam automatically", () => {
    const onReturn = vi.fn();
    render(<ViolationWarningModal warning={{ type: "tab-switch", violationNumber: 1, terminated: false }} onReturn={onReturn} />);
    expect(screen.getByText("Violation 1 of 3 recorded")).toBeInTheDocument();
    expect(screen.getByText(/Tab Switch detected/)).toBeInTheDocument();
    expect(screen.getByText(/in 10s/)).toBeInTheDocument();
    for (let i = 0; i < 10; i++) act(() => vi.advanceTimersByTime(1000));
    expect(onReturn).toHaveBeenCalled();
  });

  it("lets the student return immediately", () => {
    const onReturn = vi.fn();
    render(<ViolationWarningModal warning={{ type: "unknown-type", violationNumber: 2, terminated: false }} onReturn={onReturn} />);
    expect(screen.getByText(/unknown-type detected/)).toBeInTheDocument();
    act(() => screen.getByText("Return to exam").click());
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("shows the terminated state with no button and no countdown", () => {
    const onReturn = vi.fn();
    render(<ViolationWarningModal warning={{ type: "window-blur", violationNumber: 3, terminated: true }} onReturn={onReturn} />);
    expect(screen.getByText("Exam terminated")).toBeInTheDocument();
    expect(screen.queryByText("Return to exam")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(20000));
    expect(onReturn).not.toHaveBeenCalled();
  });
});

describe("Skeleton family", () => {
  it("renders the building blocks", () => {
    const { container } = render(
      <>
        <Skeleton className="x" style={{ width: 5 }} />
        <SkeletonCardGrid />
        <SkeletonCardGrid count={2} />
        <SkeletonTable />
        <SkeletonTable rows={1} cols={2} />
        <SkeletonLines />
        <SkeletonLines count={1} />
      </>
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(20);
  });
});

describe("shared components that need providers", () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it("ThemeToggle flips between light and dark labels", async () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    await userEvent.click(screen.getByLabelText("Switch to dark mode"));
    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("BrandMark and Footer show the logo and company name", () => {
    render(<BrandProvider><BrandMark className="h-10" /><Footer /></BrandProvider>);
    expect(screen.getAllByAltText("AssessmentPortal logo").length).toBe(2);
    expect(screen.getByText("Built under AssessmentPortal")).toBeInTheDocument();
  });
});
