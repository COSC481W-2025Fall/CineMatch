// TODO: This entire script needs to be redone at some point.
// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = Router();
// NOT IMPLEMENTED: GENRE
// GET /record?name=&year=&desc=
// routes/record.js
router.get("/", async (req, res) => {
  try {
    const moviesCol = db.collection("movies");
    const directorsCol = db.collection("directors");

    // added director
    const { title, name, director, year, rating, desc } = req.query;
    // build the base movie filter
    const filter = {};
    const qName = name ?? title;
    if (qName) filter.name = { $regex: qName, $options: "i" };
    if (year)   filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc)   filter.description = { $regex: desc, $options: "i" };

    // pipeline to make a query
    const pipeline = [{ $match: filter }];
    if (Object.keys(filter).length) pipeline.push({$match: filter});
    // director name is correct, the aggregation will go along, aka director filter
    if (director) {
      // Find director whose name matches the query provided
      const rows = await directorsCol.aggregate([
        // find director data whose name matches (CASE INSENSITIVE)
        { $match: { role: "Director", name: { $regex: director, $options: "i" } } },
        { $group: { _id: "$id" } },   // distinct, shoooould allow for no repeats
        { $limit: 500 }                 // limit will possibly be smaller in the future
      ]).toArray();

      // Attaches directors to the movies and builds aggregation
      ///////////////
      const ids = rows.map(r => r._id).filter(v => v !== null && v !== undefined);
      if (ids.length === 0) return res.json([]);   // when there is nothing matching, return nothing

      // narrows down the movie pipeline to only those that match the above filter
      pipeline.push({ $match: { id: { $in: ids } } });
      ///////////////
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
