// routes/genre.js
import { Router } from "express";
// mondgodb connection
import db from "../db/connection.js";

// used to store routes for later use
const router = Router();

// GET /genre/:name
router.get("/", async (req, res) => {
  try {
    const { name } = req.params;

    // collect movies table data
    const docs = await db.collection("movies").aggregate([
    // join data from genre collection with data from movie collection
      {
        $lookup: {
          from: "genre",    // collection
          localField: "id",      // the field in movies to match
          foreignField: "id",    // the field in genre to match
          as: "genres"      // resulting array of matched genres
        }
      },
      {
        // filter movies to only those whose joined genres match the name of searched genre
        $match: { "genres.genre": { $regex: name, $options: "i" } }
      },
      // only display 50 movies
      { $limit: 1 },
      {
        // select and rename fields in the output
        $project: {
          title: "$name",   // map the DB field name to title for frontend
          year: "$date",    // map date field to year
          rating: 1,        // include rating field
          posterUrl: 1,     // include poster URL
          description: 1,   // include description
          genres: "$genres.genre"   // convert genres array to only include the genre strings
        }
      }
    ]).toArray();

    if (docs.length === 0) {
      return res.status(404).json({ error: `No movies found in genre: ${name}` });
    }

    // send the filtered, projected movies to the frontend
    res.status(200).json(docs);
  } catch (err) {
    console.error("GET /genre/:name error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
