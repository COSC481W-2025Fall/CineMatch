

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock db/connection.js before importing router
vi.mock("../db/connection.js", () => {
    let actorDocs = [];

    return {
        default: {
            collection: (name) => {
                if (name !== "actors") throw new Error("Unknown collection: " + name);

                return {
                    find: (filter = {}) => {
                        let results = actorDocs;

                        if (filter.name?.$regex) {
                            const regex = new RegExp(filter.name.$regex, filter.name.$options);
                            results = results.filter((doc) => regex.test(doc.name));
                        }

                        if (filter.role?.$regex) {
                            const regex = new RegExp(filter.role.$regex, filter.role.$options);
                            results = results.filter((doc) => regex.test(doc.role));
                        }

                        return {
                            limit: (n = 50) => ({
                                toArray: async () => results.slice(0, n),
                            }),
                        };
                    },
                    __setDocs: (docs) => {
                        actorDocs = docs;
                    },
                };
            },
        },
    };
});


import actorsRouter from "../routes/actors.js";
import db from "../db/connection.js";

const app = express();
app.use("/actors", actorsRouter);

describe("GET /record/actors", () => {
    beforeEach(() => {
        vi.resetAllMocks(); // Added to ensure that all tests pass when ALL test files are run
        db.collection("actors").__setDocs([
            { _id: "a1", id: 1000001, name: "Tom Hanks",     role: "Forrest Gump" },
            { _id: "a2", id: 1003031, name: "Jamie Foxx",  role: "Django" },
            { _id: "a3", id: 1000027, name: "Benedict Cumberbatch",     role: "Doctor Strange" },
            { _id: "a4", id: 1000001, name: "Adam Ray",      role: "Policeman" },
            { _id: "a5", id: 1000181, name: "Liam Neeson", role: "Oskar Schindler" },
            { _id: "a6", id: 1000002, name: "Tom Hardy",     role: "Mad Max: Fury Road" },

        ]);
    });
    // TESTS:
    // test #1: Testing how many actors we seeded (we seeded 5)
    it("returns up to 50 actors when no filter is provided", async () => {
        const res = await request(app).get("/actors");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(6);
    });

    // test #2: Case-insensitivity (in this case, we used both Tom Hard and Tom Hanks)
    it("filters by name (case-insensitive partial match)", async () => {
        const res = await request(app)
            .get("/actors")
            .query({ name: "tom" });

        expect(res.status).toBe(200);
        const names = res.body.map((d) => d.name);
        expect(names).toEqual(expect.arrayContaining(["Tom Hanks", "Tom Hardy"]));
        expect(names).not.toEqual(expect.arrayContaining(["Jamie Foxx"]));
    });


    // test #3: Testing to see if we can search by role
    it("filters by role name (case-insensitive partial match)", async () => {
        const res = await request(app)
            .get("/actors")
            .query({ movie: "Forrest Gump" });

        expect(res.status).toBe(200);
        const roles = res.body.map((d) => d.role);
        expect(roles.every((r) => /forrest gump/i.test(r))).toBe(true);
    });

    // test #4
    it("applies BOTH filters together (AND semantics)", async () => {
        const res = await request(app)
            .get("/actors")
            .query({ name: "hanks", movie: "forrest" });

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].name).toBe("Tom Hanks");
        expect(/forrest gump/i.test(res.body[0].role)).toBe(true);
    });

    // test #5: Case-insensitivity (in this case, we used just Benedict Cumberbatch)
    it("filters by name (case-insensitive partial match)", async () => {
        const res = await request(app)
            .get("/actors")
            .query({ name: "benedict" });

        expect(res.status).toBe(200);
        const names = res.body.map((d) => d.name);
        expect(names).toEqual(expect.arrayContaining(["Benedict Cumberbatch"]));
        expect(names).not.toEqual(expect.arrayContaining(["Jamie Foxx"]));
    });
});