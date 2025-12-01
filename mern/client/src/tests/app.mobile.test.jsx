// src/tests/app.mobile.test.jsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

// Mock components

vi.mock("../components/MovieDetails.jsx", () => ({
  default: () => <div data-testid="movie-details">MovieDetails</div>,
}));

vi.mock("../components/ErrorModal.jsx", () => ({
  default: ({ message }) =>
    message ? <div data-testid="error-modal">{message}</div> : null,
}));

vi.mock("../components/Navigation.jsx", () => ({
  default: ({ sidebarCollapsed, setSidebarCollapsed }) => (
    <header>
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        Toggle Sidebar
      </button>
      <span>CineMatch Nav</span>
    </header>
  ),
}));

describe("App (Search page) mobile-friendly behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();

    // Fetch mock so App can call doSearch() without crashing
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  function renderApp() {
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
  }

  it("renders the main mobile layout (sidebar + content area)", async () => {
    renderApp();

    const sidebar = document.querySelector(".sidebar");
    const mainContainer = document.querySelector(".main-container");
    expect(sidebar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();

    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);

    expect(screen.getByText(/CineMatch Nav/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it("shows the core search controls (actor, director, title, year, rating, genre buttons)", () => {
    renderApp();

    // ACTOR (may appear twice, so use getAllBy...)
    const actorInputs = screen.getAllByPlaceholderText("ACTOR...");
    expect(actorInputs.length).toBeGreaterThan(0);

    // DIRECTOR
    const directorInputs = screen.getAllByPlaceholderText("DIRECTOR...");
    expect(directorInputs.length).toBeGreaterThan(0);

    // TITLE
    const titleInputs = screen.getAllByPlaceholderText("TITLE...");
    expect(titleInputs.length).toBeGreaterThan(0);

    // year & rating labels
    expect(screen.getAllByText(/YEAR/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RATING \(0–10\)/i).length).toBeGreaterThan(0);

    // MIN / MAX fields (may be duplicated)
    const minInputs = screen.getAllByPlaceholderText("MIN");
    const maxInputs = screen.getAllByPlaceholderText("MAX");
    expect(minInputs.length).toBeGreaterThan(0);
    expect(maxInputs.length).toBeGreaterThan(0);

    // Search & clear buttons (may be duplicated)
    expect(
      screen.getAllByRole("button", { name: /search/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /clear/i }).length
    ).toBeGreaterThan(0);

    expect(screen.getAllByText(/GENRE/i).length).toBeGreaterThan(0);
  });

  it("shows TMDB attribution footer", () => {
    renderApp();

    // Footer texts can appear multiple times due to strict mode
    expect(screen.getAllByText(/Source of data/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TMDB/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/This website uses TMDB and the TMDB APIs/i).length
    ).toBeGreaterThan(0);
  });

  it("performs an initial search and shows 'No results found.' when API returns empty list", async () => {
    renderApp();

    // Loading text appears
    expect(screen.getAllByText(/Loading/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Our mock returns [], so App should eventually show "No results found."
    await waitFor(() => {
      expect(
        screen.getAllByText(/No results found\./i).length
      ).toBeGreaterThan(0);
    });
  });

  it("clears filters and triggers a new search when CLEAR is pressed", async () => {
    renderApp();

    const actorInputs = screen.getAllByPlaceholderText("ACTOR...");
    const actorInput = actorInputs[0];

    const searchButtons = screen.getAllByRole("button", { name: /search/i });
    const clearButtons = screen.getAllByRole("button", { name: /clear/i });
    const searchButton = searchButtons[0];
    const clearButton = clearButtons[0];

    // Type into actor field
    fireEvent.change(actorInput, { target: { value: "Tom Hanks" } });
    expect(actorInput).toHaveValue("Tom Hanks");

    // click SEARCH – just make sure it doesn't crash
    fireEvent.click(searchButton);
    expect(global.fetch).toHaveBeenCalled();

    // click CLEAR – input should be reset
    fireEvent.click(clearButton);
    expect(actorInput).toHaveValue("");
  });

  it("toggles the sidebarCollapsed state when the navigation toggle is clicked (simulating mobile menu)", () => {
    renderApp();

    const mainContainer = document.querySelector(".main-container");
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);

    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    const toggleButton = toggleButtons[0];

    fireEvent.click(toggleButton);
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(false);

    fireEvent.click(toggleButton);
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);
  });
});
