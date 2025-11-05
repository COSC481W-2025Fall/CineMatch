// server/tests/recordBulk.test.js
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
                    aggregate: (pipeline = []) => {
                        let results = [...collections.movies];


                        // This is a huge mess, will have to sort this out later
                        for (const stage of pipeline) {
                            if (stage.$match) {
                                const f = stage.$match;
                                results = results.filter((doc) => {
                                    let ok = true;
                                    if (f.id?.$in) ok = ok && f.id.$in.includes(Number(doc.id));
                                    if (f.name?.$regex) {
                                        const re = new RegExp(f.name.$regex, f.name.$options);
                                        ok = ok && re.test(doc.name);
                                    }
                                    if (typeof f.date === "number") {
                                        ok = ok && Number(doc.date) === Number(f.date);
                                    } else if (f.date && typeof f.date === "object") {
                                        if (f.date.$gte != null) ok = ok && Number(doc.date) >= Number(f.date.$gte);
                                        if (f.date.$lte != null) ok = ok && Number(doc.date) <= Number(f.date.$lte);
                                    }
                                    if (f.rating?.$gte != null) ok = ok && Number(doc.rating) >= Number(f.rating.$gte);
                                    return ok;
                                });
                            } else if (stage.$sort) {
                                const keys = Object.keys(stage.$sort);
                                results.sort((a, b) => {
                                    for (const k of keys) {
                                        const dir = stage.$sort[k];
                                        const av =
                                            a[k] ?? (k === "year" ? a.date : undefined);
                                        const bv =
                                            b[k] ?? (k === "year" ? b.date : undefined);
                                        if (av === bv) continue;
                                        return (av > bv ? 1 : -1) * (dir >= 0 ? 1 : -1);
                                    }
                                    return 0;
                                });
                            } else if (stage.$limit) {
                                results = results.slice(0, stage.$limit);
                            } else if (stage.$project) {
                                const proj = stage.$project;
                                results = results.map((doc) => {
                                    const out = {};
                                    for (const [key, val] of Object.entries(proj)) {
                                        if (val === 1) out[key] = doc[key];
                                        else if (typeof val === "string" && val.startsWith("$")) {
                                            out[key] = doc[val.slice(1)];
                                        }
                                    }
                                    return out;
                                });
                            }
                        }
                        return { toArray: async () => results };
                    },
                    __setDocs: (docs) => { collections.movies = docs; },
                };
            }


            if (name === "posters") {
                return {
                    find: (filter = {}, options = {}) => {
                        let res = [...collections.posters];
                        if (filter.id?.$in) {
                            const set = new Set(filter.id.$in.map(Number));
                            res = res.filter((d) => set.has(Number(d.id)));
                        }
                        if (options?.projection) {
                            res = res.map((d) => {
                                const out = {};
                                for (const [k, v] of Object.entries(options.projection)) {
                                    if (v === 1 && k in d) out[k] = d[k];
                                }
                                return out;
                            });
                        }
                        return { toArray: async () => res };
                    },
                    __setDocs: (docs) => { collections.posters = docs; },
                };
            }

            // GENRE
            if (name === "genre") {
                return {
                    find: (filter = {}, options = {}) => {
                        let res = [...collections.genre];
                        if (filter.id?.$in) {
                            const set = new Set(filter.id.$in.map(Number));
                            res = res.filter((d) => set.has(Number(d.id)));
                        }
                        if (filter.genre?.$regex) {
                            const re = new RegExp(filter.genre.$regex, filter.genre.$options);
                            res = res.filter((d) => re.test(d.genre));
                        }
                        if (options?.projection) {
                            res = res.map((d) => {
                                const out = {};
                                for (const [k, v] of Object.entries(options.projection)) {
                                    if (v === 1 && k in d) out[k] = d[k];
                                }
                                return out;
                            });
                        }
                        const chain = {
                            limit: (n) => ({ toArray: async () => res.slice(0, n ?? res.length) }),
                            toArray: async () => res,
                        };
                        return chain;
                    },
                    __setDocs: (docs) => { collections.genre = docs; },
                };
            }

            // ACTORS/DIRECTORS
            if (name === "actors" || name === "directors") {
                return {
                    aggregate: (pipeline = []) => {
                        let res = [...collections[name]];
                        for (const stage of pipeline) {
                            if (stage.$match) {
                                const f = stage.$match;
                                if (f.name?.$regex) {
                                    const re = new RegExp(f.name.$regex, f.name.$options);
                                    res = res.filter((d) => re.test(d.name));
                                }
                                if (f.role) {
                                    if (typeof f.role === "string") res = res.filter((d) => d.role === f.role);
                                }
                            } else if (stage.$group?.["_id"] === "$id") {
                                const ids = Array.from(new Set(res.map((d) => d.id)));
                                res = ids.map((_id) => ({ _id }));
                            } else if (stage.$limit) {
                                res = res.slice(0, stage.$limit);
                            }
                        }
                        return { toArray: async () => res };
                    },
                    __setDocs: (docs) => { collections[name] = docs; },
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
app.use(express.json());
app.use("/record", recordRouter);


beforeEach(() => {
    vi.resetAllMocks();

    // Movies
    db.collection("movies").__setDocs([
        { id: 1, name: "Avengers: Infinity War", date: 2018, rating: 4.1, posterUrl: "poster1", description: "Thanos…" },
        { id: 2, name: "Avengers: Endgame",      date: 2019, rating: 4.6, posterUrl: "poster2", description: "After the snap…" },
        { id: 3, name: "Barbie",                  date: 2023, rating: 4.5, posterUrl: null,   description: "Welcome to Barbie Land" },
    ]);

    // Posters
    db.collection("posters").__setDocs([
        { id: 3, link: "http://img/poster3.jpg" },
    ]);

    // Genres
    db.collection("genre").__setDocs([
        { id: 1, genre: "Action" }, { id: 1, genre: "Adventure" },
        { id: 2, genre: "Action" }, { id: 2, genre: "Sci-Fi" },
        { id: 3, genre: "Comedy" }, { id: 3, genre: "Adventure" },
    ]);

    // Actors
    db.collection("actors").__setDocs([
        { id: 1, name: "Robert Downey Jr." },
        { id: 1, name: "Chris Pratt" },
        { id: 2, name: "Robert Downey Jr." },
        { id: 3, name: "Margot Robbie" },
    ]);

    // Directors
    db.collection("directors").__setDocs([
        { id: 1, role: "Director", name: "Anthony Russo" },
        { id: 2, role: "Director", name: "Joe Russo" },
        { id: 3, role: "Director", name: "Greta Gerwig" },
    ]);
});

// Tests
describe("POST /record/bulk", () => {
    it("returns [] when no ids are provided", async () => {
        const res = await request(app).post("/record/bulk").send({ ids: [], params: {} });
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // test #1: No filters, just return all watched
    it("returns only watched movies (no filters)", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: {},
        });

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);


        expect(res.body[0].id).toBe(3);
        expect(res.body[0].posterUrl).toBe("http://img/poster3.jpg");
        expect(res.body[0].genre).toEqual(expect.arrayContaining(["Comedy", "Adventure"]));

        expect(res.body[1].id).toBe(1);
        expect(res.body[1].posterUrl).toBe("poster1");
        expect(res.body[1].genre).toEqual(expect.arrayContaining(["Action", "Adventure"]));
    });

    // test #2: Filtering by title
    it("filters by title (case-insensitive)", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { title: "Avengers" },
        });
        expect(res.status).toBe(200);
        expect(res.body.map(m => m.title)).toEqual(["Avengers: Infinity War"]);
    });

    // test #3: Filter by year
    it("filters by exact year", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { year: "2023" },
        });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].id).toBe(3);
    });

    // test #4 Filter by minimum rating (I'm not going to test the new validation, at least not yet)
    it("filters by minimum rating", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { rating: "4.5" },
        });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].id).toBe(3);
    });

    // test #5: Filter by director
    it("filters by director", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { director: "Greta" },
        });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].id).toBe(3);
    });

    // test #6: Filter by actor
    it("filters by actor", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { actor: "Robert Downey" },
        });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].id).toBe(1);
    });

    // test #7: Filter by genre
    it("filters by genre", async () => {
        const res = await request(app).post("/record/bulk").send({
            ids: [1, 3],
            params: { genre: "Comedy" },
        });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].id).toBe(3);
    });
});
