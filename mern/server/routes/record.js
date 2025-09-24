// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const moviesCol  = db.collection("movies");
    const postersCol = db.collection("posters");

    const { title, name, year, rating, desc } = req.query;
    const filter = {};
    const qName = name ?? title;
    if (qName)  filter.name = { $regex: qName, $options: "i" };
    if (year)   filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc)   filter.description = { $regex: desc, $options: "i" };

    // 1) get up to 50 movies
    const movies = await moviesCol.aggregate([
      { $match: filter },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          id: 1,
          title: "$name",
          year: "$date",
          rating: 1,
          posterUrl: 1,
          genre: 1,
          description: 1
        }
      }
    ]).toArray();

    // This would help us fetch the posters ONLY for the movies we request for, and not ALL some 945k movies posters, too much processing
    const ids = movies.map(m => m.id).filter(Boolean); // This just removes any values that aren't intended such as null, and it gets mapped into ids
    let posterMap = new Map(); // THEN, we reserve a variable for the movie
    if (ids.length) { // If ids has any elements (max of 50), then this will run and check to see if movie has a poster, basically if a movie poster exists, this will grab it
      const posters = await postersCol.find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, link: 1 } }).toArray();
      posterMap = new Map(posters.map(p => [p.id, p.link])); // key and address
    }

    // We only add the poster to those movies that don't have the posters initialized, thus, we are not repeating ourselves. Basically redundancy.
    const result = movies.map(m => ({
      ...m,
      posterUrl: m.posterUrl ?? posterMap.get(m.id) ?? m.posterUrl
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

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
