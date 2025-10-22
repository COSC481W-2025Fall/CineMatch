

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
                                    if (f.name?.$regex) {
                                        const re = new RegExp(f.name.$regex, f.name.$options);
                                        ok = ok && re.test(doc.name);
                                    }
                                    if (typeof f.date === "number") ok = ok && doc.date === f.date;
                                    if (f.rating?.$gte != null) ok = ok && Number(doc.rating) >= Number(f.rating.$gte);
                                    if (f.description?.$regex) {
                                        const re2 = new RegExp(f.description.$regex, f.description.$options);
                                        ok = ok && re2.test(doc.description ?? "");
                                    }
                                    if (f.id?.$in) ok = ok && f.id.$in.includes(doc.id);
                                    return ok;
                                });
                            } else if (stage.$sort) {
                                const keys = Object.keys(stage.$sort);
                                results.sort((a, b) => {
                                    for (const k of keys) {
                                        const dir = stage.$sort[k];
                                        const av = a[k] ?? (k === "year" ? a.date : undefined);
                                        const bv = b[k] ?? (k === "year" ? b.date : undefined);
                                        if (av === bv) continue;
                                        return (av > bv ? 1 : -1) * dir;
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
                        return {toArray: async () => results};
                    },
                    __setDocs: (docs) => {
                        collections.movies = docs;
                    },
                };
            }
            if (name === "posters") {
                return {
                    find: (filter = {}) => {
                        let res = [...collections.posters];
                        if (filter.id?.$in) res = res.filter((d) => filter.id.$in.includes(d.id));
                        return {toArray: async () => res};
                    },
                    __setDocs: (docs) => {
                        collections.posters = docs;
                    },
                };
            }

            if (name === "genre") {
                return {
                    find: (filter = {}) => {
                        let res = [...collections.genre];
                        if (filter.id?.$in) res = res.filter((d) => filter.id.$in.includes(d.id));
                        if (filter.genre?.$regex) {
                            const re = new RegExp(filter.genre.$regex, filter.genre.$options);
                            res = res.filter((d) => re.test(d.genre));
                        }
                        return {
                            limit: (n) => ({
                                map: (fn) => ({
                                    toArray: async () => res.slice(0, n ?? res.length).map(fn),
                                }),
                            }),
                            toArray: async () => res,
                        };
                    },
                    __setDocs: (docs) => {
                        collections.genre = docs;
                    },
                };
            }

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
                                res = Array.from(new Set(res.map((d) => d.id))).map((_id) => ({_id}));
                            } else if (stage.$limit) {
                                res = res.slice(0, stage.$limit);
                            }
                        }
                        return {toArray: async () => res};
                    },
                    __setDocs: (docs) => {
                        collections[name] = docs;
                    },
                };
            }
            return {};
        },


    };

    return {default: api};
});


import recordRouter from "../routes/record.js";
import db from "../db/connection.js";

const app = express();
app.use("/record", recordRouter);

describe("GET /record with posters", () => {
    beforeEach(() => {
        vi.resetAllMocks(); // Added to ensure that all tests pass when ALL test files are run
        db.collection("posters").__setDocs([
            { id: 1, link: "http://img/poster1.jpg" },
            { id: 2, link: "url2" },

        ]);
        db.collection("genre").__setDocs([]);
        db.collection("movies").__setDocs([
            {
                id: "1",
                _id: "1",
                name: "Avengers: Infinity War",
                director: "Anthony Russo",
                date: 2018,
                rating: 4.1,
                posterUrl: "http://img/poster1.jpg",
                description: "Thanos seeks the Infinity Stones",
                genre: ["Action", "Adventure"],
            },
            {
                id: "2",
                _id: "2",
                name: "Avengers: Endgame",
                director: "Joe Russo",
                date: 2019,
                rating: 4.4,
                posterUrl: "keep-me",
                description: "After the snap…",
                genre: ["Action", "Sci-Fi"],
            },
            {
                id: "3",
                _id: "3",
                name: "Barbie",
                director: "Greta Gerwig",
                date: 2023,
                rating: 4.5,
                posterUrl: null,
                description: "Welcome to Barbie Land",
                genre: ["Comedy", "Adventure"],
            },
        ]);
    });


    // TESTS:
    // test #1: Testing movie posters
    it("returns movies and fills missing posterUrl from posters collection", async () => {
        const res = await request(app).get("/record");
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);

        const byId = Object.fromEntries(res.body.map((m) => [m.id, m]));
        expect(byId[1].posterUrl).toBe("http://img/poster1.jpg");
        expect(byId[2].posterUrl).toBe("keep-me");
    });

    // test #2: Testing movie posters by year
    it("filters by year and keeps poster", async () => {
        const res = await request(app).get("/record").query({ year: "2018" });
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);

        expect(res.body[0].id).toBe('1');
        expect(res.body[0].posterUrl).toBe("http://img/poster1.jpg");
    });


    // test #3: return 3 movies (movies that we seeded earlier)
    it("returns up to 50 movies when no filter is provided", async () => {
        const res = await request(app).get("/record");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(3);


        const titles = res.body.map(m => m.title || m.name);
        expect(titles).toContain("Avengers: Infinity War");
        expect(titles).toContain("Avengers: Endgame");
        expect(titles).toContain("Barbie");
    });

    // test #4: test movie by its name
    it("filters by name (title) regex", async () => {
        const res = await request(app).get("/record").query({ name: "Avengers" });
        expect(res.status).toBe(200);
        const titles = res.body.map(m => m.title || m.name);
        expect(titles.sort()).toEqual(["Avengers: Endgame", "Avengers: Infinity War"].sort());
    });

    // test #5: test movie by date
    it("filters by exact year", async () => {
        const res = await request(app).get("/record").query({ year: "2018" });
        expect(res.status).toBe(200);
        const titles = res.body.map(m => m.title || m.name);
        expect(titles).toEqual(["Avengers: Infinity War"]);
    });

    // test #6: test movie by its rating
    it("filters by minimum rating", async () => {
        const res = await request(app).get("/record").query({ rating: "4.4" });
        expect(res.status).toBe(200);
        const titles = res.body.map(m => m.title || m.name).sort();
        expect(titles).toEqual(["Avengers: Endgame", "Barbie"].sort());
    });
});