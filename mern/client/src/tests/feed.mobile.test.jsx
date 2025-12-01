// src/tests/feed.mobile.test.jsx
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
import RecommendationFeed from "../components/RecommendationFeed.jsx";

// Mock componenets so tests focus on layout / behavior ---

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
      <span>Feed Nav</span>
    </header>
  ),
}));

describe("RecommendationFeed page – mobile-friendly behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();

    // Empty watched list the feed will show “your watched list is empty” and does not hit /feed
    window.localStorage.setItem("watched", JSON.stringify([]));

    global.fetch = vi.fn();
  });

  function renderFeed() {
    return render(
      <MemoryRouter initialEntries={["/feed"]}>
        <RecommendationFeed />
      </MemoryRouter>
    );
  }

  it("renders mobile layout with sidebar and mocked navigation", async () => {
    renderFeed();

    const sidebar = document.querySelector(".sidebar");
    const mainContainer = document.querySelector(".main-container");

    expect(sidebar).toBeInTheDocument();
    expect(mainContainer).toBeInTheDocument();

    // Navigation mock present
    expect(screen.getByText(/Feed Nav/i)).toBeInTheDocument();

    // Status message for empty watched list (may be rendered twice, so use getAllByText)
    await waitFor(() => {
      const emptyMsgs = screen.getAllByText(/Your watched list is empty/i);
      expect(emptyMsgs.length).toBeGreaterThan(0);
    });

    // Overlay should NOT be visible initially
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();

    // With empty watched list we should not hit /feed
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows core filters and rebuild controls (limit input + REBUILD FEED button)", () => {
    renderFeed();

    // Limit input (React strict mode may render twice)
    const limitInputs = screen.getAllByPlaceholderText(/LIMIT…/i);
    expect(limitInputs.length).toBeGreaterThan(0);

    // Rebuild FEED button (may also be duplicated)
    const rebuildButtons = screen.getAllByRole("button", {
      name: /rebuild feed/i,
    });
    expect(rebuildButtons.length).toBeGreaterThan(0);
  });

  it("shows TMDB attribution footer on the feed page", () => {
    renderFeed();

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

  it("shows empty-feed status text when no watched movies are stored", async () => {
    renderFeed();

    await waitFor(() => {
      const emptyMsgs = screen.getAllByText(/Your watched list is empty/i);
      expect(emptyMsgs.length).toBeGreaterThan(0);
    });
  });

  it("toggles sidebar overlay when the mocked navigation toggle is clicked (mobile menu)", async () => {
    renderFeed();

    // Initial overlay is hidden
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();

    // If multiple toggle buttons exist, grab the first
    const toggleButtons = screen.getAllByRole("button", {
      name: /toggle sidebar/i,
    });
    expect(toggleButtons.length).toBeGreaterThan(0);
    const toggleButton = toggleButtons[0];

    // click once - overlay appears
    await fireEvent.click(toggleButton);
    expect(document.querySelector(".sidebar-overlay")).toBeInTheDocument();

    // click again - overlay disappears
    await fireEvent.click(toggleButton);
    expect(document.querySelector(".sidebar-overlay")).not.toBeInTheDocument();
  });
});
