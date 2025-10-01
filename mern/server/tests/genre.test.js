// Chatgpt assisted code prompt "Show me how to create tests using vitest for genre.js"
//10/1/25

import { describe, it, expect, beforeEach, vi } from "vitest";      // import key helpers from vitest to structure tests, mock modules, assert tests
import request from "supertest";    // request express app object w/out starting real server
import express from "express";      // import express to test a minimal app

// Mock db/connection.js before importing router 
vi.mock("../db/connection.js", () => {
  let genreDocs = []; // store genre docs used by tests

  return {
    default: {
      collection: (name) => { // mock module called when route calls db.collection("genre")
        if (name !== "genre") throw new Error("Unknown collection: " + name); // only supports genre to keep test focused

        return {
          find: (filter = {}) => { 
            let results = genreDocs;

            // simulate regex filtering
            if (filter.genre?.$regex) {
              const regex = new RegExp(filter.genre.$regex, filter.genre.$options);
              results = results.filter((doc) => regex.test(doc.genre));
            }

            return {
              limit: () => ({
                toArray: async () => results,   // simulates Mongo cursor Api chain
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

// import the router under test and the mocked db
import genreRouter from "../routes/genre.js";
import db from "../db/connection.js";

// setup express test app
const app = express();
app.use("/genre", genreRouter);

describe("GET /genre", () => {      // test suite grouping the following tests
  beforeEach(() => {
    // reset fake db before each test
    db.collection("genre").__setDocs([      // seed genreDocs with 3 entries
      { id: 1, genre: "Adventure" },
      { id: 2, genre: "Science Fiction" },
      { id: 3, genre: "Drama" },
    ]);
  });

  // test #1
  it("returns all docs if no filter is given", async () => {    // unfiltered genre result, grab all genres within genre collection
    const res = await request(app).get("/genre");       // supertest used to perform GET request to /genre?

    expect(res.status).toBe(200);       // route expects HTTP 200 to be returned
    expect(res.body.length).toBe(3);    // expects response body to contain 3 items, the test suite
  });

  // test #2
  it("returns filtered docs when genre is given", async () => {     // filterd genre result, grab movie id with specified genre
    const res = await request(app).get("/genre").query({ genre: "Science" }); // supertest builds request to /genre?genre=Science

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].genre).toBe("Science Fiction");  // expects first entry of response body to equal Science Fiction based on genre specified
  });

  // test #3
  it("returns empty array for no match", async () => {      // no search results found
    const res = await request(app).get("/genre").query({ genre: "Fantasy" }); // supertest builds request to /genre?genre=Fantasy

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);       // expected empty array to represent no results found
  });
});
