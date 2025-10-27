

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock db/connection.js before importing router
vi.mock("../db/connection.js", () => {
    let genreDocs = [];

    return {
        default: {
            collection: (name) => {
                if (name !== "genre") throw new Error("Unknown collection: " + name);

                return {
                    find: (filter = {}) => {
                        let results = genreDocs;

                        if (filter.genre?.$regex) {
                            const regex = new RegExp(filter.genre.$regex, filter.genre.$options);
                            results = results.filter((doc) => regex.test(doc.genre));
                        }

                        return {
                            limit: () => ({
                                toArray: async () => results,
                            }),
                        };
                    },
                    __setDocs: (docs) => {
                        genreDocs = docs;
                    },
                };
            },
        },
    };
});


import genreRouter from "../routes/genre.js";
import db from "../db/connection.js";

const app = express();
app.use("/genre", genreRouter);

describe("GET /genre", () => {
    beforeEach(() => {
        db.collection("genre").__setDocs([
            { id: 1, genre: "Adventure" },
            { id: 2, genre: "Science Fiction" },
            { id: 3, genre: "Drama" },
        ]);
    });

    // test #1
    it("returns all docs if no filter is given", async () => {
        const res = await request(app).get("/genre");

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
    });

    // test #2
    it("returns filtered docs when genre is given", async () => {
        const res = await request(app).get("/genre").query({ genre: "Science Fiction" });

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].genre).toBe("Science Fiction");
    });

    // test #3
    it("returns empty array for no match", async () => {
        const res = await request(app).get("/genre").query({ genre: "Fantasy" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});