// routes/genre.js
import { Router } from "express";
import db from "../db/connection.js";


const router = Router();
// GET /record/genre?genre=GENRE
// Example: /record/directors?name=Quentin%20Tarantino
// routes/record/directors.js
router.get("/", async (req, res) => {
  try {

    const { genre } = req.query;
    const filter = {};
    if (genre) filter.genre = { $regex: genre, $options: "i" };

    const docs = await db.collection("genre").find(filter).limit(50).toArray();
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
