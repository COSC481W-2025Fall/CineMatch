// TODO: This entire script needs to be redone at some point.
// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = Router();
// NOT IMPLEMENTED: ACTOR, DIRECTOR, AND GENRE
// GET /record?name=&year=&desc=
// routes/record.js
router.get("/actors", async (req, res) => {
  try {
    const col = db.collection("actors");

    const { name,movies } = req.query;
    const filter = {};
    const Name = name ?? title;                 
    if (Name) filter.name = { $regex: Name, $options: "i" };
    if (movie) filter.role = { $regex: movie, $options: "i" };


const docs = await db.collection("actors").find(filter).limit(50).toArray();
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// we are probably not going to use by ID but it's here.
// GET /record/:id

export default router;
