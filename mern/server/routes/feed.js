// server/routes/feed.js
import fetch from "node-fetch";
import { Router } from "express";
import db from "../db/connection.js";

const router = Router();

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
    if (!TMDB_API_KEY) {
      return res
        .status(500)
        .json({ error: "TMDB key missing on server" });
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
});

export default router;
