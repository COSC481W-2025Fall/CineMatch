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
            const baseBoost =
                liked.has(doc.id) ? 3 : watched.has(doc.id) ? 1 : 0;
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
                score += doc.popularity / 1000;
            }

            return score;
        }

        const scored = candidates
            .map((doc) => ({ doc, score: scoreCandidate(doc) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ doc }) => formatMovieForFeed(doc));


        if (!scored.length) {
            const docs = await col
                .find(baseFilter)
                .sort({ popularity: -1, date: -1 })
                .limit(limit)
                .toArray();
            return res.json({ items: docs.map(formatMovieForFeed) });
        }

        return res.json({ items: scored });
    } catch (err) {
        console.error("POST /feed error:", err);
        res.status(500).json({ error: "Server error" });
    }
});


export default router;
