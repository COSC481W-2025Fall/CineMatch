// src/components/RecommendationFeed.jsx
import React, { useEffect, useMemo, useState } from "react";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { authedFetch, refresh } from "../auth/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

const DEFAULT_LIMIT = 20;

const CAST_LIMIT = 7;

function loadArrayFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number);
    } catch {
        return [];
    }
}

export default function RecommendationFeed() {
    const { user } = useAuth();
    const canModifyLists = !!user;

    // Watched / to-watch sets (authoritative data from server, cached to localStorage)
    const [watched, setWatched] = useState(new Set());
    const [toWatch, setWatchlist] = useState(new Set());

    useEffect(() => {
        localStorage.setItem("watched", JSON.stringify([...watched]));
    }, [watched]);

    useEffect(() => {
        localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
    }, [toWatch]);

    const watchedIds = useMemo(
        () => new Set(Array.from(watched)),
        [watched]
    );

    // Disliked / liked TMDB ids
    const [dislikedTmdbIds, setDislikedTmdbIds] = useState(() =>
        loadArrayFromStorage("dislikedTmdbIds")
    );
    const [likedTmdbIds, setLikedTmdbIds] = useState(() =>
        loadArrayFromStorage("likedTmdbIds")
    );

    const [limit] = useState(DEFAULT_LIMIT); // THIS ISN'T BEING USED, PENDING REMOVAL DURING CODE CLEANUP -YS

    const [recs, setRecs] = useState([]);
    const [status, setStatus] = useState("Loading…");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // load watched / to-watch lists from the server
    async function loadLists() {
        const res = await authedFetch("/api/me/lists");
        if (res.status === 401) {
            throw new Error("Not authenticated (401). Open /login first.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();

        const w = Array.isArray(raw.watchedIds) ? raw.watchedIds
            : Array.isArray(raw.watched)       ? raw.watched
                : [];
        const t = Array.isArray(raw.toWatchIds)   ? raw.toWatchIds
            : Array.isArray(raw.toWatch)         ? raw.toWatch
                : Array.isArray(raw["to-watch"])     ? raw["to-watch"]
                    : [];

        const watchedIdsArr = w.map(Number);
        const toWatchIdsArr = t.map(Number);

        setWatched(new Set(watchedIdsArr));
        setWatchlist(new Set(toWatchIdsArr));

        return { watchedIds: watchedIdsArr, toWatchIds: toWatchIdsArr };
    }

    // server-side toggle for watched / to-watch
    async function toggleList(list, id) {
        const res = await authedFetch(`/api/me/lists/${list}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action:
                    (list === "watched"  && watched.has(id)) ||
                    (list === "to-watch" && toWatch.has(id))
                        ? "remove"
                        : "add",
                id,
            }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        await loadLists();
    }

    // Rewrote openDetails in feed because old one is excruciatingly slow...
    async function openDetails(rec) {
        try {
            const movieId = rec.id != null ? rec.id : null;

            if (movieId == null) {
                const title = rec?.title ?? "";
                setDetails({
                    id: null,
                    tmdbId: null,
                    title,
                    year: rec?.year ?? null,
                    rating: rec?.rating ?? null,
                    posterUrl: rec?.posterPath ? `${TMDB_IMG}${rec.posterPath}` : null,
                    description: rec?.overview || "",
                    genres: [],
                    topCast: [],
                });
                setShowDetails(true);
                return;
            }

            const res = await fetch(`/record/details/${movieId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const tmdbId =
                typeof data.tmdbId === "number"
                    ? data.tmdbId
                    : typeof rec.tmdbId === "number"
                        ? rec.tmdbId
                        : null;

            let patch = {};

            if (tmdbId !== null && tmdbId !== undefined) {
                const numOfActors = CAST_LIMIT;
                const url = new URL("https://api.themoviedb.org/3/movie/" + tmdbId);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                url.searchParams.set("append_to_response", "credits,watch/providers");

                const tmdbRes = await fetch(url.toString(), { headers: { accept: "application/json" } });
                if (tmdbRes.ok) {
                    const tmdb = await tmdbRes.json();

                    let tmdbCast = [];
                    if (tmdb && tmdb.credits && tmdb.credits.cast && Array.isArray(tmdb.credits.cast)) {
                        tmdbCast = tmdb.credits.cast;
                    }

                    tmdbCast.sort(function (a, b) {
                        let ao = 999;
                        let bo = 999;
                        if (a && typeof a.order === "number") ao = a.order;
                        if (b && typeof b.order === "number") bo = b.order;
                        return ao - bo;
                    });

                    const topActors = tmdbCast.slice(0, numOfActors);
                    const topCast = [];
                    for (let i = 0; i < topActors.length; i++) {
                        const person = topActors[i];
                        if (person && typeof person.name === "string" && person.name.length > 0) {
                            topCast.push(person.name);
                        }
                    }

                    let runtime = null;
                    if (tmdb && typeof tmdb.runtime === "number") {
                        runtime = tmdb.runtime;
                    }

                    let watchProviders = [];
                    if (
                        tmdb &&
                        tmdb["watch/providers"] &&
                        tmdb["watch/providers"].results &&
                        tmdb["watch/providers"].results.US &&
                        tmdb["watch/providers"].results.US.flatrate
                    ) {
                        watchProviders = tmdb["watch/providers"].results.US.flatrate;
                    }

                    patch.tmdbId = tmdbId;
                    if (topCast.length > 0) {
                        patch.topCast = topCast;
                    }
                    if (runtime !== null) {
                        patch.runtime = runtime;
                    }
                    if (watchProviders.length > 0) {
                        patch.watchProviders = watchProviders;
                    }

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime, "providers:", watchProviders.length);
                }
            }

            const posterUrl =
                data.posterUrl || (rec?.posterPath ? `${TMDB_IMG}${rec.posterPath}` : null);

            setDetails({
                id: movieId,
                tmdbId: patch.tmdbId ?? tmdbId ?? null,
                ...data,
                ...patch,
                posterUrl,
            });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
        }
    }

    async function buildRecommendations() {
        const freshLiked = loadArrayFromStorage("likedTmdbIds");
        const freshDisliked = loadArrayFromStorage("dislikedTmdbIds");

        setLikedTmdbIds(freshLiked);
        setDislikedTmdbIds(freshDisliked);

        if (watchedIds.size === 0) { // Check if the user has watched any movies yet
            setStatus("Your watched movies list is empty, mark some as watched to get recommendations!.");
            setRecs([]);
            return;
        }
        setStatus("Building your feed…");
        try {
            const body = {// Prepare the request body with watched IDs and the desired limit
                watchedIds: Array.from(watchedIds),
                likedTmdbIds: freshLiked,
                dislikedTmdbIds: freshDisliked,
                limit: Math.max(1, Number(limit) || DEFAULT_LIMIT),
            };
            const resp = await fetch("/feed", { // Send a POST request to the /feed endpoint
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const items = Array.isArray(json?.items) ? json.items : [];

            // Hide any movies the user has disliked (based on TMDB id)
            const filtered = items.filter((item) => {
                if (item.tmdbId == null) return true;
                const idNum = Number(item.tmdbId);
                if (!Number.isFinite(idNum)) return true;
                return !freshDisliked.includes(idNum);
            });

            setRecs(filtered);
            setStatus(
                filtered.length
                    ? ""
                    : "No recommendations yet. Try watching or liking a few more movies."
            );
        } catch (e) {
            console.error("Feed error:", e);
            setStatus("Error building your feed.");
            setRecs([]);
        }
    }

    useEffect(() => {
        (async () => {
            try {
                await refresh().catch(() => {});
                await loadLists();
            } catch (e) {
                console.error("Failed to load lists for feed:", e);
            }
        })();
    }, []);

    useEffect(() => {
        buildRecommendations();
    }, [watchedIds, limit]);

    const isWatched = useMemo(
        () => details && details.id != null && watched.has(Number(details.id)),
        [details, watched]
    );
    const inToWatch = useMemo(
        () => details && details.id != null && toWatch.has(Number(details.id)),
        [details, toWatch]
    );

    const onMarkWatched = () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        toggleList("watched", id).catch(console.error);
    };
    const onAddToWatch = () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        toggleList("to-watch", id).catch(console.error);
    };

    return (
        <>
            <Navigation
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
            />

            <div className="main-container" style={{ marginLeft: 0, width: "100%" }}>
                <main className="content-area" style={{ marginLeft: 0, width: "100%" }}>
                    <div id="status" className="muted">{status}</div>
                    <div id="results" className="movie-grid">
                        {recs.map((r, idx) => {
                            const poster = r.posterPath
                                ? `${TMDB_IMG}${r.posterPath}`
                                : "https://placehold.co/300x450?text=No+Poster";
                            return (
                                <article
                                    className="movie-card"
                                    key={`${r.tmdbId ?? r.id ?? "rec"}_${idx}`}
                                    onClick={() => openDetails(r)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <img src={poster} alt={r.title || "Untitled"} />
                                    <div className="movie-title">{r.title || "Untitled"}</div>
                                    <div className="movie-sub">
                                        {(r.year ?? "—")} • {r.rating != null ? `⭐ ${r.rating}` : "—"}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </main>
            </div>

            <footer
                style={{
                    marginTop: "2rem",
                    padding: "1rem",
                    textAlign: "center",
                    fontSize: "0.85rem",
                    color: "#999",
                }}
            >
                <p>
                    Source of data:{" "}
                    <a href="https://www.themoviedb.org/">
                        TMDB{" "}
                        <img
                            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                            style={{
                                height: "10px",
                                width: "auto",
                                verticalAlign: "middle",
                                marginLeft: "6px",
                            }}
                            alt="TMDB logo"
                        />
                    </a>
                </p>
                <p>
                    This website uses TMDB and the TMDB APIs but is not endorsed, certified, or
                    otherwise approved by TMDB.
                </p>
            </footer>

            {showDetails && details && (
                <MovieDetails
                    details={details}
                    onClose={() => setShowDetails(false)}
                    isWatched={!!isWatched}
                    inToWatch={!!inToWatch}
                    onMarkWatched={onMarkWatched}
                    onAddToWatch={onAddToWatch}
                    canModifyLists={canModifyLists}
                    castLimit={CAST_LIMIT}
                    runtime={typeof details?.runtime === "number" ? details.runtime : null}
                />
            )}
        </>
    );
}
