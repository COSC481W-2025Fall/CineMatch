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

/*router.post("/", async (req, res) => {
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
            const genres = String(doc.genres || "")
                .split(",")
                .map((g) => normalizeLabel(g))
                .filter(Boolean);

            const keywords = String(doc.keywords || "")
                .split(",")
                .map((k) => normalizeLabel(k))
                .filter(Boolean);

            let sharedGenres = 0;
            let sharedKeywords = 0;
            let penalty = 0;

            for (const g of genres) {
                if (genreWeight[g]) {
                    sharedGenres++;
                }
                if (dislikedGenreSet.has(g)) {
                    penalty += 10;
                }
            }

            for (const k of keywords) {
                if (keywordWeight[k]) {
                    sharedKeywords++;
                }
            }

            if (sharedGenres === 0 && sharedKeywords === 0) {
                return -Infinity;
            }

            let score = 0;

            score += sharedGenres * 5;
            score += sharedKeywords * 3;

            if (typeof doc.rating === "number") {
                score += doc.rating * 0.3;
            }
            if (typeof doc.popularity === "number") {
                score += doc.popularity / 5000;
            }

            score -= penalty;
            return score;
        }

        const scored = candidates
            .map((doc) => ({ doc, score: scoreCandidate(doc) }))
            .filter((x) => Number.isFinite(x.score) && x.score > 0)
            .sort((a, b) => b.score - a.score);

        if (scored.length) {
            const POOL_SIZE = Math.min(scored.length, limit * 3);
            const pool = scored.slice(0, POOL_SIZE);

            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            const selected = pool.slice(0, limit).map(({ doc }) => formatMovieForFeed(doc));
            return res.json({ items: selected });
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
});*/

/*router.post("/", async (req, res) => {
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
                .project({
                    id: 1,
                    genres: 1,
                    keywords: 1,
                    actors: 1,
                    directors: 1,
                    date: 1,
                    rating: 1,
                    name: 1,
                })
                .toArray();
        }

        const genreWeight    = Object.create(null);
        const keywordWeight  = Object.create(null);
        const actorWeight    = Object.create(null);
        const directorWeight = Object.create(null);
        const titleWeight    = Object.create(null);

        let yearSum = 0;
        let yearCount = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        function bumpMap(map, tokens, weight) {
            for (const raw of tokens) {
                const key = normalizeLabel(raw);
                if (!key) continue;
                map[key] = (map[key] || 0) + weight;
            }
        }

        for (const doc of profileDocs) {
            let baseBoost = 0;
            if (watched.has(doc.id)) baseBoost += 1;
            if (liked.has(doc.id))   baseBoost += 4;
            if (baseBoost <= 0) continue;

            const genres = String(doc.genres || "").split(",");
            const keywords = String(doc.keywords || "").split(",");
            const actors = String(doc.actors || "").split(",");
            const directors = String(doc.directors || "").split(",");
            const titleTokens = String(doc.name || "")
                .split(/[^A-Za-z0-9]+/)
                .filter((t) => t.length >= 3);


            bumpMap(genreWeight, genres, baseBoost * 1.5);
            bumpMap(keywordWeight, keywords, baseBoost * 1.5);
            bumpMap(actorWeight, actors, baseBoost * 4);
            bumpMap(titleWeight, titleTokens, baseBoost * 4);
            bumpMap(directorWeight, directors, baseBoost * 2.5);

            const y = Number(doc.date);
            if (Number.isFinite(y)) {
                yearSum += y * baseBoost;
                yearCount += baseBoost;
            }
            const r = Number(doc.rating);
            if (Number.isFinite(r)) {
                ratingSum += r * baseBoost;
                ratingCount += baseBoost;
            }
        }

        const avgYear   = yearCount   > 0 ? yearSum / yearCount : null;
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

        const dislikedGenreSet    = new Set();
        const dislikedActorSet    = new Set();
        const dislikedDirectorSet = new Set();
        const dislikedTitleSet    = new Set();

        if (disliked.size > 0) {
            const dislikedDocs = await col
                .find({ id: { $in: [...disliked] } })
                .project({ genres: 1, actors: 1, directors: 1, name: 1 })
                .toArray();

            for (const doc of dislikedDocs) {
                const genres = String(doc.genres || "").split(",");
                const actors = String(doc.actors || "").split(",");
                const directors = String(doc.directors || "").split(",");
                const titleTokens = String(doc.name || "")
                    .split(/[^A-Za-z0-9]+/)
                    .filter((t) => t.length >= 3);

                for (const g of genres) {
                    const k = normalizeLabel(g);
                    if (k) dislikedGenreSet.add(k);
                }
                for (const a of actors) {
                    const k = normalizeLabel(a);
                    if (k) dislikedActorSet.add(k);
                }
                for (const d of directors) {
                    const k = normalizeLabel(d);
                    if (k) dislikedDirectorSet.add(k);
                }
                for (const t of titleTokens) {
                    const k = normalizeLabel(t);
                    if (k) dislikedTitleSet.add(k);
                }
            }
        }

        const excludeIds = [...new Set([...watched, ...disliked])];
        const baseFilter =
            excludeIds.length > 0 ? { id: { $nin: excludeIds } } : {};

        const candidates = await col
            .find(baseFilter)
            .sort({ popularity: -1, date: -1 })
            .limit(800)
            .toArray();

        function scoreCandidate(doc) {
            const genres = String(doc.genres || "").split(",");
            const keywords = String(doc.keywords || "").split(",");
            const actors = String(doc.actors || "").split(",");
            const directors = String(doc.directors || "").split(",");
            const titleTokens = String(doc.name || "")
                .split(/[^A-Za-z0-9]+/)
                .filter((t) => t.length >= 3);

            let score = 0;

            for (const aRaw of actors) {
                const a = normalizeLabel(aRaw);
                if (!a) continue;
                if (actorWeight[a]) score += actorWeight[a] * 5;
                if (dislikedActorSet.has(a)) score -= 15;
            }

            for (const dRaw of directors) {
                const d = normalizeLabel(dRaw);
                if (!d) continue;
                if (directorWeight[d]) score += directorWeight[d] * 2.5;
                if (dislikedDirectorSet.has(d)) score -= 10;
            }

            for (const gRaw of genres) {
                const g = normalizeLabel(gRaw);
                if (!g) continue;
                if (genreWeight[g]) score += genreWeight[g] * 1.5;
                if (dislikedGenreSet.has(g)) score -= 6;
            }

            for (const kRaw of keywords) {
                const k = normalizeLabel(kRaw);
                if (!k) continue;
                if (keywordWeight[k]) score += keywordWeight[k] * 1.5;
            }

            for (const tRaw of titleTokens) {
                const t = normalizeLabel(tRaw);
                if (!t) continue;
                if (titleWeight[t]) score += titleWeight[t] * 5;
                if (dislikedTitleSet.has(t)) score -= 12;
            }

            if (score === 0) return -Infinity;

            const y = Number(doc.date);
            if (avgYear !== null && Number.isFinite(y)) {
                const diff = Math.abs(y - avgYear);
                const yearBonus = Math.max(0, 10 - diff);
                score += yearBonus * 0.4;
            }

            const r = Number(doc.rating);
            if (Number.isFinite(r)) {
                score += r * 0.4;
                if (avgRating !== null) {
                    const diffR = Math.abs(r - avgRating);
                    const ratingBonus = Math.max(0, 4 - diffR);
                    score += ratingBonus * 0.5;
                }
            }

            if (typeof doc.popularity === "number") {
                score += doc.popularity / 5000;
            }

            return score;
        }

        const scored = candidates
            .map((doc) => ({ doc, score: scoreCandidate(doc) }))
            .filter((x) => Number.isFinite(x.score) && x.score > 0)
            .sort((a, b) => b.score - a.score);

        if (scored.length) {
            const POOL_SIZE = Math.min(scored.length, limit * 3);
            const pool = scored.slice(0, POOL_SIZE);

            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }

            const selected = pool.slice(0, limit).map(({ doc }) => formatMovieForFeed(doc));
            return res.json({ items: selected });
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
                .project({
                    id: 1,
                    genres: 1,
                    keywords: 1,
                    actors: 1,
                    directors: 1,
                    date: 1,
                    rating: 1,
                    name: 1,
                })
                .toArray();
        }

        const genreWeight   = Object.create(null);
        const keywordWeight = Object.create(null);
        const actorWeight   = Object.create(null);
        const directorWeight= Object.create(null);
        const titleTokenWeight = Object.create(null);

        let yearSum = 0;
        let yearCount = 0;
        let ratingSum = 0;
        let ratingCount = 0;

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

            const actors = String(doc.actors || "")
                .split(",")
                .map((a) => normalizeLabel(a))
                .filter(Boolean);

            const directors = String(doc.directors || "")
                .split(",")
                .map((d) => normalizeLabel(d))
                .filter(Boolean);

            const titleTokens = String(doc.name || "")
                .split(/\s+/)
                .map((t) => normalizeLabel(t))
                .filter(Boolean);

            for (const g of genres) {
                genreWeight[g] = (genreWeight[g] || 0) + baseBoost;
            }
            for (const k of keywords) {
                keywordWeight[k] = (keywordWeight[k] || 0) + baseBoost;
            }
            for (const a of actors) {
                actorWeight[a] = (actorWeight[a] || 0) + baseBoost * 5;
            }
            for (const d of directors) {
                directorWeight[d] = (directorWeight[d] || 0) + baseBoost * 3;
            }
            for (const t of titleTokens) {
                titleTokenWeight[t] = (titleTokenWeight[t] || 0) + baseBoost * 2;
            }

            if (typeof doc.date === "number") {
                yearSum += doc.date;
                yearCount += 1;
            }
            if (typeof doc.rating === "number") {
                ratingSum += doc.rating;
                ratingCount += 1;
            }
        }

        const avgYear   = yearCount   ? yearSum / yearCount   : null;
        const avgRating = ratingCount ? ratingSum / ratingCount : null;

        const dislikedGenreSet   = new Set();
        const dislikedActorSet   = new Set();
        const dislikedDirectorSet= new Set();

        if (disliked.size > 0) {
            const dislikedDocs = await col
                .find({ id: { $in: [...disliked] } })
                .project({ genres: 1, actors: 1, directors: 1 })
                .toArray();

            for (const doc of dislikedDocs) {
                const genres = String(doc.genres || "")
                    .split(",")
                    .map((g) => normalizeLabel(g))
                    .filter(Boolean);
                const actors = String(doc.actors || "")
                    .split(",")
                    .map((a) => normalizeLabel(a))
                    .filter(Boolean);
                const directors = String(doc.directors || "")
                    .split(",")
                    .map((d) => normalizeLabel(d))
                    .filter(Boolean);

                for (const g of genres)    dislikedGenreSet.add(g);
                for (const a of actors)    dislikedActorSet.add(a);
                for (const d of directors) dislikedDirectorSet.add(d);
            }
        }

        const excludeIds = [...new Set([...watched, ...disliked])];
        const baseFilter =
            excludeIds.length > 0 ? { id: { $nin: excludeIds } } : {};

        const candidates = await col
            .find(baseFilter)
            .sort({ popularity: -1, date: -1 })
            .limit(800) // a bit larger pool
            .toArray();

        function scoreCandidate(doc) {
            const genres = String(doc.genres || "")
                .split(",")
                .map((g) => normalizeLabel(g))
                .filter(Boolean);

            const keywords = String(doc.keywords || "")
                .split(",")
                .map((k) => normalizeLabel(k))
                .filter(Boolean);

            const actors = String(doc.actors || "")
                .split(",")
                .map((a) => normalizeLabel(a))
                .filter(Boolean);

            const directors = String(doc.directors || "")
                .split(",")
                .map((d) => normalizeLabel(d))
                .filter(Boolean);

            const titleTokens = String(doc.name || "")
                .split(/\s+/)
                .map((t) => normalizeLabel(t))
                .filter(Boolean);

            let score = 0;
            let sharedGenres = 0;
            let sharedKeywords = 0;
            let sharedActors = 0;
            let sharedDirectors = 0;
            let sharedTitleTokens = 0;
            let penalty = 0;

            for (const a of actors) {
                if (actorWeight[a]) {
                    sharedActors++;
                    score += actorWeight[a] * 5;
                }
                if (dislikedActorSet.has(a)) {
                    penalty += 40;
                }
            }

            for (const d of directors) {
                if (directorWeight[d]) {
                    sharedDirectors++;
                    score += directorWeight[d] * 3;
                }
                if (dislikedDirectorSet.has(d)) {
                    penalty += 25;
                }
            }

            for (const g of genres) {
                if (genreWeight[g]) {
                    sharedGenres++;
                    score += genreWeight[g] * 1;
                }
                if (dislikedGenreSet.has(g)) {
                    penalty += 10;
                }
            }

            for (const k of keywords) {
                if (keywordWeight[k]) {
                    sharedKeywords++;
                    score += keywordWeight[k]; // lower impact
                }
            }

            for (const t of titleTokens) {
                if (titleTokenWeight[t]) {
                    sharedTitleTokens++;
                    score += titleTokenWeight[t] * 2;
                }
            }

            if (
                sharedGenres === 0 &&
                sharedKeywords === 0 &&
                sharedActors === 0 &&
                sharedDirectors === 0 &&
                sharedTitleTokens === 0
            ) {
                return -Infinity;
            }

            if (avgYear !== null && typeof doc.date === "number") {
                const diffYears = Math.abs(doc.date - avgYear);
                const yearScore = Math.max(0, 8 - diffYears); // within ~8 yrs gets bonus
                score += yearScore;
            }

            if (typeof doc.rating === "number") {
                score += doc.rating * 0.5;

                if (avgRating !== null) {
                    const diffRating = Math.abs(doc.rating - avgRating);
                    const ratingAffinity = Math.max(0, 4 - diffRating); // within ~4 pts
                    score += ratingAffinity;
                }
            }

            if (typeof doc.popularity === "number") {
                score += doc.popularity / 8000;
            }

            score -= penalty;

            return score;
        }

        const scoredEntries = candidates
            .map((doc) => ({ doc, score: scoreCandidate(doc) }))
            .filter((x) => Number.isFinite(x.score) && x.score > 0);

        if (!scoredEntries.length) {

            const docs = await col
                .find(baseFilter)
                .sort({ popularity: -1, date: -1 })
                .limit(limit)
                .toArray();
            return res.json({ items: docs.map(formatMovieForFeed) });
        }


        scoredEntries.sort((a, b) => b.score - a.score);

        const POOL_SIZE = Math.min(scoredEntries.length, limit * 3);
        const pool = scoredEntries.slice(0, POOL_SIZE);

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const selectedEntries = pool.slice(0, limit);
        const items = selectedEntries.map(({ doc }) => formatMovieForFeed(doc));

        return res.json({ items });
    } catch (err) {
        console.error("POST /feed error:", err);
        res.status(500).json({ error: "Server error" });
    }
});


export default router;
