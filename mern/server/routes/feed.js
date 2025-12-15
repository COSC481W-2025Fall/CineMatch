// server/routes/feed.js
import fetch from "node-fetch";
import { Router } from "express";
import db from "../db/connection.js";

const router = Router();
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const AGE_RATINGS = {
    0: "Not Rated",
    1: "G",
    2: "PG",
    3: "PG-13",
    4: "R",
    5: "NC-17",
};

function formatMovieForFeed(doc) {
    const genreArray = doc.genres
        ? String(doc.genres)
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];

    return {
        tmdbId: doc.id,
        id: doc.id,
        title: doc.name,
        year: doc.date,
        rating: doc.rating,
        posterUrl: doc.poster_path
            ? `${TMDB_IMAGE_BASE}${doc.poster_path}`
            : null,
        backdropUrl: doc.backdrop_path
            ? `https://image.tmdb.org/t/p/original${doc.backdrop_path}`
            : null,
        genre: genreArray,
        description: doc.descriptions || "",
        ageRating: AGE_RATINGS[doc.age_rating] || null,
        popularity: doc.popularity ?? 0,
        keywords: doc.keywords
            ? String(doc.keywords)
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
            : [],
    };
}

function normalizeLabel(s) {
    return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Weights
const WATCHED_WEIGHT   = 1;
const LIKED_WEIGHT     = 10;
const DISLIKED_WEIGHT  = -15;

// Fetch genres helper
async function fetchGenres(tmdbId) {
    if (!tmdbId || !TMDB_API_KEY) return [];

    const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
    url.searchParams.set("api_key", TMDB_API_KEY);

    const resp = await fetch(url.toString(), {
        headers: { accept: "application/json" },
    });
    if (!resp.ok) return [];

    const json = await resp.json();
    const genres = Array.isArray(json?.genres) ? json.genres : [];
    return genres
        .map((g) => Number(g.id))
        .filter((n) => Number.isFinite(n) && n > 0);
}

/*router.post("/", async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: "TMDB key missing on server" });
        }

        const watchedIds = Array.isArray(req.body?.watchedIds)
            ? req.body.watchedIds
            : [];

        const likedTmdbIds = Array.isArray(req.body?.likedTmdbIds)
            ? req.body.likedTmdbIds
            : [];

        const dislikedTmdbIds = Array.isArray(req.body?.dislikedTmdbIds)
            ? req.body.dislikedTmdbIds
            : [];

        const limit = Math.max(
            1,
            Math.min(50, Number(req.body?.limit) || 20)
        );

        // Return empty array if nothing in arrays
        if (
            !watchedIds.length &&
            !likedTmdbIds.length &&
            !dislikedTmdbIds.length
        ) {
            return res.json({ items: [] });
        }

        // Normalizes all ids to numbers and sets
        const watchedSet = new Set(
            watchedIds
                .map(Number)
                .filter((n) => Number.isFinite(n) && n > 0)
        );
        const likedSet = new Set(
            likedTmdbIds
                .map(Number)
                .filter((n) => Number.isFinite(n) && n > 0)
        );
        const dislikedSet = new Set(
            dislikedTmdbIds
                .map(Number)
                .filter((n) => Number.isFinite(n) && n > 0)
        );

        const agg = new Map();
        const exclude = new Set();

        // Watched and disliked movies excluded from feed
        for (const id of watchedSet) exclude.add(id);
        for (const id of dislikedSet) exclude.add(id);

        // Disliked movies genre list
        const dislikedGenreSets = [];
        for (const tmdbId of dislikedSet) {
            const genres = await fetchGenres(tmdbId);
            if (genres.length) {
                dislikedGenreSets.push(new Set(genres));
            }
        }

        // Union of all seeded movies
        const seedIds = new Set([
            ...watchedSet,
            ...likedSet,
            ...dislikedSet,
        ]);

        // Helper to add weights to seeded id's
        async function addRecsFromSeed(tmdbId, seedWeight) {
            const url = new URL(
                `${TMDB_BASE_URL}/movie/${tmdbId}/recommendations`
            );
            url.searchParams.set("api_key", TMDB_API_KEY);

            const resp = await fetch(url.toString(), {
                headers: { accept: "application/json" },
            });
            if (!resp.ok) return;

            const json = await resp.json();
            const results = Array.isArray(json?.results)
                ? json.results
                : [];

            for (const rec of results) {
                if (typeof rec?.id !== "number") continue;
                const key = rec.id;
                const rating = Number(rec?.vote_average) || 0;
                const genres = Array.isArray(rec?.genre_ids)
                    ? rec.genre_ids.map(Number).filter((n) => Number.isFinite(n))
                    : [];

                if (agg.has(key)) {
                    const entry = agg.get(key);
                    entry.score += seedWeight;
                    entry.count += 1;
                    if (rating > entry.rating) entry.rating = rating;
                } else {
                    agg.set(key, {
                        id: key,
                        score: seedWeight,
                        count: 1,
                        rating,
                        genres,
                        sample: rec,
                    });
                }
            }
        }

        // Contribute positive or negative weights
        for (const id of seedIds) {
            const tmdbId = Number(id);
            if (!tmdbId || isNaN(tmdbId)) continue;

            let weight = 0;
            if (watchedSet.has(tmdbId))   weight += WATCHED_WEIGHT;
            if (likedSet.has(tmdbId))     weight += LIKED_WEIGHT;
            if (dislikedSet.has(tmdbId))  weight += DISLIKED_WEIGHT;

            // Skip if no weight
            if (weight === 0) continue;

            await addRecsFromSeed(tmdbId, weight);
        }

        // Disliked movie check
        function tooCloseToDisliked(entry) {
            if (!dislikedGenreSets.length) return false;
            const recGenres = entry.genres || [];
            if (!recGenres.length) return false;

            // Exlude recommendations with 2 or more matching genres to a disliked movie
            for (const dSet of dislikedGenreSets) {
                let overlap = 0;
                for (const g of recGenres) {
                    if (dSet.has(g)) {
                        overlap += 1;
                        if (overlap >= 2) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        const sorted = Array.from(agg.values())
            // Filter recommended movies the user has watched, explicitly disliked, and is similar to disliked
            .filter((x) => !exclude.has(x.id) && !tooCloseToDisliked(x))
            // Sort by total score then rating
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    b.rating - a.rating
            )
            .slice(0, limit)
            .map((x) => x.sample);

        const items = sorted.map((r) => ({
            tmdbId: r.id,
            title: r.title || r.name || "Untitled",
            year: (r.release_date || "").slice(0, 4) || null,
            rating:
                typeof r.vote_average === "number"
                    ? Number(r.vote_average.toFixed(1))
                    : null,
            overview: r.overview || "",
            posterPath: r.poster_path || null,
        }));

        res.json({ items });
    } catch (err) {
        console.error("POST /feed error:", err);
        res.status(500).json({ error: "Server error" });
    }
});*/

router.post("/", async (req, res) => {
    try {
        const {
            watchedIds = [],
            likedTmdbIds = [],
            dislikedTmdbIds = [],
            limit: rawLimit,
        } = req.body || {};

        const limit = Math.max(1, Math.min(50, Number(rawLimit) || 20));

        const watched = new Set(
            watchedIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        );
        const liked = new Set(
            likedTmdbIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        );
        const disliked = new Set(
            dislikedTmdbIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        );

        const col = db.collection("general");

        const hasProfile = watched.size > 0 || liked.size > 0;
        if (!hasProfile && disliked.size === 0) {
            const docs = await col
                .find({})
                .sort({ popularity: -1, date: -1 })
                .limit(limit)
                .toArray();
            return res.json({ items: docs.map(formatMovieForFeed) });
        }

        const profileIds = [...new Set([...watched, ...liked])];

        let profileDocs = [];
        if (profileIds.length > 0) {
            profileDocs = await col
                .find({ id: { $in: profileIds } })
                .project({ id: 1, genres: 1, keywords: 1, rating: 1 })
                .toArray();
        }

        const genreWeight = Object.create(null);
        const keywordWeight = Object.create(null);

        for (const doc of profileDocs) {
            let baseBoost = 0;
            if (watched.has(doc.id)) baseBoost += 1;
            if (liked.has(doc.id))   baseBoost += 4;

            if (baseBoost <= 0) continue;

            const genres = String(doc.genres || "")
                .split(",")
                .map((g) => normalizeLabel(g))
                .filter(Boolean);
            const keywords = String(doc.keywords || "")
                .split(",")
                .map((k) => normalizeLabel(k))
                .filter(Boolean);

            for (const g of genres) {
                genreWeight[g] = (genreWeight[g] || 0) + baseBoost;
            }
            for (const k of keywords) {
                keywordWeight[k] = (keywordWeight[k] || 0) + baseBoost;
            }
        }


        const dislikedGenreSet = new Set();
        if (disliked.size > 0) {
            const dislikedDocs = await col
                .find({ id: { $in: [...disliked] } })
                .project({ genres: 1 })
                .toArray();

            for (const doc of dislikedDocs) {
                const genres = String(doc.genres || "")
                    .split(",")
                    .map((g) => normalizeLabel(g))
                    .filter(Boolean);
                for (const g of genres) {
                    dislikedGenreSet.add(g);
                }
            }
        }


        const excludeIds = [...new Set([...watched, ...disliked])];
        const baseFilter =
            excludeIds.length > 0 ? { id: { $nin: excludeIds } } : {};

        const candidates = await col
            .find(baseFilter)
            .sort({ popularity: -1, date: -1 })
            .limit(600)
            .toArray();

        function scoreCandidate(doc) {
            let score = 0;

            const genres = String(doc.genres || "")
                .split(",")
                .map((g) => normalizeLabel(g))
                .filter(Boolean);
            const keywords = String(doc.keywords || "")
                .split(",")
                .map((k) => normalizeLabel(k))
                .filter(Boolean);

            for (const g of genres) {
                if (genreWeight[g]) {
                    score += genreWeight[g] * 2;
                }
                if (dislikedGenreSet.has(g)) {
                    score -= 4;
                }
            }

            for (const k of keywords) {
                if (keywordWeight[k]) {
                    score += keywordWeight[k];
                }
            }

            if (typeof doc.rating === "number") {
                score += doc.rating / 2;
            }
            if (typeof doc.popularity === "number") {
                score += doc.popularity / 3000;
            }

            return score;
        }

        let scored = candidates
            .map((doc) => ({ doc, score: scoreCandidate(doc) }))
            .filter((x) => x.score > 0);

        if (scored.length) {
            scored.sort((a, b) => b.score - a.score);

            const POOL_SIZE = Math.min(scored.length, limit * 3);
            const pool = scored.slice(0, POOL_SIZE);

            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            const selected = pool.slice(0, limit);
            return res.json({ items: selected.map(({ doc }) => formatMovieForFeed(doc)) });
        }

        const docs = await col
            .find(baseFilter)
            .sort({ popularity: -1, date: -1 })
            .limit(limit)
            .toArray();
        return res.json({ items: docs.map(formatMovieForFeed) });
    } catch (err) {
        console.error("POST /feed error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
