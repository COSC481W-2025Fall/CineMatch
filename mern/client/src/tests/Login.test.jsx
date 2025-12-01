// src/tests/Login.test.jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../components/Login.jsx";

// Mock the auth context
const loginMock = vi.fn();

vi.mock("../auth/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: null,
    status: "anon",
    login: loginMock,
  }),
}));

// Helpers

function getEmailInput() {
  return (
    screen.getByLabelText(/email/i) ||
    screen.getByPlaceholderText(/email/i)
  );
}

function getPasswordInput() {
  const el = document.getElementById("password");
  if (!el) {
    throw new Error("Could not find password input with id='password'");
  }
  return el;
}

function getSubmitButton() {
  return screen.getByRole("button", {
    name: /sign in|log in|login/i,
  });
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

// Tests

describe("Login page (AuthContext-based)", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  // 1) Basic render test
  it("renders heading, fields, and auth links", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: /log in/i })
    ).toBeInTheDocument();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // Links to Register and Forgot Password
    expect(
      screen.getByRole("link", { name: /create an account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /reset password/i })
    ).toBeInTheDocument();
  });

  // 2) Validation: empty email and password
  it("shows validation error when submitting with empty email and password", async () => {
    renderLogin();

    const submitButton = getSubmitButton();
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(
      /please enter email and password\./i
    );
    expect(errorNode).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  // 3) Validation: email filled and password empty
  it("shows validation error and does not call login when password is missing", async () => {
    renderLogin();

    const emailInput = getEmailInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, {
      target: { value: "test@example.com" },
    });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(
      /please enter email and password\./i
    );
    expect(errorNode).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  // 4) Password show/hide toggle
  it("toggles password visibility when Show/Hide is clicked", () => {
    renderLogin();

    const pwInput = getPasswordInput();

    // Initial state: hidden
    expect(pwInput.type).toBe("password");

    const showButton = screen.getByRole("button", {
      name: /show password|show/i,
    });

    // Click once then show
    fireEvent.click(showButton);
    expect(pwInput.type).toBe("text");

    // Button label should now be "Hide"
    const hideButton = screen.getByRole("button", {
      name: /hide password|hide/i,
    });
    fireEvent.click(hideButton);
    expect(pwInput.type).toBe("password");
  });

  // 5) Busy state: button disabled and 'Signing in…'
  it("disables submit and shows 'Signing in…' while login is in progress", async () => {
    // login never resolves, so component stays busy
    loginMock.mockImplementation(
      () => new Promise(() => {})
    );

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, {
      target: { value: "test@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "Password123!" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });

    const busyButton = await screen.findByRole("button", {
      name: /signing in/i,
    });
    expect(busyButton).toBeDisabled();
  });

  // 6) Button re-enabled after a failed login
  it("re-enables submit button after login error", async () => {
    const ERROR_TEXT = "Invalid credentials";
    loginMock.mockRejectedValueOnce(new Error(ERROR_TEXT));

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "WrongPassword!!" },
    });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(ERROR_TEXT);
    expect(errorNode).toBeInTheDocument();

    const buttonAfter = getSubmitButton();
    expect(buttonAfter).toBeEnabled();
    expect(buttonAfter).toHaveTextContent(/sign in/i);
  });

  // 7) Calls auth.login with email and password on submit
  it("calls auth.login with email + password on submit", async () => {
    const email = `login+${Date.now()}@example.com`;
    const password = "Password123!";

    loginMock.mockResolvedValueOnce(undefined);

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });

    expect(loginMock).toHaveBeenCalledWith({
      email,
      password,
    });
  });

  // 8) Email-not-verified error
  it("shows error message from auth.login when email is not verified", async () => {
    const email = `verify+${Date.now()}@example.com`;
    const password = "Password123!";
    const ERROR_TEXT =
      "Please verify your email address before logging in. Check your inbox (and spam folder).";

    loginMock.mockRejectedValueOnce(new Error(ERROR_TEXT));

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(ERROR_TEXT);
    expect(errorNode).toBeInTheDocument();
  });

  // 9) Invalid credentials error
  it("shows error message from auth.login when credentials are invalid", async () => {
    const email = `badpw+${Date.now()}@example.com`;
    const password = "WrongPassword!!";
    const ERROR_TEXT = "Invalid credentials";

    loginMock.mockRejectedValueOnce(new Error(ERROR_TEXT));

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(ERROR_TEXT);
    expect(errorNode).toBeInTheDocument();
  });

  // 10) Clears error after success
  it("clears the previous error after a successful login", async () => {
    const email = `clear+${Date.now()}@example.com`;
    const password = "Password123!";
    const ERROR_TEXT = "Invalid credentials";

    loginMock
      .mockRejectedValueOnce(new Error(ERROR_TEXT))
      .mockResolvedValueOnce(undefined);

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    // First submit - error
    fireEvent.change(emailInput, { target: { value: email } });
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(ERROR_TEXT);
    expect(errorNode).toBeInTheDocument();

    // Second submit - success then error cleared
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    });

    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  // 11) No error message initially
  it("does not show any error message before submitting", () => {
    renderLogin();

    expect(
      screen.queryByText(/please enter email and password\./i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/invalid credentials/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/login failed/i)
    ).not.toBeInTheDocument();
  });

  // 12) Generic fallback error text when login throws without message
  it('shows "Login failed." when auth.login rejects without a message', async () => {
    loginMock.mockRejectedValueOnce({}); // no message

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, {
      target: { value: "test@example.com" },
    });
    fireEvent.change(passwordInput, {
      target: { value: "Password123!" },
    });
    fireEvent.click(submitButton);

    const errorNode = await screen.findByText(/login failed\./i);
    expect(errorNode).toBeInTheDocument();
  });

  // 13) Trims spaces from email before calling login
  it("trims whitespace from email before calling auth.login", async () => {
    const emailRaw = "  spaced@example.com  ";
    const emailTrimmed = "spaced@example.com";
    const password = "Password123!";

    loginMock.mockResolvedValueOnce(undefined);

    renderLogin();

    const emailInput = getEmailInput();
    const passwordInput = getPasswordInput();
    const submitButton = getSubmitButton();

    fireEvent.change(emailInput, {
      target: { value: emailRaw },
    });
    fireEvent.change(passwordInput, {
      target: { value: password },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1);
    });

    expect(loginMock).toHaveBeenCalledWith({
      email: emailTrimmed,
      password,
    });
  });

  // 14) Password toggle updates aria-label appropriately
  it("updates the password toggle aria-label between Show and Hide", () => {
    renderLogin();

    const toggle = screen.getByRole("button", {
      name: /show password|show/i,
    });
    expect(toggle).toHaveAttribute("aria-label", expect.stringMatching(/show/i));

    fireEvent.click(toggle);

    const toggleAfter = screen.getByRole("button", {
      name: /hide password|hide/i,
    });
    expect(toggleAfter).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/hide/i)
    );
  });

  // 15) Register/reset links have correct hrefs
  it("links to /register and /forgot-password", () => {
    renderLogin();

    const registerLink = screen.getByRole("link", {
      name: /create an account/i,
    });
    const resetLink = screen.getByRole("link", {
      name: /reset password/i,
    });

    expect(registerLink).toHaveAttribute("href", "/register");
    expect(resetLink).toHaveAttribute("href", "/forgot-password");
  });
});
