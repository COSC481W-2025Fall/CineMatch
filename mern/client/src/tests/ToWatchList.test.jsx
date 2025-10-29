// src/tests/ToWatchList.test.jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";    // utilities to render react components
import ToWatchListPage from "../components/ToWatchList";
import { BrowserRouter } from "react-router-dom";           // wrap App to use React router for navigation

// mocks
beforeEach(() => {
  // mock the "to-watch" list in localStorage
  localStorage.setItem("to-watch", JSON.stringify([1]));

  // if URL contains /record/details/, return mocked movie object
  global.fetch = vi.fn((url) => {           // mock successful api call
    if (url.includes("/record/details/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            title: "Interstellar",
            year: 2014,
            genre: ["Adventure", "Drama", "Sci-Fi"],
            rating: 8.6,
          }),
      });
    }
    // mock general fetch for watchlist movies API
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            title: "Interstellar",
            year: 2014,
            genre: ["Adventure", "Drama", "Sci-Fi"],
            rating: 8.6,
            posterUrl: "https://test.poster/interstellar.jpg",
          },
        ]),
    });
  });
});
// clear mocks and localStorage after each test
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
// test suite
describe("ToWatchListPage", () => {
  // test 1 - initial loading state, render app in fake router and verify app shows loading indicator    
  it("renders initial loading state", () => {
    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });
  // test 2 - fetch and display movies, confirm data loading and rendering from mock api
  it("displays movies from to-watch list", async () => {
    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );

    // wait until Interstellar appears
    await waitFor(() => screen.getByText("Interstellar"));

    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText("2014 • Adventure, Drama, Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("⭐ 8.6")).toBeInTheDocument();
  });
  // test 3 - no movies in ToWatchlist show empty watchlist message
  it("shows empty message if no to-watch movies match", async () => {
    localStorage.setItem("to-watch", JSON.stringify([999])); // nonexistent movie

    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Your watch list is empty/i)
      ).toBeInTheDocument()
    );
  });
  // test 4 - api error handling, if fetch fails page should load "error loading results"
  it("handles fetch error gracefully", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Error loading results/i)).toBeInTheDocument()
    );
  });
  // test 5 - Search interaction, find input by placeholder, "TITLE", simulate typing "Interstellar", simulate clicking "SEARCH" button
  it("updates search filters and triggers new fetch", async () => {
    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );

    // wait for Interstellar to show
    await waitFor(() => screen.getByText("Interstellar"));
    // change title input
    const titleInput = screen.getByPlaceholderText(/TITLE.../i);
    fireEvent.change(titleInput, { target: { value: "Interstellar" } });
    // click the sidebar SEARCH button by role and text
    const searchButton = screen.getAllByRole("button", { name: /SEARCH/i })[0];
    fireEvent.click(searchButton);
    // ensure fetch called again
    expect(global.fetch).toHaveBeenCalled();
    expect(titleInput.value).toBe("Interstellar");
  });
  // test 6 - simulate clicking movie to open modal and confirm modal shows movie info
  it("opens MovieDetails modal when a movie is clicked", async () => {
    render(
      <BrowserRouter>
        <ToWatchListPage />
      </BrowserRouter>
    );

    // wait for movie card to render
    await waitFor(() => screen.getByText("Interstellar"));

    // click movie card
    const movieCard = screen.getByText("Interstellar").closest("article");
    fireEvent.click(movieCard);

    // modal should appear
    await waitFor(() => screen.getByText("Interstellar"));
    expect(screen.getByText("2014 • Adventure, Drama, Sci-Fi")).toBeInTheDocument();
    expect(screen.getByText("⭐ 8.6")).toBeInTheDocument();
  });
});
