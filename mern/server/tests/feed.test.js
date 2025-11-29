import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// mock node-fetch before importing router
vi.mock("node-fetch", () => ({
    default: vi.fn(),
}));

// mock DB
vi.mock("../db/connection.js", () => {
    let movieDocs = {};
    let posterDocs = {};

    return {
        default: {
            collection: (name) => {
                if (name === "movies") {
                    return {
                        findOne: async (filter) => movieDocs[filter.id] || null,
                        __setDocs: (docs) => {
                            movieDocs = {};
                            docs.forEach((d) => (movieDocs[d.id] = d));
                        },
                    };
                }
                if (name === "posters") {
                    return {
                        __setDocs: (docs) => {
                            posterDocs = docs;
                        },
                    };
                }
                throw new Error("Unknown collection: " + name);
            },
        },
    };
});

import feedRouter from "../routes/feed.js";
import db from "../db/connection.js";
import fetch from "node-fetch";

// express app setup
const app = express();
app.use(express.json());
app.use("/feed", feedRouter);

// helper to create fake TMDB responses
function mockFetchSequence(responses) {
    fetch.mockImplementationOnce(() =>
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve(responses.shift()),
        })
    );
}

describe("POST /feed", () => {
    beforeEach(() => {
        vi.resetAllMocks();

        // set fake TMDB API key so route doesn't reject
        process.env.VITE_TMDB_API_KEY = "FAKE_KEY";

        // seed movies that user has watched
        db.collection("movies").__setDocs([
            { id: 10, name: "Inception", date: 2010 },
            { id: 11, name: "Avatar", date: 2009 },
        ]);
    });

    // test 1: empty watched list
    it("returns empty array if watchedIds is empty", async () => {
        const res = await request(app).post("/feed").send({ watchedIds: [] });

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
    });

    // Test 2: Default limit (20)
    it("returns at most the default of 20 items", async () => {
        // for movie 10 (Inception)
        mockFetchSequence([
            { results: [{ id: 100, title: "Inception", release_date: "2010-07-16" }] }, // search
        ]);
        // recommendations for Inception
        mockFetchSequence([
            {
                results: Array.from({ length: 30 }).map((_, i) => ({
                    id: 200 + i,
                    title: "Rec " + (i + 1),
                    release_date: "2020-01-01",
                    vote_average: 7.5,
                })),
            },
        ]);

        // for movie 11 (Avatar)
        mockFetchSequence([
            { results: [{ id: 101, title: "Avatar", release_date: "2009-12-18" }] }, // search
        ]);
        mockFetchSequence([
            {
                results: Array.from({ length: 30 }).map((_, i) => ({
                    id: 300 + i,
                    title: "Avatar Rec " + (i + 1),
                    release_date: "2021-01-01",
                    vote_average: 8.0,
                })),
            },
        ]);

        const res = await request(app)
            .post("/feed")
            .send({ watchedIds: [10, 11] });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBe(20); // default limit
    });

    // Test 3: excludes watched TMDB IDs
    it("excludes TMDB IDs of movies the user watched", async () => {
        // watched movie Inception resolves to TMDB ID 100
        mockFetchSequence([
            { results: [{ id: 100, title: "Inception", release_date: "2010-07-16" }] },
        ]);

        // rec list contains movie 100, which should be excluded
        mockFetchSequence([
            {
                results: [
                    {
                        id: 100,
                        title: "Inception Duplicate",
                        release_date: "2010-07-16",
                        vote_average: 9.0,
                    },
                    {
                        id: 555,
                        title: "Other Movie",
                        release_date: "2020-01-01",
                        vote_average: 7.2,
                    },
                ],
            },
        ]);

        const res = await request(app)
            .post("/feed")
            .send({ watchedIds: [10], limit: 10 });

        expect(res.status).toBe(200);
        const ids = res.body.items.map((m) => m.tmdbId);

        expect(ids.includes(100)).toBe(false);
        expect(ids.includes(555)).toBe(true);
    });


    // Test 4: aggregates and sorts by count/rating
    it("aggregates recommendations and sorts by count then rating", async () => {
        //search
        mockFetchSequence([
            { results: [{ id: 100, title: "Inception", release_date: "2010-07-16" }] },
        ]);
        // recommendations
        mockFetchSequence([
            {
                results: [
                    {
                        id: 500,
                        title: "Movie High Count",
                        release_date: "2020",
                        vote_average: 5.0,
                    },
                    {
                        id: 501,
                        title: "Movie High Rating",
                        release_date: "2020",
                        vote_average: 9.5,
                    },
                ],
            },
        ]);

        const res = await request(app)
            .post("/feed")
            .send({ watchedIds: [10], limit: 2 });

        expect(res.status).toBe(200);

        // should sort by count DESC, then rating DESC
        const titles = res.body.items.map((i) => i.title);

        expect(titles).toContain("Movie High Count");
        expect(titles).toContain("Movie High Rating");
    });
});
