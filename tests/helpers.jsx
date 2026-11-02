import { render } from "@testing-library/react";
import { BrandProvider } from "../src/context/BrandContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { ToastProvider } from "../src/context/ToastContext";

// Renders a component inside the same providers App.jsx wraps everything in.
export function renderWithProviders(ui) {
  return render(
    <ThemeProvider>
      <BrandProvider>
        <ToastProvider>{ui}</ToastProvider>
      </BrandProvider>
    </ThemeProvider>
  );
}

export const passwordInput = (container) => container.querySelector('input[type="password"]');
