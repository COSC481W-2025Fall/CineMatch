

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock db/connection.js before importing router
vi.mock("../db/connection.js", () => {
    let directorDocs = [];

    return {
        default: {
            collection: (name) => {
                if (name !== "directors") throw new Error("Unknown collection: " + name);

                return {
                    find: (filter = {}) => {
                        let results = directorDocs;

                        if (filter.name?.$regex) {
                            const regex = new RegExp(filter.name.$regex, filter.name.$options);
                            results = results.filter((doc) => regex.test(doc.name));
                        }

                        return {
                            limit: (n = 50) => ({
                                toArray: async () => results.slice(0, n),
                            }),
                        };
                    },
                    __setDocs: (docs) => {
                        directorDocs = docs;
                    },
                };
            },
        },
    };
});


import directorsRouter from "../routes/directors.js";
import db from "../db/connection.js";

const app = express();
app.use("/directors", directorsRouter);

describe("GET /record/directors", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.collection("directors").__setDocs([
            { _id: "a1", id: 1000001, name: "Greta Gerwig",     role: "Director" },
            { _id: "a2", id: 1000002, name: "Bong Joon-ho",     role: "Director" },
            { _id: "a3", id: 1000003, name: "Daniel Scheinert", role: "Director" },
            { _id: "a4", id: 1000003, name: "Daniel Kwan",      role: "Director" },
            { _id: "a5", id: 1000004, name: "David Fincher",    role: "Director" },
            { _id: "a6", id: 1000005, name: "Damien Chazelle",  role: "Director" },

        ]);
    });


    // TESTS:
    // test #1: Testing how many directors we seeded (we seeded 5)
    it("returns up to 50 directors when no filter is provided", async () => {
        const res = await request(app).get("/directors");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(6);
    });

    // test #2: Case-insensitivity (in this case, we used both Daniel Scheinert and Daniel Kwan)
    it("filters by name (case-insensitive partial match)", async () => {
        const res = await request(app)
            .get("/directors")
            .query({ name: "Daniel" });

        expect(res.status).toBe(200);
        const names = res.body.map((d) => d.name);
        expect(names).toEqual(expect.arrayContaining(["Daniel Scheinert", "Daniel Kwan"]));
        expect(names).not.toEqual(expect.arrayContaining(["David Fincher"]));
    });


    // test #3: Case-insensitivity (in this case, we used just Benedict Cumberbatch)
    it("filters by name (case-insensitive partial match)", async () => {
        const res = await request(app)
            .get("/directors")
            .query({ name: "Greta" });

        expect(res.status).toBe(200);
        const names = res.body.map((d) => d.name);
        expect(names).toEqual(expect.arrayContaining(["Greta Gerwig"]));
        expect(names).not.toEqual(expect.arrayContaining(["David Fincher"]));
    });
});