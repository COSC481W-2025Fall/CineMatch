// TODO: Reorganize
// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

// store all /record routes to use later
const router = Router();

router.get("/", async (req, res) => {
    try {
        const moviesCol  = db.collection("movies");
        const postersCol = db.collection("posters");
        const actorsCol = db.collection("actors");
        const directorsCol = db.collection("directors");
        const genreCol = db.collection("genre");


        // read the query parameters, (New: includes actor)
        const { title, name, director, actor, year, rating, desc, genre } = req.query;
        // build the base movie filter
        const filter = {};
        const qName = name ?? title;
        if (qName)  filter.name = { $regex: qName, $options: "i" };
        if (year)   filter.date = Number(year);
        if (rating) filter.rating = { $gte: Number(rating) };
        if (desc)   filter.description = { $regex: desc, $options: "i" };


        const syncID = (v) => v;

        let setID = null;

        if (director) {
            // Find director whose name matches the query provided
            const directorRows = await directorsCol.aggregate([
                // find director data whose name matches (CASE INSENSITIVE)
                { $match: { role: "Director", name: { $regex: director, $options: "i" } } },
                { $group: { _id: "$id" } },   // distinct, shoooould allow for no repeats
                { $limit: 500 }                 // limit will possibly be smaller in the future
            ]).toArray();

            // Attaches directors to the movies and builds aggregation
            ///////////////
            const directorID = directorRows.map(r => syncID(r._id)).filter(v => v !== null && v !== undefined);
            if (directorRows.length === 0) return res.status(200).json([]);   // when there is nothing matching, return nothing

            // narrows down the movie pipeline to only those that natch the above filter
            setID = new Set(directorID);
            ///////////////
        }

        if (actor) {
            // 1) Find actors whose name matches the query
            const actorRows = await actorsCol.aggregate([
                // find actor data who's name matches (CASE INSENSITIVE)
                { $match: { name: { $regex: actor, $options: "i" } } },
                // 2) Collapse duplicates: gives each distinct 'role' once.
                //In this schema, 'role' represents the MOVIE TITLE.
                { $group: { _id: "$id" } },   // distinct, shoooould allow for no repeats
                { $limit: 500 }                 // the actors database is very big, we had to make this smaller
            ]).toArray();

            // 4) Convert group results to a flat string array of titles
            const actorID = actorRows.map(r => syncID(r._id)).filter(v => v !== null && v !== undefined);
            if (actorID.length === 0) return res.status(200).json([]);   // when there is nothing matching, return nothing

            // narrows down the movie pipeline to only those that natch the above filter

            if(setID)
            {
                const intersection = actorID.filter(x => setID.has(x));
                if (intersection.length === 0) return res.status(200).json([]);
                setID = new Set(intersection);
            } else {
                setID = new Set(actorID);
            }

        }

        if (setID) { filter.id = {$in: Array.from(setID)};}

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
        let moviesGenre = await moviesCol.find(filter).limit(50).toArray();

        // attach genres to movies and map fields for frentend
        if (moviesGenre.length) {
            const movieIds = moviesGenre.map(m => m.id);   // extract all movie IDs in this result set

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
            moviesGenre.forEach(m => {
                m.genre = genreMap[m.id] || [];
                m.title = m.name;     // map name to title
                m.year = m.date;      // map date to year
            });
        }

        const movies = await moviesCol.aggregate([
            { $match: filter },
            { $sort: {rating: -1, date: -1, name: 1}},
            { $limit: 50 }, // We might have to eventually lower this, if performance takes even a bigger hit
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
        ]).toArray()



        // if user provides a genre


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
