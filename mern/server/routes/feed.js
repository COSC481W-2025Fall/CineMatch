// server/routes/feed.js
import fetch from "node-fetch";
import { Router } from "express";
import db from "../db/connection.js";

const router = Router();

// .env: put TMDB_API_KEY in server/.env (NOT the Vite one)
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";


const DIACRITICS = /\p{M}/gu;
const PUNCT = /['".,:;!?()[\]{}\/&\\\-–—_]/g;
const MULTI = /\s+/g;
function normalizeTitle(t = "") {
    let out = String(t).toLowerCase();
    out = out.normalize("NFKD").replace(DIACRITICS, "");
    out = out.replace(PUNCT, " ").replace(MULTI, " ").trim();
    return out;
}

async function findTmdbIdByTitleYear(title, year, { language } = {}) {
    if (!title || year == null || !TMDB_API_KEY) return null;

    const url = new URL(`${TMDB_BASE_URL}/search/movie`);
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("query", title);
    url.searchParams.set("year", String(year));
    if (language) url.searchParams.set("language", language);

    const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!resp.ok) return null;
    const json = await resp.json();
    const results = Array.isArray(json?.results) ? json.results : [];

    const y = String(year);
    const normTitle = normalizeTitle(title);
    const filtered = results.filter(r => (r?.release_date || "").startsWith(y));
    if (!filtered.length) return null;

    let best = null;
    let bestScore = -Infinity;
    for (const r of filtered) {
        const t1 = normalizeTitle(r?.title || "");
        const t2 = normalizeTitle(r?.original_title || "");
        let score = 0;

        if (t1 === normTitle || t2 === normTitle) score = 1000;
        else if (t1.startsWith(normTitle) || t2.startsWith(normTitle)) score = 600;
        else if (normTitle.startsWith(t1) || normTitle.startsWith(t2)) score = 550;

        score += (Number(r?.popularity) || 0) / 10;
        if (score > bestScore) { best = r; bestScore = score; }
    }
    return typeof best?.id === "number" ? best.id : null;
}


router.post("/", async (req, res) => {
    try {
        if (!TMDB_API_KEY) return res.status(500).json({ error: "TMDB key missing on server" });

        const watchedIds = Array.isArray(req.body?.watchedIds) ? req.body.watchedIds : [];
        const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || 10));
        if (!watchedIds.length) return res.json({ items: [] });

        const agg = new Map();
        const exclude = new Set();

        const moviesCol = db.collection("movies");
        const postersCol = db.collection("posters");

        for (const dbId of watchedIds) {
            const movie = await moviesCol.findOne({ id: Number(dbId) }, { projection: { name: 1, date: 1 } });
            if (!movie?.name || movie?.date == null) continue;

            const tmdbId = await findTmdbIdByTitleYear(movie.name, movie.date);
            if (!tmdbId) continue;
            exclude.add(tmdbId);

            const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/recommendations`);
            url.searchParams.set("api_key", TMDB_API_KEY);
            const resp = await fetch(url.toString(), { headers: { accept: "application/json" } });
            if (!resp.ok) continue;
            const json = await resp.json();
            const results = Array.isArray(json?.results) ? json.results : [];

            for (const rec of results) {
                if (typeof rec?.id !== "number") continue;
                const key = rec.id;
                const rating = Number(rec?.vote_average) || 0;

                if (agg.has(key)) {
                    const entry = agg.get(key);
                    entry.count += 1;
                    if (rating > entry.rating) entry.rating = rating;
                } else {
                    agg.set(key, { id: key, count: 1, rating, sample: rec });
                }
            }
        }

        const sorted = Array.from(agg.values())
            .filter(x => !exclude.has(x.id))
            .sort((a, b) => (b.count - a.count) || (b.rating - a.rating))
            .slice(0, limit)
            .map(x => x.sample);

        const items = sorted.map(r => ({
            tmdbId: r.id,
            title: r.title || r.name || "Untitled",
            year: (r.release_date || "").slice(0, 4) || null,
            rating: typeof r.vote_average === "number" ? Number(r.vote_average.toFixed(1)) : null,
            overview: r.overview || "",
            posterPath: r.poster_path || null,
        }));

        res.json({ items });
    } catch (err) {
        console.error("POST /feed error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
