// src/components/likeDislikeStorage.js

const DISLIKED_KEY = "dislikedTmdbIds";
const LIKED_KEY = "likedTmdbIds";

function readIds(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    // Normalize to numbers
    return arr
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

function writeIds(key, arr) {
  // Remove duplicates and store as numbers
  const nums = Array.from(
    new Set(
      arr
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n))
    )
  );
  localStorage.setItem(key, JSON.stringify(nums));
}

export function getLikedTmdbIds() {
  return readIds(LIKED_KEY);
}

export function getDislikedTmdbIds() {
  return readIds(DISLIKED_KEY);
}

export function addDislikedTmdbId(tmdbId) {
  if (tmdbId == null) return;
  const id = Number(tmdbId);
  if (!Number.isFinite(id)) return;

  const prev = readIds(DISLIKED_KEY);
  if (prev.includes(id)) return;
  writeIds(DISLIKED_KEY, [...prev, id]);
}

export function addLikedTmdbId(tmdbId) {
  if (tmdbId == null) return;
  const id = Number(tmdbId);
  if (!Number.isFinite(id)) return;

  const prev = readIds(LIKED_KEY);
  if (prev.includes(id)) return;
  writeIds(LIKED_KEY, [...prev, id]);
}
