// server/tests/recordDetails.test.js
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";


vi.mock("../db/connection.js", () => {
    const collections = {
        movies: [],
        posters: [],
        actors: [],
        directors: [],
        genre: [],
    };

    const api = {
        collection: (name) => {
            if (!(name in collections)) throw new Error("Unknown collection: " + name);


            if (name === "movies") {
                return {
                    findOne: async (filter = {}) => {
                        if ("id" in filter) {
                            return collections.movies.find((m) => m.id === filter.id) || null;
                        }
                        return null;
                    },
                    __setDocs: (docs) => {
                        collections.movies = docs;
                    },
                };
            }


            if (name === "posters") {
                return {
                    findOne: async (filter = {}) => {
                        if ("id" in filter) {
                            return collections.posters.find((p) => p.id === filter.id) || null;
                        }
                        return null;
                    },
                    __setDocs: (docs) => {
                        collections.posters = docs;
                    },
                };
            }

            if (name === "genre") {
                return {
                    find: (filter = {}, _opts = {}) => ({
                        toArray: async () => {
                            const src = "id" in filter
                                ? collections.genre.filter((g) => g.id === filter.id)
                                : collections.genre;
                            return src.map((g) => ({ genre: g.genre }));
                        },
                    }),
                    __setDocs: (docs) => {
                        collections.genre = docs;
                    },
                };
            }

            if (name === "actors") {
                return {
                    aggregate: (pipeline = []) => {
                        let res = [...collections.actors];

                        for (const stage of pipeline) {
                            if (stage.$match) {
                                const f = stage.$match;
                                if (f.id !== undefined) res = res.filter((a) => a.id === f.id);
                                if (f.role !== undefined) res = res.filter((a) => a.role === f.role);
                            } else if (stage.$group?.["_id"] === "$name") {
                                const counts = new Map();
                                for (const a of res) counts.set(a.name, (counts.get(a.name) || 0) + 1);
                                res = Array.from(counts.entries()).map(([nm, cnt]) => ({ _id: nm, appearances: cnt }));
                            } else if (stage.$sort) {
                                const spec = stage.$sort;
                                res.sort((a, b) => {
                                    for (const [k, dir] of Object.entries(spec)) {
                                        const av = a[k], bv = b[k];
                                        if (av === bv) continue;
                                        return (av > bv ? 1 : -1) * dir;
                                    }
                                    return 0;
                                });
                            } else if (stage.$limit) {
                                res = res.slice(0, stage.$limit);
                            }
                        }

                        return { toArray: async () => res };
                    },
                    __setDocs: (docs) => {
                        collections.actors = docs;
                    },
                };
            }

            if (name === "directors") {
                return {
                    aggregate: () => ({ toArray: async () => [] }),
                    __setDocs: (docs) => {
                        collections.directors = docs;
                    },
                };
            }

            return {};
        },
    };

    return { default: api };
});


import recordRouter from "../routes/record.js";
import db from "../db/connection.js";

const app = express();
app.use("/record", recordRouter);

describe("GET /record/details/:id", () => {
    beforeEach(() => {
        vi.resetAllMocks(); // Added to ensure that all tests pass when ALL test files are run
        db.collection("movies").__setDocs([]);
        db.collection("posters").__setDocs([]);
        db.collection("genre").__setDocs([]);
        db.collection("actors").__setDocs([]);
    });


    it("200: returns full details with genres, poster from posters if movie has none, and topCast by id", async () => {
        db.collection("movies").__setDocs([
            { id: 10, name: "Test Film", date: 2020, rating: 3.9, posterUrl: null, description: "Desc" },
        ]);
        db.collection("posters").__setDocs([{ id: 10, link: "http://img/poster10.jpg" }]);
        db.collection("genre").__setDocs([
            { id: 10, genre: "Action" },
            { id: 10, genre: "Adventure" },
        ]);
        db.collection("actors").__setDocs([
            { id: 10, name: "Alice" },
            { id: 10, name: "Bob" },
            { id: 10, name: "Alice" },
            { id: 10, name: "Charlie" },
        ]);

        const res = await request(app).get("/record/details/10");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            id: 10,
            title: "Test Film",
            year: 2020,
            rating: 3.9,
            description: "Desc",
            posterUrl: "http://img/poster10.jpg",
        });
        expect(res.body.genres.sort()).toEqual(["Action", "Adventure"].sort());
        expect(res.body.topCast).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("200: uses movie.posterUrl if present (ignores posters collection)", async () => {
        db.collection("movies").__setDocs([
            { id: 22, name: "Has Poster", date: 2019, rating: 4.2, posterUrl: "keep-me", description: "" },
        ]);
        db.collection("posters").__setDocs([]);
        db.collection("genre").__setDocs([{ id: 22, genre: "Drama" }]);
        db.collection("actors").__setDocs([{ id: 22, name: "Dana" }]);

        const res = await request(app).get("/record/details/22");
        expect(res.status).toBe(200);
        expect(res.body.posterUrl).toBe("keep-me");
        expect(res.body.genres).toEqual(["Drama"]);
        expect(res.body.topCast).toEqual(["Dana"]);
    });

    it("200: falls back to matching topCast by role (movie title) when no actors match by id", async () => {
        db.collection("movies").__setDocs([
            { id: 33, name: "Role-Matched Movie", date: 2021, rating: 4.0, posterUrl: null, description: "" },
        ]);
        db.collection("posters").__setDocs([{ id: 33, link: "http://img/33.jpg" }]);
        db.collection("genre").__setDocs([{ id: 33, genre: "Comedy" }]);

        db.collection("actors").__setDocs([
            { id: 999, role: "Role-Matched Movie", name: "Zoe" },
            { id: 888, role: "Role-Matched Movie", name: "Yan" },
            { id: 777, role: "Role-Matched Movie", name: "Zoe" },
        ]);

        const res = await request(app).get("/record/details/33");
        expect(res.status).toBe(200);
        expect(res.body.posterUrl).toBe("http://img/33.jpg");
        expect(res.body.genres).toEqual(["Comedy"]);
        expect(res.body.topCast).toEqual(["Zoe", "Yan"]);
    });

    it("200: limits and sorts topCast by appearances (desc) then name (asc)", async () => {
        db.collection("movies").__setDocs([
            { id: 44, name: "Many Actors", date: 2022, rating: 3.5, posterUrl: null, description: "" },
        ]);
        db.collection("posters").__setDocs([{ id: 44, link: "http://img/44.jpg" }]);
        db.collection("genre").__setDocs([{ id: 44, genre: "Thriller" }]);

        db.collection("actors").__setDocs([
            { id: 44, name: "A" },
            { id: 44, name: "B" }, { id: 44, name: "B" },
            { id: 44, name: "C" }, { id: 44, name: "C" }, { id: 44, name: "C" },
            { id: 44, name: "D" },
            { id: 44, name: "E" }, { id: 44, name: "E" },
            { id: 44, name: "F" },
        ]);

        const res = await request(app).get("/record/details/44");
        expect(res.status).toBe(200);
        expect(res.body.topCast).toEqual(["C", "B", "E", "A", "D"]);
        expect(res.body.topCast.length).toBe(5);
    });

    it("404: returns not found when movie does not exist", async () => {
        db.collection("movies").__setDocs([]);
        const res = await request(app).get("/record/details/999");
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ error: "Movie not found" });
    });
});