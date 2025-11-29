// server/routes/feed.js
import fetch from "node-fetch";
import { Router } from "express";
import db from "../db/connection.js";

const router = Router();

// .env: put TMDB_API_KEY in server/.env (NOT the Vite one)
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";


router.post("/", async (req, res) => {
    try {
        if (!TMDB_API_KEY) return res.status(500).json({ error: "TMDB key missing on server" });

        const watchedIds = Array.isArray(req.body?.watchedIds) ? req.body.watchedIds : [];

        const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || 20));
        if (!watchedIds.length) return res.json({ items: [] });


        const agg = new Map();
        const exclude = new Set();


        for (const dbId of watchedIds) {

            const tmdbId = Number(dbId);

            if (!tmdbId || isNaN(tmdbId)) continue;

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
