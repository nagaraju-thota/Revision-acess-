import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { passwordInput, renderWithProviders } from "../helpers";

vi.mock("../../src/api/client", () => ({
  api: { studentLogin: vi.fn(), adminLogin: vi.fn(), registerStudent: vi.fn() },
}));

import { api } from "../../src/api/client";
import AdminLoginForm from "../../src/components/Login/AdminLoginForm";
import LoginPage from "../../src/components/Login/LoginPage";
import RegisterForm from "../../src/components/Login/RegisterForm";
import RegisterPage from "../../src/components/Login/RegisterPage";
import StudentLoginForm from "../../src/components/Login/StudentLoginForm";

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  localStorage.clear();
});

describe("StudentLoginForm", () => {
  it("requires both fields", async () => {
    const { container } = renderWithProviders(<StudentLoginForm onLogin={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText(/Enter your student\/employee ID and password/)).toBeInTheDocument();
    expect(api.studentLogin).not.toHaveBeenCalled();
    expect(passwordInput(container)).toBeInTheDocument();
  });

  it("logs in and passes the student up", async () => {
    api.studentLogin.mockResolvedValue({ student: { id: "S1", name: "Asha" } });
    const onLogin = vi.fn();
    const { container } = renderWithProviders(<StudentLoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByRole("textbox"), "S1");
    await userEvent.type(passwordInput(container), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: "S1", name: "Asha" }));
    expect(api.studentLogin).toHaveBeenCalledWith("S1", "pw");
  });

  it("shows the server error and a toast on failure", async () => {
    api.studentLogin.mockRejectedValue(new Error("Invalid credentials."));
    const { container } = renderWithProviders(<StudentLoginForm onLogin={() => {}} initialId="S1" />);
    expect(screen.getByRole("textbox")).toHaveValue("S1");
    await userEvent.type(passwordInput(container), "bad");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findAllByText("Invalid credentials.")).length).toBe(2); // inline + toast
  });

  it("only shows the register button when a handler is given", async () => {
    const onGoToRegister = vi.fn();
    const { unmount } = renderWithProviders(<StudentLoginForm onLogin={() => {}} />);
    expect(screen.queryByText(/Create an account/)).not.toBeInTheDocument();
    unmount();
    renderWithProviders(<StudentLoginForm onLogin={() => {}} onGoToRegister={onGoToRegister} />);
    await userEvent.click(screen.getByText(/Create an account/));
    expect(onGoToRegister).toHaveBeenCalled();
  });
});

describe("AdminLoginForm", () => {
  it("requires both fields", async () => {
    renderWithProviders(<AdminLoginForm onLogin={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    expect(screen.getByText(/Enter the admin ID and password/)).toBeInTheDocument();
  });

  it("logs in", async () => {
    api.adminLogin.mockResolvedValue({ admin: { id: "admin" } });
    const onLogin = vi.fn();
    const { container } = renderWithProviders(<AdminLoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByRole("textbox"), "admin");
    await userEvent.type(passwordInput(container), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: "admin" }));
  });

  it("shows errors", async () => {
    api.adminLogin.mockRejectedValue(new Error("Nope"));
    const { container } = renderWithProviders(<AdminLoginForm onLogin={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "admin");
    await userEvent.type(passwordInput(container), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    expect((await screen.findAllByText("Nope")).length).toBeGreaterThan(0);
  });
});

describe("RegisterForm", () => {
  const fill = async (container) => {
    await userEvent.type(screen.getByPlaceholderText("EMP1005"), "E1");
    await userEvent.type(screen.getByPlaceholderText("you@company.com"), "e@x.com");
    await userEvent.type(screen.getByPlaceholderText("Jane Doe"), "Jane");
    await userEvent.type(passwordInput(container), "secret1");
  };

  it("requires every field", async () => {
    renderWithProviders(<RegisterForm onRegistered={() => {}} onGoToLogin={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText(/Fill in every field/)).toBeInTheDocument();
  });

  it("registers and reports the new id", async () => {
    api.registerStudent.mockResolvedValue({ student: { id: "E1" } });
    const onRegistered = vi.fn();
    const { container } = renderWithProviders(<RegisterForm onRegistered={onRegistered} onGoToLogin={() => {}} />);
    await fill(container);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledWith("E1"));
    expect(api.registerStudent).toHaveBeenCalledWith({ id: "E1", email: "e@x.com", name: "Jane", password: "secret1" });
    expect(screen.getByText(/Account created/)).toBeInTheDocument();
  });

  it("shows API errors and supports going back to login", async () => {
    api.registerStudent.mockRejectedValue(new Error("ID already registered."));
    const onGoToLogin = vi.fn();
    const { container } = renderWithProviders(<RegisterForm onRegistered={() => {}} onGoToLogin={onGoToLogin} />);
    await fill(container);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect((await screen.findAllByText("ID already registered.")).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByText(/Already registered/));
    expect(onGoToLogin).toHaveBeenCalled();
  });
});

describe("pages", () => {
  it("LoginPage switches between student and admin tabs", async () => {
    renderWithProviders(<LoginPage onStudentLogin={() => {}} onAdminLogin={() => {}} onGoToRegister={() => {}} prefillStudentId="S9" />);
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("S9");
    await userEvent.click(screen.getByRole("button", { name: /Admin/ }));
    expect(screen.getByRole("button", { name: "Sign in as admin" })).toBeInTheDocument();
    expect(screen.queryByText("Step 2 of 2")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Student/ }));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("RegisterPage renders the registration form", () => {
    renderWithProviders(<RegisterPage onRegistered={() => {}} onGoToLogin={() => {}} />);
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
