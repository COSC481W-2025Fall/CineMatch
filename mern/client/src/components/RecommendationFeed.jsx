// src/components/RecommendationFeed.jsx
import React, { useEffect, useMemo, useState } from "react";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { API_BASE, authedFetch, refresh } from "../auth/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

const DEFAULT_LIMIT = 20;

const CAST_LIMIT = 5;

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
        const res = await authedFetch("/me/lists");
        if (res.status === 401) {
            throw new Error("Not authenticated (401). Open /login first.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();

        const w = Array.isArray(raw.watchedIds) ? raw.watchedIds
            : Array.isArray(raw.watched) ? raw.watched : [];
        const t = Array.isArray(raw.toWatchIds) ? raw.toWatchIds
            : Array.isArray(raw.toWatch) ? raw.toWatch
                : Array.isArray(raw["to-watch"]) ? raw["to-watch"] : [];

        setWatched(new Set(w.map(Number)));
        setWatchlist(new Set(t.map(Number)));
    }

    // server-side toggle for watched / to-watch
    async function toggleList(list, id) {
        const res = await authedFetch(`/me/lists/${list}`, {
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
            const movieId = rec.id ?? null;

            // refactor
            let currentDetails = {
                id: movieId, // local ID if we have it
                tmdbId: rec.tmdbId ?? null,
                title: rec.title ?? "",
                year: rec.year ?? null,
                rating: rec.rating ?? null,
                posterUrl:
                    rec.posterUrl ||
                    (rec.posterPath ? `${TMDB_IMG}${rec.posterPath}` : null),
                description: rec.description || rec.overview || "",
                genres: rec.genre || rec.genres || [],
                topCast: [],
                backdropUrl: rec.backdropUrl || null,
                runtime: rec.runtime || null,
                ageRating: rec.ageRating || null,
            };

            // check for local ID first
            let data = {};
            if (movieId != null) {
                const res = await fetch(`${API_BASE}/record/details/${movieId}`);
                if (res.ok) {
                    data = await res.json();
                    currentDetails = { ...currentDetails, ...data };
                }
            }

            const rawTmdbId =
                currentDetails.tmdbId != null && currentDetails.tmdbId !== ""
                    ? currentDetails.tmdbId
                    : currentDetails.id;

            const tmdbId =
                rawTmdbId != null && rawTmdbId !== ""
                    ? Number(rawTmdbId)
                    : null;

            //console.log("[TMDB FEED] Using ID:", tmdbId);

            let patch = {}; // empty

            // if found then pull actors, runtime, and watch providers
            if (tmdbId !== null && Number.isFinite(tmdbId)) {
                const numOfActors = CAST_LIMIT;

                const tmdbRes = await fetch(
                    `${API_BASE}/record/tmdb/${tmdbId}?append_to_response=credits,watch/providers,videos`,
                    { headers: { accept: "application/json" } }
                );

                if (tmdbRes.ok) {
                    const tmdb = await tmdbRes.json();

                    // get cast (actors) from tmdb.credits.cast
                    // tmdbCast will be empty if invalid
                    let tmdbCast = [];
                    if (tmdb && tmdb.credits && tmdb.credits.cast && Array.isArray(tmdb.credits.cast)) {
                        tmdbCast = tmdb.credits.cast;
                    }

                    // sort cast
                    // ao/bo are order of ab, fixes an issue where cast is not grabbed in order
                    tmdbCast.sort(function (a, b) // TMDB defines "order" (0 is the top credit). If missing, treat as very large (999).
                    {
                        let ao = 999;
                        let bo = 999;
                        if (a && typeof a.order === "number") ao = a.order;
                        if (b && typeof b.order === "number") bo = b.order;
                        return ao - bo;
                    });

                    // get the first X number of actors
                    const topActors = tmdbCast.slice(0, numOfActors);
                    // build an array of cast names with strings
                    const topCast = [];
                    for (let i = 0; i < topActors.length; i++) {
                        const person = topActors[i];
                        if (person && typeof person.name === "string" && person.name.length > 0) {
                            topCast.push(person.name);
                        }
                    }

                    // read runtime in min if it exists and is a number otherwise leave it as null
                    let runtime = null;
                    if (tmdb && typeof tmdb.runtime === "number") {
                        runtime = tmdb.runtime;
                    }

                    // get where to watch
                    let watchProviders = [];
                    let watchType = null;

                    // use US by default, not important for other areas rn since it changes by location
                    if (tmdb && tmdb["watch/providers"] && tmdb["watch/providers"].results && tmdb["watch/providers"].results.US) {
                        const us = tmdb["watch/providers"].results.US;
                        if (us.flatrate && us.flatrate.length > 0) {
                            watchProviders = us.flatrate;
                            watchType = "stream";
                        } else if (us.rent && us.rent.length > 0) {
                            watchProviders = us.rent;
                            watchType = "rent";
                        }
                    }

                    // trailer (direct YouTube URL)
                    let trailerUrl = null;
                    if (tmdb && tmdb.videos && tmdb.videos.results) {
                        const trailer = tmdb.videos.results.find(
                            (v) => v.site === "YouTube" && v.type === "Trailer"
                        );
                        if (trailer) {
                            trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                        }
                    }

                    // check for prequel / sequel in collection
                    if (tmdb.belongs_to_collection && tmdb.belongs_to_collection.id) {
                        try {
                            const collRes = await fetch(
                                `${API_BASE}/record/collection/${tmdb.belongs_to_collection.id}`,
                                { headers: { accept: "application/json" } }
                            );
                            if (collRes.ok) {
                                const collectionData = await collRes.json();
                                // sort by release date to determine order
                                const parts = (collectionData.parts || []).sort((a, b) => {
                                    return (
                                        new Date(a.release_date || "9999-12-31") -
                                        new Date(b.release_date || "9999-12-31")
                                    );
                                });
                                const currentIndex = parts.findIndex(
                                    (p) => Number(p.id) === tmdbId
                                );
                                if (currentIndex !== -1) {
                                    if (currentIndex > 0) {
                                        // prequel exists
                                        const prev = parts[currentIndex - 1];
                                        patch.prequel = {
                                            id: prev.id,
                                            tmdbId: prev.id,
                                            title: prev.title,
                                        };
                                    }
                                    if (currentIndex < parts.length - 1) {
                                        // sequel exists
                                        const next = parts[currentIndex + 1];
                                        patch.sequel = {
                                            id: next.id,
                                            tmdbId: next.id,
                                            title: next.title,
                                        };
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Collection fetch error:", e);
                        }
                    }


                    // removed outdated comments here from old database logic
                    patch.tmdbId = tmdbId;
                    if (topCast.length > 0) {
                        patch.topCast = topCast;
                    }
                    if (runtime !== null) {
                        patch.runtime = runtime;
                    }
                    // add watchers to patch and pass to detail view
                    if (watchProviders.length > 0) {
                        patch.watchProviders = watchProviders;
                        patch.watchType = watchType;
                    }

                    if (trailerUrl) {
                        patch.trailerUrl = trailerUrl;
                    }

                    // Only fill from TMDB if we don't already have a title
                    if (!data.title) {
                        patch.title = tmdb.title;
                        patch.year = tmdb.release_date
                            ? parseInt(tmdb.release_date.slice(0, 4))
                            : null;
                        patch.description = tmdb.overview;

                        if (!currentDetails.posterUrl && tmdb.poster_path) {
                            patch.posterUrl = `${TMDB_IMG}${tmdb.poster_path}`;
                        }
                        if (!currentDetails.backdropUrl && tmdb.backdrop_path) {
                            patch.backdropUrl =
                                `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}`;
                        }
                        patch.rating = tmdb.vote_average;

                        if ((!currentDetails.genres || currentDetails.genres.length === 0) && tmdb.genres) {
                            patch.genres = tmdb.genres.map((g) => g.name);
                        }
                    }

                    /*console.log(
                        "[TMDB FEED TEST] topCast:",
                        topCast,
                        "runtime:",
                        runtime,
                        "providers:",
                        watchProviders.length
                    );*/
                }
            }

            // ensure tmdbId is present in details
            const finalTmdbId =
                typeof patch.tmdbId === "number"
                    ? patch.tmdbId
                    : typeof currentDetails.tmdbId === "number"
                        ? currentDetails.tmdbId
                        : typeof data.tmdbId === "number"
                            ? data.tmdbId
                            : null;

            const finalDetails = {
                ...currentDetails,
                ...patch,
                tmdbId: finalTmdbId,
            };

            setDetails(finalDetails);
            setShowDetails(true);
        } catch (e) {
            console.error("Error opening details:", e);
        }
    }



    // helper to get local details
    async function fetchLocalDetails(ids) {
        if (!ids || ids.length === 0) return [];
        try {
            const res = await fetch(`${API_BASE}/record/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
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
            //console.log("[FEED] request body:", body);
            const resp = await fetch(`${API_BASE}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const items = Array.isArray(json?.items) ? json.items : [];
            const tmdbIdsToCheck = items
                .map(i => i.tmdbId)
                .filter(id => typeof id === 'number');

            let localDataMap = {};
            if (tmdbIdsToCheck.length > 0) {
                const localDetails = await fetchLocalDetails(tmdbIdsToCheck);
                localDetails.forEach((d) => {
                    // Index by the ID (which corresponds to TMDB ID)
                    localDataMap[d.id] = d;
                });
            }

            const enrichedItems = items.map((item) => {
                const local = item.tmdbId ? localDataMap[item.tmdbId] : null;

                if (local) {
                    return {
                        ...item,
                        ...local,        // overwrite from database for the sake of consistancy (especially for poster / backdrops)
                        tmdbId: item.tmdbId, // keep ID ref
                        id: local.id,    // make watched work
                        genres: local.genre,
                        overview: local.description || item.overview,
                        posterUrl: local.posterUrl
                    };
                }
                return item;
            });

            // Hide any movies the user has disliked (based on TMDB id)
            const filtered = enrichedItems.filter((item) => {
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
        if (!details || !canModifyLists || !details.id) return;
        const id = Number(details.id);
        toggleList("watched", id).catch(console.error);
    };
    const onAddToWatch = () => {
        if (!details || !canModifyLists || !details.id) return;
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
                            // Determine poster: Local URL > TMDB Path > Placeholder
                            const poster = r.posterUrl
                                ? r.posterUrl
                                : r.posterPath
                                    ? `${TMDB_IMG}${r.posterPath}`
                                    : "https://placehold.co/300x450?text=No+Poster";

                            return (
                                <article
                                    className="movie-card"
                                    key={`${r.tmdbId ?? r.id ?? "rec"}_${idx}`}
                                    onClick={() => openDetails(r)}
                                    style={{
                                        cursor: "pointer",
                                        position: "relative",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        backgroundColor: "#222",
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                    }}
                                >
                                    <img
                                        src={poster}
                                        alt={r.title || "Untitled"}
                                        style={{
                                            width: "100%",
                                            aspectRatio: "2/3",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />

                                    <div
                                        style={{
                                            padding: "10px",
                                            display: "flex",
                                            flexDirection: "column",
                                            flex: 1,
                                            gap: "4px",
                                        }}
                                    >
                                        <div
                                            className="movie-title"
                                            style={{
                                                whiteSpace: "normal",
                                                overflow: "visible",
                                                lineHeight: "1.2",
                                                fontSize: "1rem",
                                                fontWeight: "600",
                                                marginBottom: "2px",
                                            }}
                                        >
                                            {r.title || "Untitled"}
                                        </div>
                                        <div
                                            className="movie-sub"
                                            style={{
                                                fontSize: "0.85rem",
                                                opacity: 0.8,
                                                marginBottom: "2px"
                                            }}
                                        >
                                            {r.year ?? "—"}
                                        </div>

                                        {(r.rating != null || r.ageRating) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    flexWrap: "wrap",
                                                    marginBottom: "2px",
                                                }}
                                            >
                                                {r.rating != null && (
                                                    <div
                                                        className="movie-sub"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        <span style={{ transform: "translateY(-1px)" }}>⭐</span>
                                                        <span>{Number(r.rating).toFixed(1)}</span>
                                                    </div>
                                                )}

                                                {r.ageRating && (
                                                    <span
                                                        style={{
                                                            border: "1px solid #555",
                                                            padding: "1px 6px",
                                                            borderRadius: "4px",
                                                            fontSize: "0.75rem",
                                                            color: "#ccc",
                                                            lineHeight: "1.2",
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        {r.ageRating}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div
                                            className="movie-sub"
                                            style={{
                                                marginTop: "auto",
                                                fontSize: "0.8rem",
                                                opacity: 0.6,
                                                lineHeight: "1.3",
                                                paddingTop: "6px"
                                            }}
                                        >
                                            {(() => {
                                                const list = Array.isArray(r.genre)
                                                    ? r.genre
                                                    : Array.isArray(r.genres)
                                                        ? r.genres
                                                        : [r.genre || r.genres];
                                                const clean = list.filter((g) => g && g !== "NA");
                                                return clean.length > 0 ? clean.join(", ") : "—";
                                            })()}
                                        </div>
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
                    onNavigate={openDetails}
                />
            )}
        </>
    );
}