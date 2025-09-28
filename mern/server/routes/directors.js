// routes/directors.js
import { Router } from "express";
import db from "../db/connection.js";


const router = Router();
// GET /record?directors?name=NAME
// Example: /record/directors?name=Quentin%20Tarantino
// routes/record/directors.js
router.get("/", async (req, res) => {
    try {

        const { name,movie } = req.query;
        const filter = {};
        if (name) filter.name = { $regex: name, $options: "i" };
        if (movie) filter.role = { $regex: movie, $options: "i" };


        const docs = await db.collection("directors").find(filter).limit(50).toArray();
        res.json(docs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
