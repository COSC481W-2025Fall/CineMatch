// src/tests/watchlist.mobile.test.jsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WatchListPage from "../components/WatchList.jsx";

// Mock Components 

// Keep MovieDetails simple
vi.mock("../components/MovieDetails.jsx", () => ({
  default: () => <div data-testid="movie-details">MovieDetails</div>,
}));

// Mock Navigation 
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

describe("WatchList page – mobile-friendly behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();

    // Mock fetch (WatchList may call /record/bulk or details)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  function renderWatchList() {
    return render(
      <MemoryRouter initialEntries={["/watchlist"]}>
        <WatchListPage />
      </MemoryRouter>
    );
  }

  it("renders mobile layout with sidebar collapsed and mocked navigation", () => {
    renderWatchList();

    const sidebar = document.querySelector(".sidebar");
    const mainContainer = document.querySelector(".main-container");
    expect(sidebar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();

    // Mobile default: collapsed sidebar
    expect(mainContainer.classList.contains("sidebar-collapsed")).toBe(true);

    // Mocked nav header is visible
    expect(screen.getByText(/CineMatch Nav/i)).toBeInTheDocument();
  });

  it("shows empty-watchlist status text when no movies are stored", async () => {
    renderWatchList();

    // Status starts as "Loading…", then becomes "Your watch list is empty."
    await waitFor(() => {
      expect(
        screen.getAllByText(/Your watch list is empty\./i).length
      ).toBeGreaterThan(0);
    });

    // Since localStorage 'watched' is empty, we should not need any fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows core filters and search/clear controls", () => {
    renderWatchList();

    // Inputs 
    expect(
      screen.getAllByPlaceholderText("ACTOR...").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText("DIRECTOR...").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText("GENRE...").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText("TITLE...").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText("YEAR...").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText("RATING...").length
    ).toBeGreaterThan(0);

    // Dropdown for genres 
    const genreOptions = screen.getAllByText("GENRE...");
    expect(genreOptions.length).toBeGreaterThan(0);

    // Buttons 
    expect(
      screen.getAllByRole("button", { name: /search/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /clear/i }).length
    ).toBeGreaterThan(0);
  });

  it("shows TMDB attribution footer on the WatchList page", () => {
    renderWatchList();

    expect(screen.getAllByText(/Source of data/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TMDB/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/This website uses TMDB and the TMDB APIs/i).length
    ).toBeGreaterThan(0);
  });

  it("toggles sidebarCollapsed when the mocked navigation toggle is clicked (mobile menu)", () => {
    renderWatchList();

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
