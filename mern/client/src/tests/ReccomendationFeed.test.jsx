import React from "react";
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecommendationFeed from "../components/RecommendationFeed";
import { MemoryRouter } from "react-router-dom";

beforeAll(() => {
  global.localStorage = {
    store: {},
    getItem(key) {
      return this.store[key] || null;
    },
    setItem(key, value) {
      this.store[key] = value.toString();
    },
    removeItem(key) {
      delete this.store[key];
    },
    clear() {
      this.store = {};
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  global.fetch = vi.fn();
});

describe("RecommendationFeed", () => {

  
  // Test 1: navigation renders
  it("renders navigation items", () => {
    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    expect(screen.getByText("SEARCH")).toBeInTheDocument();
    expect(screen.getByText("HELP")).toBeInTheDocument();
    expect(screen.getByText("FEED")).toBeInTheDocument();
  });

  // Test 2: no watched movies
  it("shows empty watched message when no watched movies", async () => {
    localStorage.setItem("watched", JSON.stringify([]));

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Your watched list is empty/i)
      ).toBeInTheDocument()
    );
  });

  // Test 3: successful recommendation fetch
  it("shows recommendations when fetch succeeds", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    const mockData = {
      items: [
        { tmdbId: 1, title: "Test Movie", year: 2025, rating: 9.0, posterPath: "/poster.jpg" },
      ],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("Test Movie")).toBeInTheDocument()
    );
  });

  // Test 4: fetch error
  it("shows error message when feed build fails", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));
    global.fetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Error building your feed/i)).toBeInTheDocument()
    );
  });

  // Test 5: fetch called once on mount
  it("calls /feed exactly once on mount", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledTimes(1)
    );
  });

  // Test 6: clicking a movie opens details
  it("opens MovieDetails modal when clicking a movie card", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    const rec = {
      tmdbId: 1,
      title: "Modal Movie",
      year: 2025,
      rating: 8.7,
      posterPath: "/poster.jpg",
      overview: "Great movie",
    };

    // fetch recommendations
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [rec] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("Modal Movie")).toBeInTheDocument()
    );

    // click card and fetch details
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1 }],
    });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Modal Movie", description: "Details" }),
    });

    fireEvent.click(screen.getByText("Modal Movie"));

    await waitFor(() =>
      expect(screen.getByText(/Modal Movie/i)).toBeInTheDocument()
    );
  });

  // Test 7: loading state
  it("shows loading indicator while fetching", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    global.fetch.mockResolvedValueOnce(new Promise(() => {})); // never resolves

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    expect(screen.getByText(/Building your feed/i)).toBeInTheDocument();
  });

  // Test 8: no recommendations returned
  it("shows 'no recommendations' message when feed empty", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByText(/No recommendations yet/i)
      ).toBeInTheDocument()
    );
  });

  // Test 9: default 20 movies displayed
    it("sends the correct POST body to /feed", async () => {
    localStorage.setItem("watched", JSON.stringify([5, 6]));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/feed",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            watchedIds: [5, 6],
            limit: 20,
          }),
        })
      )
    );
  });

  // Test 10: opening details fallback modal when no matching record, use provided rec data instead
  it("opens fallback MovieDetails when no backend match found", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    const rec = {
      tmdbId: 1,
      title: "Fallback Movie",
      year: 2024,
      overview: "test overview",
      posterPath: null,
    };

    // recommendations fetch
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [rec] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText("Fallback Movie")).toBeInTheDocument()
    );

    // first fetch /record?name=...
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [], // no match
    });

    fireEvent.click(screen.getByText("Fallback Movie"));

    await waitFor(() =>
      expect(screen.getByText(/Fallback Movie/i)).toBeInTheDocument()
    );
  });

  // test 11: poster fallback loads when posterPath is null
  it("uses placeholder when posterPath is null", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { tmdbId: 7, title: "NoPoster", year: 2020, rating: 7.7, posterPath: null }
        ]
      }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    const img = await screen.findByAltText("NoPoster");
    expect(img.src).toMatch(/placehold\.co/i);
  });

    // Test 12: sidebar is removed (feed page has no sidebar)
    it("does not render the sidebar on the feed page", () => {
    localStorage.setItem("watched", JSON.stringify([]));

    render(
        <MemoryRouter>
        <RecommendationFeed />
        </MemoryRouter>
    );

    // sidebar shouldn't exist
    const sidebar = screen.queryByTestId("sidebar") 
                    || document.querySelector(".sidebar");

    expect(sidebar).toBeNull();
    });


});
