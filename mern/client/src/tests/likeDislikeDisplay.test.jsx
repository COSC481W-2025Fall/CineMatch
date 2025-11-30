// src/tests/likeDislikeDisplay.test.jsx
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App.jsx";

// mock localStorage
beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      store: {},
      getItem(key) {
        return this.store[key] || null;
      },
      setItem(key, value) {
        this.store[key] = value;
      },
      clear() {
        this.store = {};
      },
    },
    writable: true,
  });
});

// mock fetch for movies
const mockMovies = [
  { id: 1, title: "Liked Movie", tmdbId: 1, posterUrl: "" },
  { id: 2, title: "Disliked Movie", tmdbId: 2, posterUrl: "" },
  { id: 3, title: "Neutral Movie", tmdbId: 3, posterUrl: "" },
];

vi.stubGlobal("fetch", vi.fn((url) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(mockMovies),
  });
}));
// test group
describe("Movie cards thumbs up/down flags", () => {
  // test 1 - no thumb on movie card
  it("does not show any flag if movie is neutral", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.querySelectorAll(".movie-card").length).toBe(3));

    const neutralCard = document.querySelectorAll(".movie-card")[2]; 
    const flag = neutralCard.querySelector(".like-flag-card");
    expect(flag).toBeNull();
  });
  // test 2 - thumb up on movie card
  it("shows thumbs up if movie is liked", async () => {
    localStorage.setItem("likedTmdbIds", JSON.stringify([1]));

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.querySelectorAll(".movie-card").length).toBe(3));

    const likedCard = document.querySelectorAll(".movie-card")[0];
    const flag = likedCard.querySelector(".like-flag-card");
    expect(flag).not.toBeNull();
    expect(flag.textContent).toBe("👍");
  });
  // test 3 - thumb down on movie card
  it("shows thumbs down if movie is disliked", async () => {
    localStorage.setItem("dislikedTmdbIds", JSON.stringify([2]));

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.querySelectorAll(".movie-card").length).toBe(3));

    const dislikedCard = document.querySelectorAll(".movie-card")[1];
    const flag = dislikedCard.querySelector(".like-flag-card");
    expect(flag).not.toBeNull();
    expect(flag.textContent).toBe("👎");
  });
  // test 4 - multiple movie cards with like/dislike displayed
  it("correctly shows thumbs up and down for multiple movies", async () => {
    localStorage.setItem("likedTmdbIds", JSON.stringify([1]));
    localStorage.setItem("dislikedTmdbIds", JSON.stringify([2]));

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.querySelectorAll(".movie-card").length).toBe(3));

    const thumbsUpCount = Array.from(document.querySelectorAll(".like-flag-card"))
      .filter((el) => el.textContent === "👍").length;
    const thumbsDownCount = Array.from(document.querySelectorAll(".like-flag-card"))
      .filter((el) => el.textContent === "👎").length;

    expect(thumbsUpCount).toBe(1);
    expect(thumbsDownCount).toBe(1);
  });
});
