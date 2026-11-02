import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../src/components/Admin/McqPanel", () => ({ default: (p) => <div>mcq {p.domainId} {p.domainName}</div> }));
vi.mock("../../src/components/Admin/FillBlankPanel", () => ({ default: (p) => <div>fill {p.domainId}</div> }));
vi.mock("../../src/components/Admin/CodingPanel", () => ({ default: (p) => <div>coding {p.domainId}</div> }));

import AddQuestionsTab from "../../src/components/Admin/AddQuestionsTab";

const domains = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

describe("AddQuestionsTab", () => {
  it("starts on MCQ for the first domain", () => {
    render(<AddQuestionsTab domains={domains} />);
    expect(screen.getByText("mcq a Alpha")).toBeInTheDocument();
  });

  it("switches question type and domain", async () => {
    render(<AddQuestionsTab domains={domains} />);
    await userEvent.click(screen.getByText("Fill in the blank"));
    expect(screen.getByText("fill a")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Coding"));
    expect(screen.getByText("coding a")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } });
    expect(screen.getByText("coding b")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Multiple choice"));
    expect(screen.getByText("mcq b Beta")).toBeInTheDocument();
  });

  it("copes with no domains", () => {
    render(<AddQuestionsTab domains={[]} />);
    expect(screen.getByText(/^mcq/)).toBeInTheDocument();
  });
});
