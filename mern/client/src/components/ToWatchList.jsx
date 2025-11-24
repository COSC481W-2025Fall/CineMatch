// src/components/ToWatchList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import MovieDetails from "./MovieDetails.jsx";
import { findTmdbIdByTitleYear } from "./converter.js";
import { authedFetch, refresh } from "../auth/api.js";

const GENRES = [
    "Action","Adventure","Animation","Comedy","Crime","Documentary","Drama",
    "Family","Fantasy","History","Horror","Music","Mystery","Romance",
    "Science Fiction","Thriller","War","Western"
];

const CAST_LIMIT = 7; //cast limit

export default function ToWatchListPage() {
   
    const [watched, setWatched]   = useState(new Set());
    const [toWatch, setToWatch]   = useState(new Set());

    const [details, setDetails]   = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    const [params, setParams] = useState({
        actor: "", director: "", genre: "", title: "", year: "", rating: ""
    });

    const [movies, setMovies]   = useState([]);
    const [status, setStatus]   = useState("Loading…");
    const [loaded, setLoaded]   = useState(false);

    // we want to re-search when the **toWatch** set changes
    const toWatchKey = useMemo(
        () => JSON.stringify(Array.from(toWatch).sort()),
        [toWatch]
    );

    // Checks for old local lists and sends in to the sever to merge
    async function maybeMergeLocal() {
        try {
            if (localStorage.getItem("lists-merged") === "yes") return;
            const oldWatched = (JSON.parse(localStorage.getItem("watched")   || "[]") || []).map(Number);
            const oldToWatch = (JSON.parse(localStorage.getItem("to-watch") || "[]") || []).map(Number);

            if (oldWatched.length || oldToWatch.length) {
                const res = await authedFetch("/api/me/lists/merge", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ watchedIds: oldWatched, toWatchIds: oldToWatch }),
                });
                if (res.ok) {
                    localStorage.setItem("lists-merged", "yes");
                    localStorage.removeItem("watched");
                    localStorage.removeItem("to-watch");
                }
            }
        } catch (e) {
            console.warn("merge local lists failed (non-fatal):", e);
        }
    }
    //function to fetch authoritative lists from the server
    async function loadLists() {
        const res = await authedFetch("/api/me/lists");
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

    // lookup for a given set of IDs
    async function fetchListSubset(ids, p = {}) {
        const body = {
            ids,
            params: {
                actor:   p.actor   || "",
                director:p.director|| "",
                genre:   p.genre   || "",
                title:   p.title   || "",
                year:    p.year    || "",
                rating:  p.rating  || "",
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
    // the main function for the search/fliters
    async function doSearch(idsOverride) {
        setStatus("Loading…");
        try {
            const ids = Array.isArray(idsOverride)
                ? idsOverride
                : Array.from(toWatch);   // <-- TO-WATCH set

            if (ids.length === 0) {
                setMovies([]);
                setStatus("Your to-watch list is empty.");
                return;
            }

            const data = await fetchListSubset(ids, params);
            setMovies(data);
            setStatus(
                data.length
                    ? ""
                    : "Your to-watch list is empty or no matches for this search."
            );
        } catch (e) {
            console.error(e);
            setStatus("Error loading results.");
        }
    }

    // initial load
    useEffect(() => {
        (async () => {
            try {
                await refresh().catch(() => {}); // ok if it fails
                await maybeMergeLocal();
                const { toWatchIds } = await loadLists();
                await doSearch(toWatchIds);      // search using fresh IDs
            } catch (e) {
                console.error("initial load failed:", e);
                setStatus(e.message || "Error loading lists.");
            }
        })();
        
    }, []);

    // reruns search when filters or list change 
    useEffect(() => {
        if (!loaded) return;
        doSearch();
       
    }, [params, toWatchKey, loaded]);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams(prev => ({
            ...prev,
            [id.replace("q", "").toLowerCase()]: value
        }));
    }

  
    async function openDetails(movie) {
        try {//fetching the backend details for the movie
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const titleForLookup = (data?.title && data.title.length > 0)
                ? data.title : movie.title;
            const yearForLookup  = (typeof data?.year === "number")
                ? data.year : movie.year;

            const tmdbId = await findTmdbIdByTitleYear(
                titleForLookup,
                yearForLookup,
                { language: "en-US" }
            );

            let patch = {};
            if (tmdbId != null) {
                const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                url.searchParams.set("append_to_response", "credits");
                const tmdbRes = await fetch(url.toString(), {
                    headers: { accept: "application/json" },
                });
                if (tmdbRes.ok) {
                    const tmdb = await tmdbRes.json();// Process cast list, sort by order, and limit
                    let tmdbCast = Array.isArray(tmdb?.credits?.cast)
                        ? tmdb.credits.cast
                        : [];
                    tmdbCast.sort(
                        (a, b) =>
                            (Number.isFinite(a?.order) ? a.order : 999) -
                            (Number.isFinite(b?.order) ? b.order : 999)
                    );
                    const topCast = tmdbCast
                        .slice(0, CAST_LIMIT)
                        .map(p => p?.name)
                        .filter(Boolean);
                    const runtime = typeof tmdb?.runtime === "number" ? tmdb.runtime : null; //gets runtime

                    patch.tmdbId = tmdbId;
                    if (topCast.length) patch.topCast = topCast;
                    if (runtime != null) patch.runtime = runtime;
                }
            }

            setDetails({ id: movie.id, ...data, ...patch });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
        }
    }

    const isWatched = useMemo(
        () => details && watched.has(details.id),
        [details, watched]
    );
    const inToWatch = useMemo(
        () => details && toWatch.has(details.id),
        [details, toWatch]
    );

    // update lists server-side then refresh + re-search
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

        const { toWatchIds } = await loadLists();
        await doSearch(toWatchIds);
    }

    const onMarkWatched = () => {
        if (!details) return;
        toggleList("watched", Number(details.id)).catch(console.error);
    };

    const onAddToWatch = () => {
        if (!details) return;
        toggleList("to-watch", Number(details.id)).catch(console.error);
    };

    return (
        <>
            <div className="navigation-top">
                <Link to="/" className="navigation-button" style={{ color: "inherit", textDecoration: "none" }}>SEARCH</Link>
                <div className="logo">cineMatch</div>
                <Link to="/help" className="navigation-button" style={{ textDecoration: "none" }}>HELP</Link>
                <Link to="/feed" className="navigation-button" style={{ textDecoration: "none" }}>FEED</Link>
                <Link to="/watchlist" className="navigation-button" style={{ textDecoration: "none" }}>WATCHED LIST</Link>
                <Link to="/to-watch-list" className="navigation-button active" style={{ textDecoration: "none" }}>TO-WATCH LIST</Link>
            </div>

            <div className="main-container">
                <aside className="sidebar">
                    <ul className="search-filters">
                        {["Actor", "Director", "Genre", "Title", "Year", "Rating"].map(label => (
                            <li className="filter-item" key={label}>
                                <div className="filter-link">
                                    <input
                                        id={`q${label}`}
                                        className="filter-input"
                                        placeholder={`${label.toUpperCase()}...`}
                                        value={params[label.toLowerCase()] || ""}
                                        onChange={handleChange}
                                        onKeyDown={e => e.key === "Enter" && doSearch()}
                                    />
                                </div>
                            </li>
                        ))}
                        <li className="filter-item" key="GenreSelect">
                            <div className="filter-link">
                                <select
                                    id="qGenre"
                                    className="filter-select"
                                    value={params.genre || ""}
                                    onChange={handleChange}
                                >
                                    <option value="">GENRE...</option>
                                    {GENRES.map(g => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </li>
                    </ul>
                    <button className="go-btn" onClick={() => doSearch()}>SEARCH</button>

                    <footer className="sidebar-footer-credit">
                        <p>
                            Source of data:{" "}
                            <a href="https://www.themoviedb.org/">
                                TMDB{" "}
                                <img
                                    src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                                    style={{ height: "10px", width: "auto", verticalAlign: "middle", marginLeft: "6px" }}
                                    alt="TMDB logo"
                                />
                            </a>
                        </p>
                        <p>This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.</p>
                    </footer>
                </aside>

                <main className="content-area">
                    <div id="status" className="muted">{status}</div>
                    <div id="results" className="movie-grid">
                        {movies.map((m, idx) => (
                            <article
                                className="movie-card"
                                key={idx}
                                onClick={() => openDetails(m)}
                                style={{ cursor: "pointer" }}
                            >
                                <img
                                    src={m.posterUrl || "https://placehold.co/300x450?text=No+Poster"}
                                    alt={m.title || ""}
                                />
                                <div className="movie-title">{m.title ?? "Untitled"}</div>
                                <div className="movie-sub">
                                    {m.year ?? "—"} • {Array.isArray(m.genre) ? m.genre.join(", ") : (m.genre || "—")}
                                </div>
                                {m.rating != null && (
                                    <div className="movie-sub">⭐ {m.rating}</div>
                                )}
                            </article>
                        ))}
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
                />
            )}
        </>
    );
}
