// src/components/WatchList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { API_BASE, authedFetch, refresh, fetchReactions, updateReaction } from "../auth/api.js";
import { useAuth } from "../auth/AuthContext.jsx";

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

const CAST_LIMIT = 5;

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
    const { user } = useAuth();
    const canModifyLists = !!user;

    const [watched, setWatched] = useState(new Set());
    const [toWatch, setToWatch] = useState(new Set());

    // for this page, watchlist = watched movie ids (by DB id)
    const watchlist = useMemo(() => new Set([...watched]), [watched]);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);
    // Liked/disliked (by TMDB id) – watchlist is editable
    const [likedTmdbIds, setLikedTmdbIds] = useState([]);
    const [dislikedTmdbIds, setDislikedTmdbIds] = useState([]);

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
        localStorage.setItem(
            "recordTmdbMap",
            JSON.stringify(recordTmdbMap)
        );
    }, [recordTmdbMap]);

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);   //state hooks for the movie modal

    async function openDetails(movie) {
        try {
            const res = await fetch(`${API_BASE}/record/details/${movie.id}`);
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

                url.searchParams.set("append_to_response", "credits,watch/providers,videos"); // add where to watch to the append and trailer

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

                    let trailerUrl = null;
                    if (tmdb && tmdb.videos && tmdb.videos.results) {
                        const trailer = tmdb.videos.results.find(v => v.site === "YouTube" && v.type === "Trailer");
                        if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                    }

                    // check for prequel and sequel
                    if (tmdb.belongs_to_collection && tmdb.belongs_to_collection.id) {
                        const collectionUrl = new URL(`https://api.themoviedb.org/3/collection/${tmdb.belongs_to_collection.id}`);
                        collectionUrl.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                        try {
                            const collRes = await fetch(collectionUrl.toString(), { headers: { accept: "application/json" } });
                            if (collRes.ok) {
                                const collectionData = await collRes.json();
                                // sort by release date to determine order
                                const parts = (collectionData.parts || []).sort((a, b) => {
                                    return new Date(a.release_date || "9999-12-31") - new Date(b.release_date || "9999-12-31");
                                });
                                const currentIndex = parts.findIndex(p => p.id === tmdbId);
                                if (currentIndex !== -1) {
                                    if (currentIndex > 0) {
                                        // prequel exists
                                        const prev = parts[currentIndex - 1];
                                        patch.prequel = { id: prev.id, tmdbId: prev.id, title: prev.title };
                                    }
                                    if (currentIndex < parts.length - 1) {
                                        // sequel exists
                                        const next = parts[currentIndex + 1];
                                        patch.sequel = { id: next.id, tmdbId: next.id, title: next.title };
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Collection fetch error:", e);
                        }
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
                        patch.watchType = watchType;
                    }

                    if (trailerUrl) {
                        patch.trailerUrl = trailerUrl;
                    }

                    if (!data.title && tmdb.title) {
                        patch.title = tmdb.title;
                        patch.year = tmdb.release_date ? parseInt(tmdb.release_date.slice(0, 4)) : null;
                        patch.description = tmdb.overview;
                        patch.posterUrl = tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null;
                        patch.backdropUrl = tmdb.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}` : null;
                        patch.rating = tmdb.vote_average;
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

        } catch (e) {
            console.error(e);
        }
    }

    // Filters
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
    const [loaded, setLoaded] = useState(false); // guard

    // Helper for stable string of watched set for effect deps
    const watchedKey = useMemo(() => JSON.stringify(Array.from(watched).sort()), [watched]);

    // Function to fetch authoritative lists from the server
    async function loadLists() {
        const res = await authedFetch("/me/lists");
        if (res.status === 401) {
            throw new Error("Not authenticated (401). Open /login first.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        console.log("[/api/me/lists] payload ->", raw);


        const w = Array.isArray(raw.watchedIds)   ? raw.watchedIds
            : Array.isArray(raw.watched)      ? raw.watched
                : [];
        const t = Array.isArray(raw.toWatchIds)   ? raw.toWatchIds
            : Array.isArray(raw.toWatch)      ? raw.toWatch
                : Array.isArray(raw["to-watch"])  ? raw["to-watch"]
                    : [];

        const watchedIds = w.map(Number);
        const toWatchIds = t.map(Number);
        // Update state with the newly fetched Sets
        setWatched(new Set(watchedIds));
        setToWatch(new Set(toWatchIds));
        setLoaded(true);

        console.log("toWatch set after loadLists ->", toWatchIds);
        return { watchedIds, toWatchIds };
    }

    // use /record/bulk to fetch only watched movies
    async function fetchWatchlistSubset(ids, p = {}) {
        const body = {
            ids,
            params: {
                actor: p.actor || "",
                director: p.director || "",
                genre: p.genre || "",
                title: p.title || "",
                year: p.year || "",
                rating: p.rating || "",
            },
        };

        const res = await fetch(`${API_BASE}/record/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function doSearch(idsOverride) {
        setStatus("Loading…");

        try {
            const ids = Array.isArray(idsOverride)
                ? idsOverride
                : Array.from(watchlist);

            if (ids.length === 0) {
                setMovies([]);
                setStatus("Your watched movies is empty.");
                return;
            }

            const data = await fetchWatchlistSubset(ids, params);

            setMovies(data);

            // Attach tmdbId from our persisted map, if we know it
            const withTmdb = data.map((m) => {
                return m;
            });

            setMovies(withTmdb);
            setStatus(
                withTmdb.length
                    ? ""
                    : "Your watched movies list is empty or no matches for this search."
            );
        } catch (err) {
            console.error(err);
            setStatus("Error loading results.");
        }
    }

    useEffect(() => {
        (async () => {
            try {
                //await refresh().catch(() => {});   //refresh token in needed
                const { watchedIds } = await loadLists();
                console.log("watched set after loadLists ->", watchedIds);

                const reactions = await fetchReactions().catch(() => ({ likedTmdbIds: [], dislikedTmdbIds: [] }));
                setLikedTmdbIds(reactions.likedTmdbIds);
                setDislikedTmdbIds(reactions.dislikedTmdbIds)

                await doSearch(watchedIds); // perfoms intail search using  new ids
            } catch (e) {
                console.error("initial load failed:", e);
                setStatus(e.message || "Error loading lists.");
            }
        })();

    }, []);

    //  Effect for filter Changes
    useEffect(() => {
        if (!loaded) return;
        doSearch();

    }, [watchedKey, loaded]);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams((prev) => ({
            ...prev,
            [id.replace("q", "").toLowerCase()]: value,
        }));
    }

    const isWatched = useMemo(() => {
        if (!details || details.id == null) return false;
        const idNum = Number(details.id);
        return watched.has(idNum);
    }, [details, watched]);
    const inToWatch = useMemo(() => {
        if (!details || details.id == null) return false;
        const idNum = Number(details.id);
        return toWatch.has(idNum);
    }, [details, toWatch]);

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

    async function toggleList(list, id) { // Handles the server-side API call to toggle a movie's status
        const res = await authedFetch(`/me/lists/${list}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: (list === "watched" && watched.has(id)) || (list === "to-watch" && toWatch.has(id)) ? "remove" : "add", id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);


        const { watchedIds } = await loadLists();
        await doSearch(watchedIds);
    }

    function applyLocalReaction(tmdbIdNum, reaction) {
        if (!Number.isFinite(tmdbIdNum)) return;

        setLikedTmdbIds((prev) => {
            const set = new Set(prev);
            set.delete(tmdbIdNum);
            if (reaction === "like") set.add(tmdbIdNum);
            return Array.from(set);
        });

        setDislikedTmdbIds((prev) => {
            const set = new Set(prev);
            set.delete(tmdbIdNum);
            if (reaction === "dislike") set.add(tmdbIdNum);
            return Array.from(set);
        });
    }

    const onMarkWatched = async () => {
        if (!details || !canModifyLists) return;

        const id = Number(details.id);
        const tmdbIdNum =
            details.tmdbId != null ? Number(details.tmdbId) : null;
        const wasWatched = watched.has(id);

        try {
            await toggleList("watched", id);

            if (wasWatched && tmdbIdNum != null && Number.isFinite(tmdbIdNum)) {
                const reaction = "clear";
                applyLocalReaction(tmdbIdNum, reaction);
                updateReaction(tmdbIdNum, reaction).catch(console.error)
            }
        } catch (e) {
            console.error(e);
        }
    };

    const onAddToWatch = () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        toggleList("to-watch", id);
    };

    // Only place where like/dislike is changed (editable)
    async function handleLike() {
        if (!details?.tmdbId || !canModifyLists) return;
        const tmdbIdNum = Number(details.tmdbId);
        if (!Number.isFinite(tmdbIdNum)) return;

        const currentlyLiked = likedTmdbIds.includes(tmdbIdNum);
        const reaction = currentlyLiked ? "clear" : "like";

        applyLocalReaction(tmdbIdNum, reaction);
        updateReaction(tmdbIdNum, reaction).catch(console.error);
    }

    async function handleDislike() {
        if (!details?.tmdbId || !canModifyLists) return;
        const tmdbIdNum = Number(details.tmdbId);
        if (!Number.isFinite(tmdbIdNum)) return;

        const currentlyDisliked = dislikedTmdbIds.includes(tmdbIdNum);
        const reaction = currentlyDisliked ? "clear" : "dislike";

        applyLocalReaction(tmdbIdNum, reaction);
        updateReaction(tmdbIdNum, reaction).catch(console.error);
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
                        {movies.map((m) => {
                            const tmdbIdNum =
                                m.tmdbId != null
                                    ? Number(m.tmdbId)
                                    : Number(m.id);

                            const likedFlag =
                                tmdbIdNum != null && likedTmdbIds.includes(tmdbIdNum);
                            const dislikedFlag =
                                tmdbIdNum != null && dislikedTmdbIds.includes(tmdbIdNum);

                            return (
                                <article
                                    className="movie-card"
                                    key={m.id}
                                    onClick={() => openDetails(m)}
                                    style={{
                                        cursor: "pointer",
                                        position: "relative",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        backgroundColor: "#222", // ensuring consistent background for card
                                        borderRadius: "8px",
                                        overflow: "hidden", // ensures image respects border radius
                                    }}
                                >
                                    {(likedFlag || dislikedFlag) && (
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
                                                backgroundColor: likedFlag
                                                    ? "rgba(0, 128, 0, 1)"   // make solid
                                                    : "rgba(180, 0, 0, 1)", // make solid
                                                color: "#fff",
                                                zIndex: 10, // bring to front
                                                boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
                                            }}
                                        >
                                            {likedFlag ? "👍" : "👎"}
                                        </div>
                                    )}

                                    <img
                                        src={
                                            m.posterUrl || "https://placehold.co/300x450?text=No+Poster"
                                        }
                                        alt={m.title || ""}
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
                                            gap: "4px", // element gap, maybe increase later?
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
                                            {m.title ?? ""}
                                        </div>
                                        <div
                                            className="movie-sub"
                                            style={{
                                                fontSize: "0.85rem",
                                                opacity: 0.8,
                                                marginBottom: "2px"
                                            }}
                                        >
                                            {m.year ?? "—"}
                                        </div>

                                        {(m.rating != null || m.ageRating) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    flexWrap: "wrap",
                                                    marginBottom: "2px",
                                                }}
                                            >
                                                {m.rating != null && (
                                                    <div
                                                        className="movie-sub"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                display: "inline-block",
                                                                transform: "translateY(-1px)", // translate emoji to fix vertical allignment issue
                                                            }}
                                                        >
                                                          ⭐
                                                        </span>
                                                        <span>{Number(m.rating).toFixed(1)}</span>
                                                    </div>
                                                )}

                                                {m.ageRating && (
                                                    <span
                                                        style={{
                                                            border: "1px solid #555",
                                                            padding: "1px 6px",
                                                            borderRadius: "4px",
                                                            fontSize: "0.75rem",
                                                            color: "#ccc",
                                                            lineHeight: "1.2", // prevent offset
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        {m.ageRating}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div
                                            className="movie-sub"
                                            style={{
                                                marginTop: "auto", // move genres to bottom
                                                fontSize: "0.8rem",
                                                opacity: 0.6,
                                                lineHeight: "1.3",
                                                paddingTop: "6px"
                                            }}
                                        >
                                            {(() => {
                                                const list = Array.isArray(m.genre)
                                                    ? m.genre
                                                    : [m.genre];
                                                // remove NA or null or empty
                                                const clean = list.filter(
                                                    (g) => g && g !== "NA"
                                                );
                                                return clean.length > 0
                                                    ? clean.join(", ")
                                                    : "—";
                                            })()}
                                        </div>
                                    </div>
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
                    onNavigate={openDetails}
                />
            )}
        </>
    );
}