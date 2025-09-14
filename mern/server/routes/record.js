// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = Router();

// GET /record?name=&year=&desc=
// routes/record.js
router.get("/", async (req, res) => {
  try {
    const col = db.collection("movies");

    const { title, name, year, rating, desc } = req.query;
    const filter = {};
    const qName = name ?? title;                 
    if (qName) filter.name = { $regex: qName, $options: "i" };
    if (year)  filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc)  filter.description = { $regex: desc, $options: "i" };

    const docs = await col.aggregate([
      { $match: filter },
      { $limit: 50 },
      {
        $project: {
          title: "$name",        // alias
          year: "$date",         // alias
          rating: 1,
          posterUrl: 1,
          genre: 1,
          description: 1
        }
      }
    ]).toArray();

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
