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

    const { title, name, actor, year, rating, desc } = req.query;
    const filter = {};
    const qName = name ?? title;
    if (qName) filter.name = { $regex: qName, $options: "i" };
    if (year)   filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc)   filter.description = { $regex: desc, $options: "i" };


    const pipeline = [{ $match: filter }];
    if (actor) {
      const roles = await actorsCol.aggregate([
        { $match: { name: { $regex: actor, $options: "i" } } },
        { $group: { _id: "$role" } },   // distinct, shoooould allow for no repeats
        { $limit: 500 }                 // the actors database is very big, we had to make this smaller
      ]).toArray();

      const titles = roles.map(r => r._id).filter(Boolean);
      if (titles.length === 0) return res.json([]);   // when there is nothing matching, return nothing

      pipeline.push({ $match: { name: { $in: titles } } });
    }

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
