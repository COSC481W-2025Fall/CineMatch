// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

// store all /record routes to use later
const router = Router();

// GET /record?title=&name=&year=&rating=&desc=&genre=
router.get("/", async (req, res) => {
  try {
    const moviesCol = db.collection("movies");
    const genreCol = db.collection("genre");

    // extract query parameters from URL
    const { title, name, year, rating, desc, genre } = req.query;

    // Base movie filter (without genre)
    const filter = {};
    const qName = name ?? title;
    if (qName) filter.name = { $regex: qName, $options: "i" };
    if (year) filter.date = Number(year);
    if (rating) filter.rating = { $gte: Number(rating) };
    if (desc) filter.description = { $regex: desc, $options: "i" };

    // if user provides a genre
    if (genre) {
      // get all movie ids in this genre
      const genreIds = await genreCol
        .find({ genre: { $regex: genre, $options: "i" } })  // finds all matching genre docs
        .project({ id: 1, _id: 0 })   // only return the id field of each genre not full doc
        .map(doc => doc.id)   // convert each genre document to its movie ID
        .toArray();           

      if (genreIds.length === 0) {
        return res.json([]); // no movies in this genre
      }

      // filter movies by those ids
      filter.id = { $in: genreIds };
    }

    // query movies collection with filter, limit 50
    let movies = await moviesCol.find(filter).limit(50).toArray();

    // attach genres to movies and map fields for frentend
    if (movies.length) {
      const movieIds = movies.map(m => m.id);   // extract all movie IDs in this result set

      const genresList = await genreCol
        .find({ id: { $in: movieIds } })    // finds all documents in genreCol whose ID is in movieIds
        .project({ id: 1, genre: 1, _id: 0 }) // return movie ID and genre string, exclude MongoDB's automatic _id field
        .toArray();

      // build a lookup map. key = movie ID, value = array of genres for that movie
      const genreMap = {};
      genresList.forEach(g => {
        if (!genreMap[g.id]) genreMap[g.id] = [];
        genreMap[g.id].push(g.genre);
      });

      // attach array of genre names to each movie
      movies.forEach(m => {
        m.genre = genreMap[m.id] || [];
        m.title = m.name;     // map name to title
        m.year = m.date;      // map date to year
      });
    }

    // send final array of movies to client
    res.status(200).json(movies);
  } catch (err) {
    console.error("GET /record error:", err);
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
