import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({
  api: {
    addDomain: vi.fn(),
    updateDomain: vi.fn(),
    deleteDomain: vi.fn(),
    getExamSchedule: vi.fn(),
    setExamSchedule: vi.fn(),
    setStudentOverride: vi.fn(),
  },
}));

import { api } from "../../src/api/client";
import AddDomainTab from "../../src/components/Admin/AddDomainTab";
import ExamScheduleTab from "../../src/components/Admin/ExamScheduleTab";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

const type = (el, value) => fireEvent.change(el, { target: { value } });

describe("AddDomainTab - add form", () => {
  it("auto-fills the id from the name until the id is edited manually", async () => {
    renderWithProviders(<AddDomainTab domains={[]} />);
    const name = screen.getByPlaceholderText("e.g. DevOps");
    const id = screen.getByPlaceholderText("devops");
    type(name, "  Cloud & DevOps!  ");
    expect(id).toHaveValue("cloud-devops");
    type(id, "custom-id");
    type(name, "Another Name");
    expect(id).toHaveValue("custom-id");
  });

  it("validates name and minutes", async () => {
    renderWithProviders(<AddDomainTab domains={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    expect(screen.getByText("Domain name is required.")).toBeInTheDocument();
    type(screen.getByPlaceholderText("e.g. DevOps"), "X");
    type(screen.getByRole("spinbutton"), "0");
    // fireEvent.submit bypasses the browser's native min=1 validation, which would otherwise block the submit
    fireEvent.submit(screen.getByRole("button", { name: "Add domain" }).closest("form"));
    expect(screen.getByText(/greater than 0/)).toBeInTheDocument();
    expect(api.addDomain).not.toHaveBeenCalled();
  });

  it("creates a domain, shows the confirmation and resets the form", async () => {
    api.addDomain.mockResolvedValue({ domain: { id: "devops", name: "DevOps" } });
    const onAdded = vi.fn();
    renderWithProviders(<AddDomainTab domains={[]} onAdded={onAdded} />);
    type(screen.getByPlaceholderText("e.g. DevOps"), "DevOps");
    type(screen.getByPlaceholderText("What this domain covers"), " Pipelines ");
    type(screen.getByRole("spinbutton"), "30");
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() =>
      expect(api.addDomain).toHaveBeenCalledWith({ id: "devops", name: "DevOps", description: "Pipelines", duration: 1800 })
    );
    expect(await screen.findByText(/Added "DevOps" \(devops\)/)).toBeInTheDocument();
    expect(onAdded).toHaveBeenCalled();
    expect(screen.getByPlaceholderText("e.g. DevOps")).toHaveValue("");
  });

  it("sends an undefined id when it was cleared, and works without onAdded", async () => {
    api.addDomain.mockResolvedValue({ domain: { id: "x", name: "X" } });
    renderWithProviders(<AddDomainTab domains={[]} />);
    type(screen.getByPlaceholderText("e.g. DevOps"), "X");
    type(screen.getByPlaceholderText("devops"), "  ");
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() => expect(api.addDomain).toHaveBeenCalled());
    expect(api.addDomain.mock.calls[0][0].id).toBeUndefined();
  });

  it("shows API errors", async () => {
    api.addDomain.mockRejectedValue(new Error("Duplicate id"));
    renderWithProviders(<AddDomainTab domains={[]} />);
    type(screen.getByPlaceholderText("e.g. DevOps"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add domain" }));
    expect((await screen.findAllByText("Duplicate id")).length).toBeGreaterThan(0);
  });
});

describe("AddDomainTab - existing domain rows", () => {
  const domains = [
    { id: "fe", name: "Frontend", description: "UI", questionCount: 4, duration: 1200 },
    { id: "be", name: "Backend", description: "", questionCount: 2, duration: 600 },
  ];

  it("lists domains, with a fallback description", () => {
    renderWithProviders(<AddDomainTab domains={domains} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("4 questions · 20 min")).toBeInTheDocument();
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("edits and saves a domain", async () => {
    api.updateDomain.mockResolvedValue({});
    const onAdded = vi.fn();
    renderWithProviders(<AddDomainTab domains={domains} onAdded={onAdded} />);
    await userEvent.click(screen.getAllByText("Edit")[0]);
    type(screen.getByDisplayValue("Frontend"), " Front ");
    type(screen.getByDisplayValue("UI"), " New ");
    type(screen.getAllByRole("spinbutton")[0], "25"); // the edit row renders above the add form
    await userEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(api.updateDomain).toHaveBeenCalledWith("fe", { name: "Front", description: "New", duration: 1500 }));
    expect(await screen.findByText('Updated "Front"')).toBeInTheDocument();
    expect(onAdded).toHaveBeenCalled();
  });

  it("validates while editing, and can cancel", async () => {
    renderWithProviders(<AddDomainTab domains={domains} />);
    await userEvent.click(screen.getAllByText("Edit")[0]);
    type(screen.getAllByRole("textbox")[0], " ");
    await userEvent.click(screen.getByText("Save"));
    expect(screen.getByText("Domain name is required.")).toBeInTheDocument();
    type(screen.getAllByRole("textbox")[0], "Frontend");
    type(screen.getAllByRole("spinbutton")[0], "-5");
    await userEvent.click(screen.getByText("Save"));
    expect(screen.getByText(/greater than 0/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(api.updateDomain).not.toHaveBeenCalled();
  });

  it("shows update errors", async () => {
    api.updateDomain.mockRejectedValue(new Error("Update failed"));
    renderWithProviders(<AddDomainTab domains={domains} />);
    await userEvent.click(screen.getAllByText("Edit")[0]);
    await userEvent.click(screen.getByText("Save"));
    expect((await screen.findAllByText("Update failed")).length).toBeGreaterThan(0);
  });

  it("confirms before deleting, can cancel, and deletes", async () => {
    api.deleteDomain.mockResolvedValue({});
    const onAdded = vi.fn();
    renderWithProviders(<AddDomainTab domains={domains} onAdded={onAdded} />);
    await userEvent.click(screen.getAllByText("Delete")[0]);
    expect(screen.getByText("Delete this domain?")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Cancel delete"));
    expect(screen.queryByText("Delete this domain?")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByText("Delete")[0]);
    await userEvent.click(screen.getByText("Confirm"));
    await waitFor(() => expect(api.deleteDomain).toHaveBeenCalledWith("fe"));
    expect(await screen.findByText('Deleted "Frontend"')).toBeInTheDocument();
    expect(onAdded).toHaveBeenCalled();
  });

  it("shows delete errors and leaves the confirmation", async () => {
    api.deleteDomain.mockRejectedValue(new Error("Has results"));
    renderWithProviders(<AddDomainTab domains={domains} />);
    await userEvent.click(screen.getAllByText("Delete")[0]);
    await userEvent.click(screen.getByText("Confirm"));
    expect((await screen.findAllByText("Has results")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Delete this domain?")).not.toBeInTheDocument();
  });
});

describe("ExamScheduleTab", () => {
  it("loads an existing schedule", async () => {
    api.getExamSchedule.mockResolvedValue({ schedule: { startTime: "2026-03-04T10:30:00.000Z", graceMinutes: 15 } });
    renderWithProviders(<ExamScheduleTab />);
    expect(screen.getByText("Loading schedule…")).toBeInTheDocument();
    expect(await screen.findByText(/Currently open from/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(15);
    expect(document.querySelector('input[type="datetime-local"]').value).toMatch(/^2026-03-0[34]T\d\d:\d\d$/);
  });

  it("shows the no-schedule state with defaults", async () => {
    api.getExamSchedule.mockResolvedValue({});
    renderWithProviders(<ExamScheduleTab />);
    expect(await screen.findByText(/No schedule set/)).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue(0);
  });

  it("shows a load error", async () => {
    api.getExamSchedule.mockRejectedValue(new Error("Load failed"));
    renderWithProviders(<ExamScheduleTab />);
    expect(await screen.findByText("Load failed")).toBeInTheDocument();
  });

  it("validates before saving", async () => {
    api.getExamSchedule.mockResolvedValue({});
    renderWithProviders(<ExamScheduleTab />);
    await screen.findByText(/No schedule set/);
    await userEvent.click(screen.getByText("Save schedule"));
    expect(screen.getByText(/Pick a start time/)).toBeInTheDocument();
    type(screen.getByRole("spinbutton"), "-3");
    await userEvent.click(screen.getByText("Save schedule"));
    expect(screen.getByText(/non-negative/)).toBeInTheDocument();
    expect(api.setExamSchedule).not.toHaveBeenCalled();
  });

  it("saves a schedule, then clears it", async () => {
    api.getExamSchedule.mockResolvedValue({});
    api.setExamSchedule.mockResolvedValueOnce({ schedule: { startTime: "2026-05-01T09:00:00.000Z", graceMinutes: 5 } });
    api.setExamSchedule.mockResolvedValueOnce({ schedule: null });
    renderWithProviders(<ExamScheduleTab />);
    await screen.findByText(/No schedule set/);
    type(document.querySelector('input[type="datetime-local"]'), "2026-05-01T09:00");
    type(screen.getByRole("spinbutton"), "5");
    await userEvent.click(screen.getByText("Save schedule"));
    expect(await screen.findByText("Exam schedule saved.")).toBeInTheDocument();
    expect(api.setExamSchedule.mock.calls[0][0]).toMatchObject({ graceMinutes: 5 });
    expect(typeof api.setExamSchedule.mock.calls[0][0].startTime).toBe("string");

    await userEvent.click(screen.getByText("Clear (open exams now)"));
    expect(await screen.findByText(/exams are open now/)).toBeInTheDocument();
    expect(api.setExamSchedule.mock.calls[1][0].startTime).toBeNull();
    expect(document.querySelector('input[type="datetime-local"]').value).toBe("");
  });

  it("treats a blank grace period as 0 and shows save errors", async () => {
    api.getExamSchedule.mockResolvedValue({});
    api.setExamSchedule.mockRejectedValue(new Error("Save failed"));
    renderWithProviders(<ExamScheduleTab />);
    await screen.findByText(/No schedule set/);
    type(document.querySelector('input[type="datetime-local"]'), "2026-05-01T09:00");
    type(screen.getByRole("spinbutton"), "");
    await userEvent.click(screen.getByText("Save schedule"));
    expect((await screen.findAllByText("Save failed")).length).toBeGreaterThan(0);
    expect(api.setExamSchedule.mock.calls[0][0].graceMinutes).toBe(0);
  });

  it("grants and revokes a per-student override", async () => {
    api.getExamSchedule.mockResolvedValue({});
    api.setStudentOverride.mockResolvedValue({});
    renderWithProviders(<ExamScheduleTab />);
    await screen.findByText(/No schedule set/);
    await userEvent.click(screen.getByText(/Grant access/));
    expect(screen.getByText(/Enter an Employee\/Student ID first/)).toBeInTheDocument();

    type(screen.getByPlaceholderText("Employee / Student ID"), " emp1 ");
    await userEvent.click(screen.getByText(/Grant access/));
    expect(await screen.findByText(/EMP1 can now start the exam/)).toBeInTheDocument();
    expect(api.setStudentOverride).toHaveBeenCalledWith("EMP1", true);

    await userEvent.click(screen.getByText(/Revoke/));
    expect(await screen.findByText(/EMP1's override access was revoked/)).toBeInTheDocument();
    expect(screen.getByText("Override revoked for EMP1.")).toBeInTheDocument();
  });

  it("shows override errors", async () => {
    api.getExamSchedule.mockResolvedValue({});
    api.setStudentOverride.mockRejectedValue(new Error("No such student"));
    renderWithProviders(<ExamScheduleTab />);
    await screen.findByText(/No schedule set/);
    type(screen.getByPlaceholderText("Employee / Student ID"), "zzz");
    await userEvent.click(screen.getByText(/Grant access/));
    expect((await screen.findAllByText("No such student")).length).toBeGreaterThan(0);
  });
});
