// TODO: This entire script needs to be redone at some point.
// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = Router();
// NOT IMPLEMENTED: DIRECTOR, AND GENRE
// GET /record?name=&year=&desc=
// routes/record.js
router.get("/", async (req, res) => {
  try {
    const moviesCol = db.collection("movies");
    const actorsCol = db.collection("actors");

    // read the query parameters, (New: includes actor)
    const { title, name, actor, year, rating, desc } = req.query;
    // build the base movie filter
    const filter = {};
    const qName = name ?? title;
    if (qName) filter.name = { $regex: qName, $options: "i" };
    if (year)   filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc)   filter.description = { $regex: desc, $options: "i" };

    //New: start a dynamic pipeline we can append to
    const pipeline = [{ $match: filter }];
    // NEW: filtering based on actor, if actor is provided find distinct titles 
    // from the actor collection
    if (actor) {
      // 1) Find actors whose name matches the query
      const roles = await actorsCol.aggregate([
        // find actor data who's name matches (CASE INSENSITIVE)
        { $match: { name: { $regex: actor, $options: "i" } } },
        // 2) Collapse duplicates: gives each distinct 'role' once.
        //In this schema, 'role' represents the MOVIE TITLE.
        { $group: { _id: "$role" } },   // distinct, shoooould allow for no repeats
        { $limit: 500 }                 // the actors database is very big, we had to make this smaller
      ]).toArray();

      // 4) Convert group results to a flat string array of titles
      const titles = roles.map(r => r._id).filter(Boolean);
      if (titles.length === 0) return res.json([]);   // when there is nothing matching, return nothing

      // narrows down the movie pipeline to only those that natch the above filter
      pipeline.push({ $match: { name: { $in: titles } } });
    }

    // same as before cap the results
    pipeline.push(
        { $limit: 50 }, // will only show 50 movies at a time for now
        {
          $project: {
            title: "$name",
            year: "$date",
            rating: 1,
            posterUrl: 1,
            genre: 1,
            description: 1
          }
        }
    );
    // run the assembled pipeline 
    const docs = await moviesCol.aggregate(pipeline).toArray(); // instead of aggregate directly, we made another variable that would get the results then we can just act as a "pipeline" to make things go faster
    res.status(200).json(docs);
  } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
      }
    });

// we are probably not going to use by ID but it's here.
// GET /record/:id
router.get("/:id", async (req, res) => {
  try {
    const col = db.collection("movies");
    const doc = await col.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.status(200).json(doc);
  } catch (err) {
    console.error("GET /record/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
