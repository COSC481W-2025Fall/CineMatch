// TODO: better comments and structure in this
// routes/record.js
import { Router } from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

// store all /record routes to use later
const router = Router();
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// mapping
const AGE_RATINGS = {
    0: "Not Rated",
    1: "G",
    2: "PG",
    3: "PG-13",
    4: "R",
    5: "NC-17"
};

// normalize inputs
function normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

const formatMovie = (doc) => {
    // turn comma seperated into array
    const genreArray = doc.genres ? doc.genres.split(", ") : [];

    // make full poster if path exists
    const posterUrl = doc.poster_path
        ? `${TMDB_IMAGE_BASE}${doc.poster_path}`
        : null;

    const backdropUrl = doc.backdrop_path
        ? `https://image.tmdb.org/t/p/original${doc.backdrop_path}`
        : null;

    return {
        id: doc.id,
        title: doc.name,
        year: doc.date,
        rating: doc.rating,
        posterUrl: posterUrl,
        backdropUrl: backdropUrl,
        genre: genreArray,
        description: doc.descriptions,
        runtime: doc.runtime || doc.minute,
        ageRating: AGE_RATINGS[doc.age_rating] || null,
        // For details view specifically:
        topCast: doc.actors ? doc.actors.split(", ").slice(0, 100) : [],
        directors: doc.directors ? doc.directors.split(", ") : [],
        keywords: doc.keywords ? doc.keywords.split(", ") : []
    };
};

// GET /record - Search functionality
router.get("/", async (req, res) => {
    try {
        const collection = db.collection("general");
        const {
            title, name, // these should be the same thing, will fix later
            director, actor, genre, keyword,
            year_min, year_max,
            rating_min, rating_max,
            age_rating
        } = req.query;

        const filter = {};

        // normalization added to all searches
        // search title
        const qName = name ?? title;
        if (qName) {
            // normalize here
            const cleanName = normalizeString(qName);
            filter.search_name = { $regex: cleanName, $options: "i" };
        }

        // search year
        const yMin = Number(year_min);
        const yMax = Number(year_max);
        if (!Number.isNaN(yMin) || !Number.isNaN(yMax)) {
            filter.date = {};
            if (!Number.isNaN(yMin)) filter.date.$gte = yMin;
            if (!Number.isNaN(yMax)) filter.date.$lte = yMax;
        }

        // search rating
        const rMin = Number(rating_min);
        const rMax = Number(rating_max);
        if (!Number.isNaN(rMin) || !Number.isNaN(rMax)) {
            filter.rating = {};
            if (!Number.isNaN(rMin)) filter.rating.$gte = rMin;
            filter.rating.$lte = Number.isNaN(rMax) ? 10 : rMax;
        }

        // search directors
        if (director) {
            const cleanDirector = normalizeString(director);
            filter.search_directors = { $regex: cleanDirector, $options: "i" };
        }

        // SEARCH BY ACTOR (supports single or multiple actors, AND logic)
        if (actor) {
            // split with comma and and them
            const actorsList = actor.split(",").map(a => normalizeString(a)).filter(Boolean);


            if (actorsList.length > 0) {
                filter.$and = filter.$and || [];
                actorsList.forEach(a => {
                    filter.$and.push({ search_actors: { $regex: a, $options: "i" } });
                });

            }
        }

        // genre search
        if (genre) {
            const genreList = Array.isArray(genre) ? genre : genre.split(",");
            filter.$and = filter.$and || [];
            genreList.forEach(g => {
                if(g.trim()) {
                    filter.$and.push({ genres: { $regex: g.trim(), $options: "i" } });
                }
            });
        }

        // age rating search
        if (age_rating) {
            const ratings = (Array.isArray(age_rating) ? age_rating : age_rating.split(","))
                .map(Number)
                .filter(n => Number.isFinite(n));

            if (ratings.length > 0) {
                filter.age_rating = { $in: ratings };
            }
        }

        if (keyword) {
            // use comma same as actors to search multiple
            const keywordList = keyword.split(",").map(k => k.trim()).filter(Boolean);
            if (keywordList.length > 0) {
                filter.$and = filter.$and || [];
                keywordList.forEach(k => {
                    filter.$and.push({ keywords: { $regex: k, $options: "i" } });
                });
            }
        }

        // do querey
        const docs = await collection
            .find(filter)
            .sort({ popularity: -1, date: -1 }) // Sort by popularity, then newness
            .limit(200)
            .toArray();

        // format results
        const results = docs.map(doc => formatMovie(doc));

        res.status(200).json(results);

    } catch (err) {
        console.error("GET /record error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// GET /record/details/:id
router.get("/details/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

        const doc = await db.collection("general").findOne({ id });

        if (!doc) {
            return res.status(404).json({ error: "Movie not found" });
        }

        res.status(200).json(formatMovie(doc));

    } catch (err) {
        console.error("GET /record/:id error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// POST /record/bulk - Fetch list of movies by IDs (for Watchlists)
router.post("/bulk", async (req, res) => {
    try {
        const rawIds = req.body?.ids || [];
        // filter out non numbers
        const ids = rawIds.map(Number).filter(n => Number.isFinite(n));

        if (ids.length === 0) return res.status(200).json([]);

        const {
            title, director, actor, genre, keyword,
            year, rating, age_rating
        } = req.body?.params || {};

        const filter = { id: { $in: ids } };

        // apply filters
        if (title) filter.name = { $regex: title, $options: "i" };

        if (year) {
            const yNum = Number(year);
            if (!Number.isNaN(yNum)) filter.date = yNum;
        }

        if (rating) {
            const rNum = Number(rating);
            if (!Number.isNaN(rNum)) filter.rating = { $gte: rNum };
        }

        // age ratings
        if (age_rating) {
            const ratings = (Array.isArray(age_rating) ? age_rating : age_rating.split(","))
                .map(Number)
                .filter(n => Number.isFinite(n));
            if (ratings.length > 0) {
                filter.age_rating = { $in: ratings };
            }
        }

        // simplified this a lot, seems to work well
        if (director) filter.directors = { $regex: director, $options: "i" };

        if (actor) filter.actors = { $regex: actor, $options: "i" };

        if (genre) filter.genres = { $regex: genre, $options: "i" };

        if (keyword) filter.keywords = { $regex: keyword, $options: "i" };

        const docs = await db.collection("general")
            .find(filter)
            .sort({ popularity: -1 }) // possible to expand this to what the indexes are but leaving at this for now
            .toArray();

        const results = docs.map(doc => formatMovie(doc));

        res.status(200).json(results);

    } catch (err) {
        console.error("POST /record/bulk error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.get("/tmdb/:id", async (req, res) => {
    try {
        const tmdbId = Number(req.params.id);
        if (!Number.isFinite(tmdbId)) {
            return res.status(400).json({ error: "Invalid TMDB id" });
        }

        const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
        url.searchParams.set("api_key", process.env.VITE_TMDB_API_KEY);
        url.searchParams.set("append_to_response", "credits,watch/providers");

        const tmdbRes = await fetch(url.toString(), {
            headers: { accept: "application/json" },
        });

        if (!tmdbRes.ok) {
            return res
                .status(tmdbRes.status)
                .json({ error: `TMDB error HTTP ${tmdbRes.status}` });
        }

        const data = await tmdbRes.json();
        return res.json(data);
    } catch (err) {
        console.error("GET /record/tmdb/:id error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});


router.get("/collection/:collectionId", async (req, res) => {
    try {
        const { collectionId } = req.params;

        if (!process.env.VITE_TMDB_API_KEY) {
            console.error("[TMDB COLLECTION] TMDB_API_KEY not set");
            return res
                .status(500)
                .json({ error: "TMDB API key is not configured on the server" });
        }

        const url = new URL(`https://api.themoviedb.org/3/collection/${collectionId}`);
        url.searchParams.set("api_key", process.env.VITE_TMDB_API_KEY);

        console.log("[TMDB COLLECTION] Fetching:", url.toString());

        const tmdbRes = await fetch(url.toString(), {
            headers: { accept: "application/json" },
        });

        if (!tmdbRes.ok) {
            const text = await tmdbRes.text().catch(() => "");
            console.error(
                "[TMDB COLLECTION] TMDB error",
                tmdbRes.status,
                tmdbRes.statusText,
                text
            );
            return res
                .status(tmdbRes.status)
                .json({
                    error: `TMDB collection fetch failed: HTTP ${tmdbRes.status}`,
                });
        }

        const data = await tmdbRes.json();
        res.json(data);
    } catch (err) {
        console.error("[TMDB COLLECTION] Internal error:", err);
        res.status(500).json({ error: "Failed to fetch TMDB collection" });
    }
});


export default router;