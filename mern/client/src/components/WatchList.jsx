// src/components/WatchList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";
import {
    addLikedTmdbId,
    addDislikedTmdbId,
    getLikedTmdbIds,
    getDislikedTmdbIds,
} from "./likeDislikeStorage";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const GENRES = [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Music",
    "Mystery",
    "Romance",
    "Science Fiction",
    "Thriller",
    "War",
    "Western",
];

const CAST_LIMIT = 7;

// localStorage helpers
function loadSetFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(
            parsed
                .map((x) => Number(x))
                .filter((n) => Number.isFinite(n))
        );
    } catch {
        return new Set();
    }
}

function loadArrayFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n));
    } catch {
        return [];
    }
}

// recordId - tmdbId map
function loadMapFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {};
        const out = {};
        for (const [k, v] of Object.entries(parsed)) {
            const idNum = Number(k);
            const tmdbNum = Number(v);
            if (Number.isFinite(idNum) && Number.isFinite(tmdbNum)) {
                out[idNum] = tmdbNum;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export default function WatchListPage() {
    const [watched, setWatched] = useState(() =>
        loadSetFromStorage("watched")
    );
    const [toWatch, setWatchlist] = useState(() =>
        loadSetFromStorage("to-watch")
    );

    // for this page, watchlist = watched movie ids (by DB id)
    const watchlist = useMemo(() => new Set([...watched]), [watched]);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

    // Liked/disliked (by TMDB id) – watchlist is editable
    const [likedTmdbIds, setLikedTmdbIds] = useState(() =>
        getLikedTmdbIds().length
            ? getLikedTmdbIds()
            : loadArrayFromStorage("likedTmdbIds")
    );
    const [dislikedTmdbIds, setDislikedTmdbIds] = useState(() =>
        getDislikedTmdbIds().length
            ? getDislikedTmdbIds()
            : loadArrayFromStorage("dislikedTmdbIds")
    );

    // Map of DB record id - TMDB id, shared with Search page via localStorage
    const [recordTmdbMap, setRecordTmdbMap] = useState(() =>
        loadMapFromStorage("recordTmdbMap")
    );

    useEffect(() => {
        // If there are no watched movies, clear all likes/dislikes
        if (watched.size === 0) {
            setLikedTmdbIds([]);
            setDislikedTmdbIds([]);
        }
    }, [watched]);

    useEffect(() => {
        localStorage.setItem("watched", JSON.stringify([...watched]));
    }, [watched]);

    useEffect(() => {
        localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
    }, [toWatch]);

    // Keep liked/disliked in sync with localStorage
    useEffect(() => {
        localStorage.setItem("likedTmdbIds", JSON.stringify(likedTmdbIds));
    }, [likedTmdbIds]);

    useEffect(() => {
        localStorage.setItem(
            "dislikedTmdbIds",
            JSON.stringify(dislikedTmdbIds)
        );
    }, [dislikedTmdbIds]);

    useEffect(() => {
        localStorage.setItem(
            "recordTmdbMap",
            JSON.stringify(recordTmdbMap)
        );
    }, [recordTmdbMap]);

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    async function openDetails(movie) {
        try {
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // replace whole conversion call and check with this
            const tmdbId = movie.id;
            console.log("[TMDB] Using ID:", tmdbId);

            let patch = {}; // empty

            // if found then pull actors, runtime, and watch providers
            if (tmdbId !== null && tmdbId !== undefined) {
                const numOfActors = CAST_LIMIT;
                const url = new URL("https://api.themoviedb.org/3/movie/" + tmdbId);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);

                url.searchParams.set("append_to_response", "credits,watch/providers"); // add where to watch to the append

                const tmdbRes = await fetch(url.toString(), {headers: {accept: "application/json"}});
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

                    // use US by default, not important for other areas rn since it changes by location
                    if (tmdb && tmdb["watch/providers"] && tmdb["watch/providers"].results && tmdb["watch/providers"].results.US && tmdb["watch/providers"].results.US.flatrate) {
                        watchProviders = tmdb["watch/providers"].results.US.flatrate;
                    }

                    // fill patch objects

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
                    }

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime, "providers:", watchProviders.length);
                }
            }

            // Make sure we store tmdbId on details if we have one
            const finalTmdbId =
                typeof patch.tmdbId === "number"
                    ? patch.tmdbId
                    : typeof data.tmdbId === "number"
                        ? data.tmdbId
                        : typeof movie.tmdbId === "number"
                            ? movie.tmdbId
                            : null;

            setDetails({ id: movie.id, tmdbId: finalTmdbId, ...data, ...patch });
            setShowDetails(true);

            // Cache TMDB id on the search results and in recordTmdbMap
            if (finalTmdbId != null) {
                setMovies((prev) =>
                    prev.map((m) =>
                        m.id === movie.id ? { ...m, tmdbId: finalTmdbId ?? m.tmdbId } : m
                    )
                );
                setRecordTmdbMap((prev) => ({
                    ...prev,
                    [movie.id]: finalTmdbId,
                }));
            }
        } catch (e) {
            console.error(e);
        }
    }

    const [params, setParams] = useState({
        actor: "",
        director: "",
        genre: "",
        title: "",
        year: "",
        rating: "",
    });

    const [movies, setMovies] = useState([]);
    const [status, setStatus] = useState("Loading…");

    // use /record/bulk to fetch only watched movies
    async function fetchWatchlistSubset(p = {}) {
        const body = {
            ids: Array.from(watchlist),
            params: {
                actor: p.actor || "",
                director: p.director || "",
                genre: p.genre || "",
                title: p.title || "",
                year: p.year || "",
                rating: p.rating || "",
            },
        };

        const res = await fetch("/record/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function doSearch() {
        setStatus("Loading…");

        try {
            if (watchlist.size === 0) {
                setMovies([]);
                setStatus("Your watch list is empty.");
                return;
            }

            const data = await fetchWatchlistSubset(params);

            // Attach tmdbId from our persisted map, if we know it
            const withTmdb = data.map((m) => {
                const mapped = recordTmdbMap[m.id];
                if (mapped && m.tmdbId == null) {
                    return { ...m, tmdbId: mapped };
                }
                return m;
            });

            setMovies(withTmdb);
            setStatus(
                withTmdb.length
                    ? ""
                    : "Your watch list is empty or no matches for this search."
            );
        } catch (err) {
            console.error(err);
            setStatus("Error loading results.");
        }
    }

    useEffect(() => {
        doSearch();
    }, []);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams((prev) => ({
            ...prev,
            [id.replace("q", "").toLowerCase()]: value,
        }));
    }

    const isWatched = useMemo(
        () => details && watched.has(details.id),
        [details, watched]
    );
    const inToWatch = useMemo(
        () => details && toWatch.has(details.id),
        [details, toWatch]
    );

    // liked/disliked for the movie in the modal
    const isLiked = useMemo(
        () =>
            details &&
            details.tmdbId != null &&
            likedTmdbIds.includes(Number(details.tmdbId)),
        [details, likedTmdbIds]
    );

    const isDisliked = useMemo(
        () =>
            details &&
            details.tmdbId != null &&
            dislikedTmdbIds.includes(Number(details.tmdbId)),
        [details, dislikedTmdbIds]
    );

    // If removing from watched, also clear likes/dislikes for that TMDB id
    const onMarkWatched = () => {
        if (!details) return;

        const id = Number(details.id);
        const tmdbIdNum =
            details.tmdbId != null ? Number(details.tmdbId) : null;

        setWatched((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                // Removing from watched list - clear likes/dislikes for this movie
                next.delete(id);

                if (tmdbIdNum != null && Number.isFinite(tmdbIdNum)) {
                    setLikedTmdbIds((prevLiked) =>
                        prevLiked.filter((x) => x !== tmdbIdNum)
                    );
                    setDislikedTmdbIds((prevDisliked) =>
                        prevDisliked.filter((x) => x !== tmdbIdNum)
                    );
                }
            } else {
                // Adding to Watched
                next.add(id);
            }

            return next;
        });
    };

    const onAddToWatch = () => {
        if (!details) return;
        const id = Number(details.id);
        setWatchlist((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // Only place where like/dislike is changed (editable)
    function handleLike() {
        if (!details?.tmdbId) return;
        const tmdbIdNum = Number(details.tmdbId);
        if (!Number.isFinite(tmdbIdNum)) return;

        addLikedTmdbId(tmdbIdNum);
        setLikedTmdbIds((prev) =>
            prev.includes(tmdbIdNum) ? prev : [...prev, tmdbIdNum]
        );
        setDislikedTmdbIds((prev) =>
            prev.filter((id) => id !== tmdbIdNum)
        );
    }

    function handleDislike() {
        if (!details?.tmdbId) return;
        const tmdbIdNum = Number(details.tmdbId);
        if (!Number.isFinite(tmdbIdNum)) return;

        addDislikedTmdbId(tmdbIdNum);
        setDislikedTmdbIds((prev) =>
            prev.includes(tmdbIdNum) ? prev : [...prev, tmdbIdNum]
        );
        setLikedTmdbIds((prev) =>
            prev.filter((id) => id !== tmdbIdNum)
        );
    }

    function clearFilters() {
        // Reset all text + numeric filters
        setParams({
            actor: "",
            director: "",
            genre: "",
            title: "",
            year: "",
            rating: "",
        });
        doSearch();// Re-run search with empty filters
    }

    return (
        <>
            {/* <div className="navigation-top">
                <button className="navigation-button" id="sidebarToggle">☰</button>

               <Link to="/" className="logo"><div className="logo">cineMatch</div></Link>


                <button
                    className="navigation-button"
                    id="mobileNavToggle"
                    style={{ marginLeft: "auto" }}
                >
                    ▼
                </button>


                <div className="nav-links" id="navLinks">

                    <Link to="/" style={{ color: "inherit", textDecoration: "none" }} className="navigation-button">SEARCH</Link>
                    <Link to="/help" style={{ textDecoration: 'none' }} className="navigation-button">HELP</Link>
                    <Link to="/feed" style={{ textDecoration: 'none' }} className="navigation-button">FEED</Link>
                    <Link to="/watchlist" style={{ textDecoration: 'none' }} className="navigation-button active">WATCHED LIST</Link>
                    <Link to="/to-watch-list" style={{ textDecoration: 'none' }} className="navigation-button">TO-WATCH LIST</Link>

                </div>
            </div> */}

            <Navigation
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
            />

            <div
                className={`main-container ${
                    sidebarCollapsed ? "sidebar-collapsed" : ""
                }`}
            >
                <aside className="sidebar">
                    <ul className="search-filters">
                        {["Actor", "Director", "Genre", "Title", "Year", "Rating"].map(
                            (label) => (
                                <li className="filter-item" key={label}>
                                    <div className="filter-link">
                                        <input
                                            id={`q${label}`}
                                            className="filter-input"
                                            placeholder={`${label.toUpperCase()}...`}
                                            value={params[label.toLowerCase()] || ""}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </li>
                            )
                        )}
                        <li className="filter-item" key="GenreSelect">
                            <div className="filter-link">
                                <select
                                    id="qGenre"
                                    className="filter-select"
                                    value={params.genre || ""}
                                    onChange={handleChange}
                                >
                                    <option value="">GENRE...</option>
                                    {GENRES.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </li>
                    </ul>

                    <button className="go-btn" onClick={doSearch}>
                        SEARCH
                    </button>
                    {/* The button to actually search, this one is permanent */}
                    <button className="go-btn" onClick={clearFilters}>
                        CLEAR
                    </button>
                    {/* This clear the search filters  */}

                    <footer className="sidebar-footer-credit">
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
                            This website uses TMDB and the TMDB APIs but is not endorsed,
                            certified, or otherwise approved by TMDB.
                        </p>
                    </footer>
                </aside>

                {!sidebarCollapsed && (
                    <div
                        className="sidebar-overlay"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}

                <main className="content-area">
                    <div id="status" className="muted">
                        {status}
                    </div>
                    <div id="results" className="movie-grid">
                        {movies.map((m, idx) => {
                            const tmdbIdNum =
                                m.tmdbId != null
                                    ? Number(m.tmdbId)
                                    : recordTmdbMap[m.id] != null
                                        ? Number(recordTmdbMap[m.id])
                                        : null;

                            const liked =
                                tmdbIdNum != null && likedTmdbIds.includes(tmdbIdNum);
                            const disliked =
                                tmdbIdNum != null &&
                                dislikedTmdbIds.includes(tmdbIdNum);

                            return (
                                <article
                                    className="movie-card"
                                    key={idx}
                                    onClick={() => openDetails(m)}
                                    style={{ cursor: "pointer", position: "relative" }}
                                >
                                    {(liked || disliked) && (
                                        <div
                                            className="like-flag-card"
                                            style={{
                                                position: "absolute",
                                                top: 6,
                                                right: 6,
                                                padding: "2px 6px",
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                backgroundColor: liked
                                                    ? "rgba(0, 128, 0, 0.85)"
                                                    : "rgba(180, 0, 0, 0.85)",
                                                color: "#fff",
                                            }}
                                        >
                                            {liked ? "👍" : "👎"}
                                        </div>
                                    )}
                                    <img
                                        src={
                                            m.posterUrl ||
                                            "https://placehold.co/300x450?text=No+Poster"
                                        }
                                        alt={m.title || ""}
                                    />
                                    <div className="movie-title">{m.title ?? "Untitled"}</div>
                                    <div className="movie-sub">
                                        {m.year ?? "—"} •{" "}
                                        {Array.isArray(m.genre)
                                            ? m.genre.join(", ")
                                            : m.genre || "—"}
                                    </div>
                                    {m.rating != null && (
                                        <div className="movie-sub">⭐ {m.rating}</div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </main>
            </div>

            {showDetails && details && (
                <MovieDetails
                    details={details}
                    onClose={() => setShowDetails(false)}
                    isWatched={!!isWatched}
                    inToWatch={!!inToWatch}
                    onMarkWatched={onMarkWatched}
                    onAddToWatch={onAddToWatch}
                    onLike={handleLike}
                    onDislike={handleDislike}
                    isLiked={!!isLiked}
                    isDisliked={!!isDisliked}
                    likesEditable={true}
                />
            )}
        </>
    );
}
