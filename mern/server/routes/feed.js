// server/routes/feed.js
import fetch from "node-fetch";
import { Router } from "express";
import db from "../db/connection.js";

const router = Router();

const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

//Normalize Title
const DIACRITICS = /\p{M}/gu;
const PUNCT = /['".,:;!?()[\]{}\/&\\\-–—_]/g;
const MULTI = /\s+/g;

function normalizeTitle(t = "") {
  let out = String(t).toLowerCase();
  out = out.normalize("NFKD").replace(DIACRITICS, "");
  out = out.replace(PUNCT, " ").replace(MULTI, " ").trim();
  return out;
}

// Convert DB movie to TMDB id 
async function findTmdbIdByTitleYear(title, year) {
  if (!title || year == null || !TMDB_API_KEY) return null;

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("query", title);
  url.searchParams.set("year", String(year));

  const resp = await fetch(url.toString(), {
    headers: { accept: "application/json" }
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  const results = Array.isArray(data?.results) ? data.results : [];

  const y = String(year);
  const norm = normalizeTitle(title);
  const filtered = results.filter(r => (r.release_date || "").startsWith(y));

  if (!filtered.length) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const r of filtered) {
    const t1 = normalizeTitle(r.title || "");
    let score = 0;

    if (t1 === norm) score = 1000;
    else if (t1.startsWith(norm)) score = 600;

    score += (r.popularity || 0) / 10;

    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }

  return best?.id ?? null;
}

// Fetch genres for a TMDB movie
async function fetchGenres(tmdbId) {
  if (!tmdbId) return [];

  const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
  url.searchParams.set("api_key", TMDB_API_KEY);

  const resp = await fetch(url.toString(), {
    headers: { accept: "application/json" }
  });

  if (!resp.ok) return [];

  const data = await resp.json();
  return (data.genres || []).map(g => Number(g.id)).filter(n => Number.isFinite(n));
}

// MAIN FEED ROUTE
router.post("/", async (req, res) => {
  try {
    if (!TMDB_API_KEY)
      return res.status(500).json({ error: "TMDB key missing on server" });

    const watchedDbIds = Array.isArray(req.body?.watchedIds)
      ? req.body.watchedIds
      : [];

    const likedTmdbIds = Array.isArray(req.body?.likedTmdbIds)
      ? req.body.likedTmdbIds.map(Number).filter(n => n > 0)
      : [];

    const limit = Math.max(1, Math.min(50, Number(req.body?.limit) || 20));

    if (!watchedDbIds.length && !likedTmdbIds.length)
      return res.json({ items: [] });

    const moviesCol = db.collection("movies");

    // Seed TMDB IDs
    const seeds = new Map(); // tmdbId - weight
    const exclude = new Set(); // watched TMDB movies

    // 1. Watched movies - weight 1
    for (const dbId of watchedDbIds) {
      const movie = await moviesCol.findOne(
        { id: Number(dbId) },
        { projection: { name: 1, date: 1 } }
      );
      if (!movie?.name || !movie?.date) continue;

      const tmdb = await findTmdbIdByTitleYear(movie.name, movie.date);
      if (!tmdb) continue;

      seeds.set(tmdb, (seeds.get(tmdb) || 0) + 1);
      exclude.add(tmdb);
    }

    // 2. Liked movies - weight 3
    for (const tmdbId of likedTmdbIds) {
      seeds.set(tmdbId, (seeds.get(tmdbId) || 0) + 3);
      // We DO NOT exclude liked movies
    }

    if (!seeds.size) return res.json({ items: [] });

    //  Build genre profile
    const genreWeight = new Map();

    for (const [tmdbId, weight] of seeds.entries()) {
      const genres = await fetchGenres(tmdbId);
      for (const g of genres) {
        genreWeight.set(g, (genreWeight.get(g) || 0) + weight);
      }
    }

    // Aggregate TMDB recs
    const agg = new Map(); // tmdbId -> { sample, scoreComponents }

    async function addRecsFrom(tmdbId, seedWeight) {
      const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/recommendations`);
      url.searchParams.set("api_key", TMDB_API_KEY);

      const resp = await fetch(url.toString(), {
        headers: { accept: "application/json" }
      });
      if (!resp.ok) return;

      const data = await resp.json();
      const recs = Array.isArray(data?.results) ? data.results : [];

      for (const rec of recs) {
        if (!rec?.id || rec.id === tmdbId) continue;

        const key = rec.id;
        const rating = Number(rec.vote_average) || 0;
        const pop = Number(rec.popularity) || 0;
        const genres = rec.genre_ids || [];

        if (!agg.has(key)) {
          agg.set(key, {
            id: key,
            sample: rec,
            hits: 0,
            rating,
            popularity: pop,
            genres
          });
        }

        const entry = agg.get(key);
        entry.hits += seedWeight;
      }
    }

    // Call TMDB recs for all seed movies
    for (const [tmdbId, weight] of seeds.entries()) {
      await addRecsFrom(tmdbId, weight);
    }

    // Score
    function genreScore(genres) {
      let score = 0;
      for (const g of genres) {
        score += genreWeight.get(g) || 0;
      }
      return score;
    }

    const scored = Array.from(agg.values())
      .filter(rec => !exclude.has(rec.id))
      .map(rec => {
        rec.score =
          rec.hits * 10 +               // strong weight from seeds  
          // rec.rating * 1.5 +         // rating excluded 
          rec.popularity * 0.05 +       // trending  
          genreScore(rec.genres) * 2;   // genre matching  

        return rec;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Format 
    const items = scored.map(r => ({
      tmdbId: r.id,
      title: r.sample.title || r.sample.name || "Untitled",
      year: (r.sample.release_date || "").slice(0, 4),
      rating: r.sample.vote_average
        ? Number(r.sample.vote_average.toFixed(1))
        : null,
      overview: r.sample.overview || "",
      posterPath: r.sample.poster_path || null
    }));

    res.json({ items });

  } catch (err) {
    console.error("feed error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;