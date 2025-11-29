// TODO: better comments and structure in this
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


        const { title, name, director, actor, year_min, year_max, rating_min, rating_max, genre } = req.query;
        // build the base movie filter
        const filter = {};
        const qName = name ?? title;
        if (qName)  filter.name = { $regex: qName, $options: "i" };
        // YEAR RANGE (inclusive)
        const yMin = Number(year_min);
        const yMax = Number(year_max);
        const yearRange = {};
        if (!Number.isNaN(yMin)) yearRange.$gte = yMin;
        if (!Number.isNaN(yMax)) yearRange.$lte = yMax;
        if (Object.keys(yearRange).length) filter.date = yearRange;
        // RATING RANGE (inclusive)
        const MAX_RATING = 10;
        const yMinRating = Number(rating_min);
        const yMaxRating = Number(rating_max);
        // Validate numbers must be in [0, 10]
        if (!Number.isNaN(yMinRating) && (yMinRating < 0 || yMinRating > MAX_RATING)) {
            return res.status(400).json({ error: `Maximum rating must be between 0 and ${MAX_RATING}.` });
        }
        if (!Number.isNaN(yMaxRating) && (yMaxRating < 0 || yMaxRating > MAX_RATING)) {
            return res.status(400).json({ error: `Maximum rating must be between 0 and ${MAX_RATING}.` });
        }
        // Validate: min <= max (only if both provided)
        if (!Number.isNaN(yMinRating) && !Number.isNaN(yMaxRating) && yMinRating > yMaxRating) {
            return res.status(400).json({ error: `Minimum rating (${yMinRating}) cannot be greater than the maximum (${yMaxRating}).` });
        }
        const ratingRange = {};
        if (!Number.isNaN(yMinRating)) ratingRange.$gte = yMinRating;
        // Always set an upper bound of 10
        // If user provided a max, use the smaller of their value and 10
        ratingRange.$lte = Number.isNaN(yMaxRating) ? MAX_RATING : Math.min(yMaxRating, MAX_RATING);
        // Only attach if at least one bound is present
        if (Object.keys(ratingRange).length) filter.rating = ratingRange;
        if (Object.keys(ratingRange).length) filter.rating = ratingRange;


        // This chunk is just to help us connect the ID's together to make it an AND operation and not an OR operation.
        let setID = null;
        const syncID = (arr) => {
            const clean = arr.filter(v => v !== null && v !== undefined);
            if(clean.length === 0) return false;
            if(setID)
            {
                const next = new Set(clean);
                const intersection = new Set([...setID].filter(x => next.has(x)));
                if (intersection.size === 0) return false;
                setID = intersection;
            } else {
                setID = new Set(clean);
            }
            return true;

        };

        // SEARCH BY DIRECTOR
        if (director) {
            // Find director whose name matches the query provided
            const directorRows = await directorsCol.aggregate([
                // find director data whose name matches (CASE INSENSITIVE)
                { $match: { name: { $regex: director, $options: "i" } } },
                { $group: { _id: "$id" } },   // distinct, shoooould allow for no repeats
                { $limit: 500 }                 // limit will possibly be smaller in the future
            ]).toArray();


            ///////////////
            if (!syncID(directorRows.map(r => r._id))) return res.status(200).json([]);
            ///////////////
        }

        // SEARCH BY ACTOR
        if (actor) {

            const actorRows = await actorsCol.aggregate([
                { $match: { name: { $regex: actor, $options: "i" } } },

                { $group: { _id: "$id" } },   // distinct, shoooould allow for no repeats
                { $limit: 500 }                 // the actors database is very big, we had to make this smaller
            ]).toArray();

            if (!syncID(actorRows.map(r => r._id))) return res.status(200).json([]);

        }

        if (setID) { filter.id = {$in: Array.from(setID)};}

        // SEARCH BY GENRE using OR statement. DISABLED
        /*
        if (genre && (Array.isArray(genre) ? genre.length : true)) {
            const genreSelected = Array.isArray(genre) ? genre.join("|") : genre;
            const genreIds = await genreCol
                .find({ genre: { $regex: genreSelected, $options: "i" } }, { projection: { _id: 0, id: 1 } })
                .limit(500)
                .map(doc => doc.id)
                .toArray();

            if (!syncID(genreIds)) return res.status(200).json([]);
        }*/

        // SEARCH BY GENRE using AND statement. DISABLED
        // If the user selected one or more genres, only keep movies that match all of them
        /*if (genre) {
            const genreSelected = Array.isArray(genre) ? genre : [genre];
            // AND logic applied by intersecting IDs one genre at a time
            for (const singularGenre of genreSelected) {
                const idsForGenre= await genreCol
                    .find(
                        { genre: { $regex: singularGenre, $options: "i" } },
                        { projection: { _id: 0, id: 1 } }
                    )
                    .limit(500) // Limit changed from 2000 for performance
                    .map(doc => doc.id)
                    .toArray();
                if (!syncID(idsForGenre)) return res.status(200).json([]);
            }
        }*/

        // ADDED NEW FIX WITH GENRES, THE LIMIT IS CAUSING AN ISSUE! -YS
        // SEARCH BY GENRE using AND statement. ENABLED
        // If the user selected one or more genres, only keep movies that match all of them
        if (genre) {
            const genreSelected = Array.isArray(genre) ? genre : [genre];
            for (const singularGenre of genreSelected) {
                const genreFilter = { genre: { $regex: singularGenre, $options: "i" } };
                if (setID && setID.size) genreFilter.id = {$in: Array.from(setID)};

                const idsForGenre = await genreCol
                    .find(genreFilter, { projection: { _id: 0, id: 1 } })
                    .map(doc => doc.id)
                    .toArray();
                if (!syncID(idsForGenre)) return res.status(200).json([]);
            }
        }

        if (setID) {filter.id = { $in: Array.from(setID) };}

        const movies = await moviesCol.aggregate([
            { $match: filter },
            { $sort: { popularity: -1, rating: -1, date: -1, name: 1 } },
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

        if (movies.length === 0) return res.status(200).json([]);

        {
            const ids = movies.map(m => m.id).filter(Boolean);
            if (ids.length) {
                const rows = await genreCol
                    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, genre: 1 } })
                    .toArray();

                const map = new Map(); // id -> array of genres
                for (const r of rows) {
                    if (!map.has(r.id)) map.set(r.id, []);
                    map.get(r.id).push(r.genre);
                }

                for (const m of movies) { m.genre = Array.isArray(m.genre) ? m.genre : (map.get(m.id) || []);}
            } else { for (const m of movies) m.genre = Array.isArray(m.genre) ? m.genre : [];}
        }

        ////////// END OF SEARCH BY GENRE
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


// GET /record/details/:id
/**
 * Retrieve detailed info about a movie including genres, poster URL, and top cast members from multiple tables in MongoDB.
 * Look up movie by ID, grab movie info, put into object to send to frontend.
 */
router.get("/details/:id", async (req, res) => {
    try {

        // convert route param to number to match numeric IDs and set references to all tables
        const id = Number(req.params.id);
        const moviesCol   = db.collection("movies");
        const postersCol  = db.collection("posters");
        const genreCol    = db.collection("genre");
        const actorsCol   = db.collection("actors");
        const directorsCol = db.collection("directors");

        // find movie from movie table using its ID
        const movie = await moviesCol.findOne({ id });
        if (!movie) return res.status(404).json({ error: "Movie not found" });

        // look up all genre docs for movie ID
        const grows = await genreCol
            .find({ id }, { projection: { _id: 0, genre: 1 } })     // return only genre field
            .toArray();
        const genres = grows.map(g => g.genre);             // map array of docs to simple array of strings i.e. ["Sci-fi", "Romance"]

        // get poster and backdrop
        // store backdrop if available
        const prow = await postersCol.findOne(
            { id },
            { projection: { _id: 0, link: 1, backdrop_link: 1 } }
        );

        let posterUrl = movie.posterUrl ?? prow?.link ?? null;
        let backdropUrl = prow?.backdrop_link ?? null;

        // pipeline to get top 5 cast by movie ID
        const castById = await actorsCol.aggregate([
            { $match: { id } },
            { $group: { _id: "$name", appearances: { $sum: 1 } } },     // group actors by name, count # of appearances
            { $sort: { appearances: -1, _id: 1 } },                     // sort by most frequent actors then by alphabetically
            { $limit: 5 }
        ]).toArray();

        // find cast using title of movie if no actors match movie ID and use same pipeline above
        let topCast = castById.map(d => d._id);
        if (topCast.length === 0) {
            const castByTitle = await actorsCol.aggregate([
                { $match: { role: movie.name } },
                { $group: { _id: "$name", appearances: { $sum: 1 } } },
                { $sort: { appearances: -1, _id: 1 } },
                { $limit: 5 }
            ]).toArray();
            topCast = castByTitle.map(d => d._id);
        }

        // Directors portion
        // This is needed for our tests
        const dirDocs = await directorsCol
            .find(
                { id },
                { projection: { _id: 0, name: 1 } }
            )
            .limit(5)
            .toArray();
        const directorNames = dirDocs.map(d => d.name).filter(Boolean);



        const dir = await directorsCol
            .find(
                { id },
                { projection: { _id: 0, name: 1 } }
            )
            .limit(5)
            .toArray();
        const directors = dir.map(d => d.name);

        // object created containing all movie info
        const payload = {
            id: movie.id,
            title: movie.name,
            year: movie.date,
            rating: movie.rating ?? null,
            posterUrl,
            backdropUrl,
            description: movie.descriptions ?? "", // changed to descriptions, not description to match label
            genres,
            topCast,
            directors: directorNames.length === 0 ? null : (directorNames.length === 1 ? directorNames[0] : directorNames),
            director: directors.length ? directors : null
        };
        // send movie details
        res.status(200).json(payload);
        // throw error for any mishaps
    } catch (err) {
        console.error("GET /record/details/:id error:", err);
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

// Added in new backend call to make the watched list and to-watch list more efficient
router.post("/bulk", async (req, res) => {
    try {
        const moviesCol    = db.collection("movies");
        const postersCol   = db.collection("posters");
        const actorsCol    = db.collection("actors");
        const directorsCol = db.collection("directors");
        const genreCol     = db.collection("genre");

        const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
        const params = req.body?.params || {};

        const watchedIds = rawIds.map(n => Number(n)).filter(n => !Number.isNaN(n));

        if (watchedIds.length === 0) {return res.status(200).json([]);}

        const baseFilter = {id: { $in: watchedIds }};

        const {
            actor = "",
            director = "",
            genre = "",
            title = "",
            year = "",
            rating = ""
        } = params;

        if (title) {
            baseFilter.name = { $regex: title, $options: "i" };
        }

        if (year) {
            const yNum = Number(year);
            if (!Number.isNaN(yNum)) {
                baseFilter.date = yNum;
            }
        }

        if (rating) {
            const rNum = Number(rating);
            if (!Number.isNaN(rNum)) {
                baseFilter.rating = { $gte: rNum };
            }
        }

        let allowedIds = new Set(watchedIds);

        // DIRECTOR filter
        if (director) {
            const directorRows = await directorsCol.aggregate([
                { $match: { name: { $regex: director, $options: "i" } } },
                { $group: { _id: "$id" } },
                { $limit: 500 }
            ]).toArray();

            const matchDirIds = new Set(directorRows.map(r => r._id));
            allowedIds = new Set([...allowedIds].filter(id => matchDirIds.has(id)));
            if (allowedIds.size === 0) {
                return res.status(200).json([]);
            }
        }

        // ACTOR filter
        if (actor) {
            const actorRows = await actorsCol.aggregate([
                { $match: { name: { $regex: actor, $options: "i" } } },
                { $group: { _id: "$id" } },
                { $limit: 500 }
            ]).toArray();

            const matchActorIds = new Set(actorRows.map(r => r._id));
            allowedIds = new Set([...allowedIds].filter(id => matchActorIds.has(id)));
            if (allowedIds.size === 0) {
                return res.status(200).json([]);
            }
        }

        // GENRE filter
        if (genre) {
            const genreRows = await genreCol
                .find(
                    { genre: { $regex: genre, $options: "i" } },
                    { projection: { _id: 0, id: 1 } }
                )
                .limit(500)
                .toArray();

            const matchGenreIds = new Set(genreRows.map(r => r.id));
            allowedIds = new Set([...allowedIds].filter(id => matchGenreIds.has(id)));
            if (allowedIds.size === 0) {
                return res.status(200).json([]);
            }
        }

        baseFilter.id = { $in: [...allowedIds] };


        // Return all we got in 1 aggregation
        const movies = await moviesCol.aggregate([
            { $match: baseFilter },
            { $sort: { popularity: -1, rating: -1, date: -1, name: 1 } },
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

        if (movies.length === 0) {
            return res.status(200).json([]);
        }

        {
            const ids = movies.map(m => m.id).filter(Boolean);
            if (ids.length) {
                const rows = await genreCol
                    .find(
                        { id: { $in: ids } },
                        { projection: { _id: 0, id: 1, genre: 1 } }
                    )
                    .toArray();

                const genreMap = new Map();
                for (const r of rows) {
                    if (!genreMap.has(r.id)) genreMap.set(r.id, []);
                    genreMap.get(r.id).push(r.genre);
                }

                for (const m of movies) {
                    m.genre = Array.isArray(m.genre)
                        ? m.genre
                        : (genreMap.get(m.id) || []);
                }
            } else {
                for (const m of movies) {
                    m.genre = Array.isArray(m.genre) ? m.genre : [];
                }
            }
        }

        const idsForPoster = movies.map(m => m.id).filter(Boolean);
        let posterMap = new Map();
        if (idsForPoster.length) {
            const posters = await postersCol.find(
                { id: { $in: idsForPoster } },
                { projection: { _id: 0, id: 1, link: 1 } }
            ).toArray();

            posterMap = new Map(posters.map(p => [p.id, p.link]));
        }

        const result = movies.map(m => ({
            ...m,
            posterUrl: m.posterUrl ?? posterMap.get(m.id) ?? m.posterUrl
        }));

        return res.status(200).json(result);
    } catch (err) {
        console.error("POST /record/bulk error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});


export default router;
