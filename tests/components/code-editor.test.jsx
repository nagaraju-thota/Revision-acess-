import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const captured = {};
vi.mock("@uiw/react-codemirror", () => ({
  default: (props) => {
    Object.assign(captured, props);
    return <textarea data-testid="cm" value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
  },
}));

import CodeEditor from "../../src/components/Shared/CodeEditor";

describe("CodeEditor", () => {
  it.each(["javascript", "python", "java", "cpp"])("adds a syntax extension for %s", (language) => {
    render(<CodeEditor value="x" onChange={() => {}} language={language} />);
    expect(captured.extensions).toHaveLength(1);
    expect(captured.height).toBe("300px");
  });

  it("uses no extension for an unknown language and honours a custom height", () => {
    render(<CodeEditor value="x" onChange={() => {}} language="ruby" height="120px" />);
    expect(captured.extensions).toEqual([]);
    expect(captured.height).toBe("120px");
    expect(screen.getByTestId("cm")).toHaveValue("x");
  });
});
