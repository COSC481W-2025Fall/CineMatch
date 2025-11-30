// server/tests/feed.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Ensures feed.js sees the API key properly when it loads
process.env.VITE_TMDB_API_KEY = "TEST_TMDB_KEY";

// Mocks

// Mock db/connection.js (feed.js imports it, even if not used yet)
vi.mock("../db/connection.js", () => {
  return {
    default: {
      collection: () => ({}),
    },
  };
});

// Mock node-fetch so we don't hit the real TMDB API
vi.mock("node-fetch", () => {
  const fetchMock = vi.fn();
  return { default: fetchMock };
});

import fetch from "node-fetch";
import feedRouter from "../routes/feed.js";

// Build a small Express app with the feed router mounted
const app = express();
app.use(express.json());
app.use("/feed", feedRouter);

describe("POST /feed", () => {
  beforeEach(() => {
    // Reset fetch between tests
    fetch.mockReset();
  });

  // 1) Empty seeds 
  it("returns { items: [] } when all seed arrays are empty", async () => {
    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
    expect(Array.isArray(res.body.items)).toBe(true);
    // Should not call TMDB at all in this case
    expect(fetch).not.toHaveBeenCalled();
  });

  // 2) tooCloseToDisliked genre filter
  it("filters out recommendations that are too close to disliked genres", async () => {
    // disliked movie 999 has genres {18, 28}
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      // Recommendations for seed 999
      if (urlStr.includes("/movie/999/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 1,
                title: "Too Similar",
                genre_ids: [18, 28], // should be excluded
                vote_average: 7.2,
                overview: "Should be filtered out",
                poster_path: "/too_similar.jpg",
              },
              {
                id: 2,
                title: "Safe Rec",
                genre_ids: [35], // allowed
                vote_average: 6.5,
                overview: "Should be kept",
                poster_path: "/safe_rec.jpg",
              },
            ],
          }),
        });
      }

      // Genre lookup for disliked movie 999
      if (urlStr.includes("/movie/999?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            genres: [
              { id: 18 },
              { id: 28 },
            ],
          }),
        });
      }

      // Fallback for any other URL
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [],
        likedTmdbIds: [],
        dislikedTmdbIds: [999],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    const ids = res.body.items.map((m) => m.tmdbId);

    // Keep the "safe" recommendation
    expect(ids).toContain(2);

    // Do should not get the "too-similar" recommendation
    expect(ids).not.toContain(1);

    // Check that our mock fetch was used
    expect(fetch).toHaveBeenCalled();
  });

  // 3) Watched and disliked movies never appear in results
  it("never returns movies the user has already watched or explicitly disliked", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/111/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { id: 111, title: "Already Watched", genre_ids: [12], vote_average: 7.0, overview: "", poster_path: null },
              { id: 300, title: "From Watched Seed", genre_ids: [12], vote_average: 6.0, overview: "", poster_path: null },
            ],
          }),
        });
      }

      if (urlStr.includes("/movie/222/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { id: 222, title: "Explicitly Disliked", genre_ids: [18], vote_average: 8.0, overview: "", poster_path: null },
              { id: 400, title: "From Disliked Seed", genre_ids: [18], vote_average: 5.5, overview: "", poster_path: null },
            ],
          }),
        });
      }

      // Genre lookup for disliked 222
      if (urlStr.includes("/movie/222?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            genres: [{ id: 18 }],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [111],
        likedTmdbIds: [],
        dislikedTmdbIds: [222],
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    const ids = res.body.items.map((m) => m.tmdbId);

    // Must not include watched or explicitly disliked
    expect(ids).not.toContain(111);
    expect(ids).not.toContain(222);

    // Should include recommendations that are not excluded
    expect(ids).toEqual(expect.arrayContaining([300, 400]));
  });

  // 4) Combines weights from multiple seeds and sorts by score
  it("combines weights from different seeds and sorts by score then rating", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/10/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 100,
                title: "From Watched Seed",
                genre_ids: [12],
                vote_average: 7.0,
                overview: "",
                poster_path: null,
              },
            ],
          }),
        });
      }

      if (urlStr.includes("/movie/20/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 100,
                title: "From Liked Seed Too",
                genre_ids: [12],
                vote_average: 7.5, // slightly higher rating
                overview: "",
                poster_path: null,
              },
              {
                id: 200,
                title: "Only From Liked Seed",
                genre_ids: [16],
                vote_average: 8.5,
                overview: "",
                poster_path: null,
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [10],
        likedTmdbIds: [20],
        dislikedTmdbIds: [],
        limit: 10,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    const idsInOrder = res.body.items.map((m) => m.tmdbId);

    // Movie 100 should come first because it receives contributions from both watched and liked seeds
    expect(idsInOrder[0]).toBe(100);
    expect(idsInOrder).toEqual(expect.arrayContaining([100, 200]));
  });

  // 5) Respects limit parameter 
  it("respects the limit parameter and does not return more than requested", async () => {
    // Single seed that recommends 3 movies, but we pass limit of 1
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/50/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { id: 501, title: "Rec 1", genre_ids: [12], vote_average: 7.0, overview: "", poster_path: null },
              { id: 502, title: "Rec 2", genre_ids: [12], vote_average: 8.0, overview: "", poster_path: null },
              { id: 503, title: "Rec 3", genre_ids: [12], vote_average: 6.0, overview: "", poster_path: null },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [50],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
        limit: 1,
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(1);
  });

  // 6) Ignores invalid or non-numeric IDs but still uses valid numeric ones
  it("ignores non-numeric or invalid IDs and still uses valid numeric seeds", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/10/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 101,
                title: "From Valid Seed",
                genre_ids: [28],
                vote_average: 7.3,
                overview: "",
                poster_path: null,
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: ["10", "abc", 0, -5, null],
        likedTmdbIds: ["xyz"],
        dislikedTmdbIds: [NaN],
      });

    expect(res.status).toBe(200);
    const ids = res.body.items.map((m) => m.tmdbId);

    // Only the numeric "10" should have produced reccomedations
    expect(ids).toContain(101);
    // Only one good seed to call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // 7) Correct mapping of title/year/rating/overview/posterPath defaults
  it("maps TMDB results to the expected item shape with sensible defaults", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/42/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              {
                id: 777,
                // no 'title', only 'name'
                name: "Alt Title",
                release_date: "", // no year
                vote_average: "not-a-number", // not a number
                overview: "Some overview",
                poster_path: "/poster.jpg",
                genre_ids: [],
              },
              {
                id: 778,
                // should become "Untitled" 
                release_date: "2020-05-04",
                vote_average: 8.1234,
                overview: "",
                poster_path: null,
                genre_ids: [],
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [42],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);

    // Find by ID 
    const item777 = res.body.items.find((m) => m.tmdbId === 777);
    const item778 = res.body.items.find((m) => m.tmdbId === 778);

    expect(item777).toBeTruthy();
    expect(item777.title).toBe("Alt Title");
    expect(item777.year).toBeNull();
    expect(item777.rating).toBeNull();
    expect(item777.overview).toBe("Some overview");
    expect(item777.posterPath).toBe("/poster.jpg");

    expect(item778).toBeTruthy();
    expect(item778.title).toBe("Untitled");
    expect(item778.year).toBe("2020");
    expect(item778.rating).toBe(8.1);
    expect(item778.overview).toBe("");
    expect(item778.posterPath).toBeNull();
  });

  // 8) Non-positive limit behaves like "no limit specified" 
  it("treats a non-positive limit as the default limit and returns all available recs", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/70/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { id: 701, title: "Rec A", genre_ids: [12], vote_average: 7.0, overview: "", poster_path: null },
              { id: 702, title: "Rec B", genre_ids: [12], vote_average: 6.5, overview: "", poster_path: null },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [70],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
        limit: 0, 
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    // Only mocked 2, so 2 expected 
    expect(res.body.items.length).toBe(2);
  });

  // 9) Tie-break by rating when scores are equal
  it("uses rating as a tie-breaker when scores are equal", async () => {
    fetch.mockImplementation((url) => {
      const urlStr = String(url);

      if (urlStr.includes("/movie/60/recommendations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [
              { id: 601, title: "Lower Rating", genre_ids: [12], vote_average: 7.0, overview: "", poster_path: null },
              { id: 602, title: "Higher Rating", genre_ids: [12], vote_average: 8.0, overview: "", poster_path: null },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [60],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
      });

    expect(res.status).toBe(200);
    const idsInOrder = res.body.items.map((m) => m.tmdbId);

    // Same seed and same score, so 602 should come first
    expect(idsInOrder[0]).toBe(602);
    expect(idsInOrder).toEqual(expect.arrayContaining([601, 602]));
  });

  // 10) Handles non-ok TMDB responses gracefully
  it("handles non-ok TMDB responses without crashing and returns empty items", async () => {
    // fetch mock
    fetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    });

    const res = await request(app)
      .post("/feed")
      .send({
        watchedIds: [10],
        likedTmdbIds: [],
        dislikedTmdbIds: [],
      });

    // Even though TMDB "fails", our route should still respond 200 with an empty set
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });
});
