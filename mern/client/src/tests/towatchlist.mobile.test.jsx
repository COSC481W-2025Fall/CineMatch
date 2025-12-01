// src/tests/towatchlist.mobile.test.jsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ToWatchListPage from "../components/ToWatchList.jsx"; 

// Mocks to keep tests focused on layout/behavior 

vi.mock("../components/MovieDetails.jsx", () => ({
  default: () => <div data-testid="movie-details">MovieDetails</div>,
}));

vi.mock("../components/Navigation.jsx", () => ({
  default: ({ sidebarCollapsed, setSidebarCollapsed }) => (
    <header>
      <button
        type="button"
        aria-label="Toggle Sidebar"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        Toggle Sidebar
      </button>
      <span>To-Watch Nav</span>
    </header>
  ),
}));

describe("ToWatchList page – mobile-friendly behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();

    // Empty to-watch list by default
    window.localStorage.setItem("to-watch", JSON.stringify([]));

    global.fetch = vi.fn();
  });

  function renderToWatch() {
    return render(
      <MemoryRouter initialEntries={["/to-watch-list"]}>
        <ToWatchListPage />
      </MemoryRouter>
    );
  }

  it("renders mobile layout with sidebar collapsed and mocked navigation", async () => {
    renderToWatch();

    const sidebar = document.querySelector(".sidebar");
    const mainContainer = document.querySelector(".main-container");

    expect(sidebar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);

    // Navigation mock present
    expect(screen.getByText(/To-Watch Nav/i)).toBeInTheDocument();

    // Status text for empty to-watch list
    await waitFor(() => {
      const msgs = screen.getAllByText(/Your to-watch list is empty/i);
      expect(msgs.length).toBeGreaterThan(0);
    });

    // With empty to-watch list, /record/bulk should NOT be called
    expect(global.fetch).not.toHaveBeenCalled();

    // Overlay is hidden initially
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });

  it("shows core filters and search/clear controls", () => {
    renderToWatch();

    // multiple renders in StrictMode - use *AllBy* queries

    const actorInputs = screen.getAllByPlaceholderText("ACTOR...");
    expect(actorInputs.length).toBeGreaterThan(0);

    const directorInputs = screen.getAllByPlaceholderText("DIRECTOR...");
    expect(directorInputs.length).toBeGreaterThan(0);

    const titleInputs = screen.getAllByPlaceholderText("TITLE...");
    expect(titleInputs.length).toBeGreaterThan(0);

    // Genre select label
    const genreOptions = screen.getAllByText(/GENRE\.\.\./i);
    expect(genreOptions.length).toBeGreaterThan(0);

    const searchButtons = screen.getAllByRole("button", { name: /search/i });
    expect(searchButtons.length).toBeGreaterThan(0);

    const clearButtons = screen.getAllByRole("button", { name: /clear/i });
    expect(clearButtons.length).toBeGreaterThan(0);
  });

  it("shows TMDB attribution footer on the To-Watch page", () => {
    renderToWatch();

    const sidebar = document.querySelector(".sidebar");
    expect(sidebar).toBeInTheDocument();
    const side = within(sidebar);

    const srcNodes = side.getAllByText(/Source of data/i);
    expect(srcNodes.length).toBeGreaterThan(0);

    const tmdbNodes = side.getAllByText(/TMDB/i);
    expect(tmdbNodes.length).toBeGreaterThan(0);

    const disclaimerNodes = side.getAllByText(
      /This website uses TMDB and the TMDB APIs/i
    );
    expect(disclaimerNodes.length).toBeGreaterThan(0);
  });

  it("shows empty to-watch status when there are no movies stored", async () => {
    renderToWatch();

    await waitFor(() => {
      const msgs = screen.getAllByText(/Your to-watch list is empty/i);
      expect(msgs.length).toBeGreaterThan(0);
    });
  });

  it("toggles sidebar overlay when the mocked navigation toggle is clicked (mobile menu)", async () => {
    renderToWatch();

    const mainContainer = document.querySelector(".main-container");
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();

    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(toggleButtons.length).toBeGreaterThan(0);
    const toggleButton = toggleButtons[0];

    // Click once - expand sidebar, overlay appears
    await fireEvent.click(toggleButton);
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(false);
    expect(document.querySelector(".sidebar-overlay")).toBeInTheDocument();

    // Click again - collapse sidebar, overlay disappears
    await fireEvent.click(toggleButton);
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });
});
