import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({ api: { runCode: vi.fn() } }));
vi.mock("../../src/components/Shared/CodeEditor", () => ({
  default: ({ value, onChange, language }) => (
    <textarea data-testid="code-editor" data-language={language} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { api } from "../../src/api/client";
import ExamRunner from "../../src/components/Exam/ExamRunner";

const exam = {
  title: "Frontend Exam",
  duration: 120,
  questions: [
    { id: 1, type: "mcq", text: "MCQ question", options: ["Alpha", "Beta"] },
    { id: 2, type: "fill_blank", text: "Fill ___ blank" },
    {
      id: 3,
      type: "coding",
      text: "Coding question",
      language: "python",
      starterCode: "def f(): pass",
      problemStatement: "Do the thing",
      sampleOutput: "42",
    },
    { id: 4, type: "mcq", text: "No options question" },
  ],
};
const student = { id: "S1", name: "Asha" };

function setFullscreen(el) {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => el });
}

const mount = (props = {}) => {
  const onSubmit = vi.fn();
  const utils = renderWithProviders(<ExamRunner exam={exam} student={student} onSubmit={onSubmit} {...props} />);
  return { onSubmit, ...utils };
};
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));
const goTo = (n) => fireEvent.click(screen.getByLabelText(new RegExp(`^Go to question ${n} `)));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
  setFullscreen(document.body);
  document.documentElement.requestFullscreen = vi.fn().mockResolvedValue();
  document.exitFullscreen = vi.fn().mockResolvedValue();
});
afterEach(() => {
  vi.useRealTimers();
  setFullscreen(null);
});

describe("ExamRunner - basics", () => {
  it("renders the header, student, timer, fullscreen badge and first question", () => {
    mount();
    expect(screen.getByText("Question 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("MCQ question")).toBeInTheDocument();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("02:00")).toBeInTheDocument();
    expect(screen.getByText("Fullscreen")).toBeInTheDocument();
  });

  it("works without a student and shows the not-fullscreen badge", () => {
    setFullscreen(null);
    mount({ student: undefined });
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.getByText("Not fullscreen")).toBeInTheDocument();
  });

  it("follows fullscreen changes", () => {
    mount();
    expect(screen.getByText("Fullscreen")).toBeInTheDocument();
    setFullscreen(null);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByText("Not fullscreen")).toBeInTheDocument();
  });

  it("counts down and goes red under a minute", () => {
    mount({ exam: { ...exam, duration: 61 } });
    tick(1000);
    expect(screen.getByText("01:00")).toBeInTheDocument();
  });

  it("auto-submits when the timer reaches zero", () => {
    const { onSubmit } = mount({ exam: { ...exam, duration: 2 } });
    tick(1000);
    tick(1000);
    tick(10);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][1]).toBe("timeout");
    expect(document.exitFullscreen).toHaveBeenCalled();
  });
});

describe("ExamRunner - answering", () => {
  it("answers an MCQ, marks for review, and navigates", async () => {
    mount();
    fireEvent.click(screen.getByText("Beta"));
    expect(screen.getByText("1/4 Answered")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mark for review"));
    expect(screen.getByText("Marked for review")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Marked for review"));
    expect(screen.getByText("Mark for review")).toBeInTheDocument();

    expect(screen.getByText("Previous")).toBeDisabled();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Question 2 of 4")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Previous"));
    expect(screen.getByText("Question 1 of 4")).toBeInTheDocument();
  });

  it("answers fill-in-the-blank questions", () => {
    mount();
    goTo(2);
    const input = screen.getByPlaceholderText("Type your answer for the blank");
    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.getByText("0/4 Answered")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "answer" } });
    expect(screen.getByText("1/4 Answered")).toBeInTheDocument();
  });

  it("renders an MCQ with no options without crashing", () => {
    mount();
    goTo(4);
    expect(screen.getByText("No options question")).toBeInTheDocument();
    expect(screen.getByText("Submit exam")).toBeInTheDocument();
  });
});

describe("ExamRunner - coding questions", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("shows the prompt, starter code and example, and tracks edits as an answer", () => {
    mount();
    goTo(3);
    expect(screen.getByText("Do the thing")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    const editor = screen.getByTestId("code-editor");
    expect(editor).toHaveValue("def f(): pass");
    expect(editor).toHaveAttribute("data-language", "python");
    fireEvent.change(editor, { target: { value: "def f(): return 1" } });
    expect(screen.getByText("Answered")).toBeInTheDocument();
    expect(screen.getByText("1/4 Answered")).toBeInTheDocument();
  });

  it("uses boilerplate when switching language and clears old output", async () => {
    api.runCode.mockResolvedValue({ stdout: "hi" });
    mount();
    goTo(3);
    await userEvent.click(screen.getByText("Run"));
    expect(await screen.findByText("hi")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "java" } });
    expect(screen.getByTestId("code-editor").value).toContain("public class Main");
    expect(screen.queryByText("hi")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cpp" } });
    expect(screen.getByTestId("code-editor").value).toContain("#include <iostream>");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "javascript" } });
    expect(screen.getByTestId("code-editor").value).toContain("// your code here");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "python" } });
    expect(screen.getByTestId("code-editor").value).toBe("def f(): pass");
  });

  it("runs code and shows stdout + stderr, no-output and error states", async () => {
    mount();
    goTo(3);
    api.runCode.mockResolvedValueOnce({ stdout: "out", stderr: "err" });
    await userEvent.click(screen.getByText("Run"));
    expect(await screen.findByText("out")).toBeInTheDocument();
    expect(screen.getByText("err")).toBeInTheDocument();
    expect(api.runCode).toHaveBeenCalledWith("python", "def f(): pass");

    api.runCode.mockResolvedValueOnce({ stderr: "only err" });
    await userEvent.click(screen.getByText("Run"));
    expect(await screen.findByText("only err")).toBeInTheDocument();

    api.runCode.mockResolvedValueOnce({});
    await userEvent.click(screen.getByText("Run"));
    expect(await screen.findByText("(no output)")).toBeInTheDocument();

    api.runCode.mockRejectedValueOnce(new Error("sandbox down"));
    await userEvent.click(screen.getByText("Run"));
    expect(await screen.findByText("sandbox down")).toBeInTheDocument();
  });

  it("shows a running state, and disables Run when the editor is empty", async () => {
    let resolve;
    api.runCode.mockReturnValue(new Promise((r) => (resolve = r)));
    mount();
    goTo(3);
    await userEvent.click(screen.getByText("Run"));
    expect(screen.getByText("Running…")).toBeInTheDocument();
    await act(async () => resolve({ stdout: "done" }));
    expect(await screen.findByText("done")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("code-editor"), { target: { value: "   " } });
    expect(screen.getByText("Run").closest("button")).toBeDisabled();
  });

  it("does not call the API for blank code even if run is triggered", async () => {
    mount();
    goTo(3);
    fireEvent.change(screen.getByTestId("code-editor"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Run").closest("button"));
    expect(api.runCode).not.toHaveBeenCalled();
  });

  it("falls back to javascript when a coding question has no language", () => {
    mount({ exam: { ...exam, questions: [{ id: 7, type: "coding", text: "No lang" }] } });
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "javascript");
    expect(screen.getByTestId("code-editor").value).toContain("// your code here");
    expect(screen.queryByText("Example:")).not.toBeInTheDocument();
  });
});

describe("ExamRunner - submitting", () => {
  it("confirms before submitting manually, passing answers and the violation log", () => {
    const { onSubmit } = mount();
    fireEvent.click(screen.getByText("Beta"));
    goTo(4);
    fireEvent.click(screen.getByText("Submit exam"));
    expect(screen.getByText("Submit your exam?")).toBeInTheDocument();
    expect(screen.getByText(/answered 1 of 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Continue exam"));
    expect(screen.queryByText("Submit your exam?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Submit exam"));
    tick(5000);
    fireEvent.click(screen.getAllByText("Submit exam")[1]);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [answers, reason, timeTaken, violations] = onSubmit.mock.calls[0];
    expect(answers).toEqual({ 1: 1 });
    expect(reason).toBe("manual");
    expect(timeTaken).toBe("00:05");
    expect(violations).toEqual({ count: 0, log: [] });
  });

  it("only submits once even if finish is triggered twice", () => {
    const { onSubmit } = mount({ exam: { ...exam, duration: 1 } });
    tick(1000);
    tick(1000);
    tick(1000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("skips exitFullscreen when not in fullscreen", () => {
    setFullscreen(null);
    mount({ exam: { ...exam, duration: 1 } });
    tick(1000);
    expect(document.exitFullscreen).not.toHaveBeenCalled();
  });
});

describe("ExamRunner - anti-cheat", () => {
  const blur = () => {
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    tick(1000); // clear the de-duplication window between violations
  };

  it("shows a warning, a violation badge and toast, and returns to fullscreen", () => {
    mount();
    blur();
    expect(screen.getByText("Violation 1 of 3 recorded")).toBeInTheDocument();
    expect(screen.getByText("1/3 violations")).toBeInTheDocument();
    expect(screen.getByText("Violation 1/3 recorded: Window Blur.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Return to exam"));
    expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
    expect(screen.queryByText("Violation 1 of 3 recorded")).not.toBeInTheDocument();
  });

  it("tolerates requestFullscreen being unavailable", () => {
    document.documentElement.requestFullscreen = undefined;
    mount();
    blur();
    fireEvent.click(screen.getByText("Return to exam"));
    expect(screen.queryByText("Violation 1 of 3 recorded")).not.toBeInTheDocument();
  });

  it("terminates and auto-submits on the third violation", () => {
    const { onSubmit } = mount();
    blur();
    blur();
    blur();
    expect(screen.getByText("Exam terminated")).toBeInTheDocument();
    expect(screen.getByText(/exam terminated\./)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    tick(2100);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, reason, , violations] = onSubmit.mock.calls[0];
    expect(reason).toBe("violations");
    expect(violations.count).toBe(3);
    expect(violations.log).toHaveLength(3);
  });
});
