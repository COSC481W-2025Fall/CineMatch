import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";    // utilities to render react components
import RecommendationFeed from "../components/RecommendationFeed";
import { MemoryRouter } from "react-router-dom";          // fake, self-contained router, not a real browser  


// mock localStorage setup
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

// clear mocks after each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  global.fetch = vi.fn();
});
// test suite
describe("RecommendationFeed", () => {

  // test 1 - render nav and sidebar  
  it("renders navigation and sidebar", () => {
    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    expect(screen.getByText("SEARCH")).toBeInTheDocument();
    expect(screen.getByText("HELP")).toBeInTheDocument();
    expect(screen.getByText("REBUILD FEED")).toBeInTheDocument();
  });
  // test 2 - no watched movies
  it("shows empty watched message when no watched movies", async () => {
    localStorage.setItem("watched", JSON.stringify([]));        // localStorage has empty list

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
  // test 3 - mock successful recommendation fetch
  it("shows recommendations when fetch succeeds", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));       // user watched one movie

    // mock recommendation
    const mockData = {
      items: [
        { tmdbId: 1, title: "Test Movie", year: 2025, rating: 9.0, posterPath: "/poster.jpg" },
      ],
    };
    // mock successful recommendation fetch 
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );
    // test movie displays as recommendation
    await waitFor(() => expect(screen.getByText("Test Movie")).toBeInTheDocument());
  });
  // test 4 - failed fetch error handling
  it("displays 'Error building your feed.' when fetch throws error", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));               // user watched one movie
    global.fetch.mockRejectedValueOnce(new Error("Network error"));     // mock failed fetch

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );

    await waitFor(() =>
      // show error message  
      expect(screen.getByText(/Error building your feed/i)).toBeInTheDocument()
    );
  });
  // test 5 - feed rebuild on click
  it("rebuilds feed when clicking REBUILD FEED", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));       // user watched one movie
    global.fetch.mockResolvedValueOnce({        // mock initial empty feed
      ok: true,
      json: async () => ({ items: [] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );
    // simulate clicking 'rebuild feed'
    const button = screen.getByText("REBUILD FEED");
    fireEvent.click(button);

    await waitFor(() =>
      // rebuild request to refresh recommendations  
      expect(global.fetch).toHaveBeenCalledWith(
        "/feed",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });
  // test 6 - simulate clicking movie to open modal and confirm modal shows movie info
  it("opens MovieDetails modal when clicking a movie card", async () => {
    localStorage.setItem("watched", JSON.stringify([1]));       // user watched one movie
    const rec = {   // fake movie to recommend
      tmdbId: 1,
      title: "Modal Movie",
      year: 2025,
      rating: 8.7,
      posterPath: "/poster.jpg",
      overview: "Great movie",
    };
    // refresh feed with fake movie
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [rec] }),
    });

    render(
      <MemoryRouter>
        <RecommendationFeed />
      </MemoryRouter>
    );
    // wait for movie card to render
    await waitFor(() => expect(screen.getByText("Modal Movie")).toBeInTheDocument());

    const card = screen.getByText("Modal Movie");
    global.fetch.mockResolvedValueOnce({    // simulate loading detailed info when movie clicked
      ok: true,
      json: async () => ({ id: 1, title: "Modal Movie", description: "Details" }),
    });
    // click movie
    fireEvent.click(card);
    
    // modal should appear
    await waitFor(() =>
      expect(screen.getByText(/Details|Modal Movie/)).toBeInTheDocument()
    );
  });
});
