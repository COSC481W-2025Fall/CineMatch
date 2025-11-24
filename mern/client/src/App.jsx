// App.jsx (replacement)
import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx";
import ErrorModal from "./components/ErrorModal.jsx";
import { findTmdbIdByTitleYear } from "./components/converter";
import { Link } from "react-router-dom";
import { authedFetch } from "./auth/api.js"; // <-- use your auth helper

const API_BASE = "";

// TMDB
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const CAST_LIMIT = 7;

const GENRES = [
    "Action","Adventure","Animation","Comedy","Crime","Documentary","Drama",
    "Family","Fantasy","History","Horror","Music","Mystery","Romance",
    "Science Fiction","Thriller","War","Western"
];

function App() {
    // keep localStorage for now so WatchList page (current impl) still works
    const [watched, setWatched]   = useState(() => new Set(JSON.parse(localStorage.getItem("watched")   || "[]")));
    const [toWatch, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("to-watch") || "[]")));

    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => { localStorage.setItem("watched",   JSON.stringify([...watched])); }, [watched]);
    useEffect(() => { localStorage.setItem("to-watch",  JSON.stringify([...toWatch])); }, [toWatch]);

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    async function openDetails(movie) {
        try {
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const titleForLookup = (data && typeof data.title === "string" && data.title.length > 0)
                ? data.title : movie.title;
            const yearForLookup = (data && typeof data.year === "number")
                ? data.year : movie.year;

            const tmdbId = await findTmdbIdByTitleYear(titleForLookup, yearForLookup, { language: "en-US" });
            console.log("[TMDB TEST] input:", { titleForLookup, yearForLookup }, "=> tmdbId:", tmdbId);

            let patch = {};
            if (tmdbId != null) {
                const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
                url.searchParams.set("api_key", TMDB_API_KEY);
                url.searchParams.set("append_to_response", "credits");

                const tmdbRes = await fetch(url.toString(), { headers: { accept: "application/json" } });
                if (tmdbRes.ok) {
                    const tmdb = await tmdbRes.json();

                    let tmdbCast = Array.isArray(tmdb?.credits?.cast) ? tmdb.credits.cast : [];
                    tmdbCast.sort((a, b) => {
                        const ao = (typeof a?.order === "number") ? a.order : 999;
                        const bo = (typeof b?.order === "number") ? b.order : 999;
                        return ao - bo;
                    });

                    const topActors = tmdbCast.slice(0, CAST_LIMIT);
                    const topCast = topActors
                        .map(p => (p && typeof p.name === "string" && p.name.length > 0) ? p.name : null)
                        .filter(Boolean);

                    const runtime = (typeof tmdb?.runtime === "number") ? tmdb.runtime : null;

                    patch.tmdbId = tmdbId;
                    if (topCast.length) patch.topCast = topCast;
                    if (runtime !== null) patch.runtime = runtime;

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime);
                }
            }

            setDetails({ id: movie.id, ...data, ...patch });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
            setErrorMsg(e.message || "Failed to load movie details.");
        }
    }

    // --- search UI state ---
    const [params, setParams] = useState({
        actor: "", director: "", genre: "", title: "",
        year_min: "", year_max: "", rating_min: "", rating_max: ""
    });
    const [movies, setMovies] = useState([]);
    const [status, setStatus] = useState("Loading…");

    const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
    const [selectedGenres, setSelectedGenres] = useState([]);

    function toggleDropdown() { setGenreDropdownOpen(v => !v); }
    function handleGenreToggle(genre) {
        setSelectedGenres(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]);
    }
    function getGenreLabel() { return selectedGenres.length === 0 ? "GENRE..." : `${selectedGenres.length} SELECTED`; }
    function getDropdownArrowClass() { return genreDropdownOpen ? "dropdown-arrow open" : "dropdown-arrow"; }
    function isGenreChecked(genre) { return selectedGenres.includes(genre); }

    function buildQuery(p) {
        const qs = new URLSearchParams();
        Object.entries(p).forEach(([k, v]) => {
            if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
            if (Array.isArray(v)) v.forEach(val => qs.append(k, val));
            else qs.append(k, v);
        });
        const query = qs.toString();
        return query ? `/record?${query}` : "/record";
    }

    async function fetchMovies(p = {}) {
        const res = await fetch(API_BASE + buildQuery(p));
        let payload;
        try { payload = await res.json(); } catch {}
        if (!res.ok) {
            const msg = payload?.error || `Error loading results (HTTP ${res.status}).`;
            throw new Error(msg);
        }
        return payload;
    }

    async function doSearch() {
        setStatus("Loading…");
        try {
            const query = { ...params, ...(selectedGenres.length ? { genre: selectedGenres } : {}) };
            const data = await fetchMovies(query);
            setMovies(data);
            setStatus(data.length ? "" : "No results found.");
        } catch (err) {
            console.error(err);
            setStatus("");
            setErrorMsg(err.message);
        }
    }

    useEffect(() => { doSearch(); /* eslint-disable-next-line */ }, []);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams(prev => ({
            ...prev,
            [id.replace("q", "").toLowerCase()]: value
        }));
    }

    // --- Watched / To-Watch toggle with API + localStorage ---
    const isWatched  = useMemo(() => details && watched.has(details.id), [details, watched]);
    const inToWatch  = useMemo(() => details && toWatch.has(details.id), [details, toWatch]);

    async function toggleList(list, hasIt) {
        if (!details) return;
        const id = Number(details.id);
        const action = hasIt ? "remove" : "add";

        // Call API (requires logged-in user, authedFetch sets Authorization if you’ve logged in)
        try {
            const res = await authedFetch(`/api/me/lists/${list}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, id }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error(e);
            // don’t update local state if server failed
            setErrorMsg(e.message || "Failed to update list.");
            return;
        }

        // Local mirror so existing WatchList page still works
        if (list === "watched") {
            setWatched(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        } else {
            setWatchlist(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        }

        // Let other pages refresh if they care
        window.dispatchEvent(new CustomEvent("lists:changed", { detail: { list, action, id } }));
    }

    const onMarkWatched = () => toggleList("watched", !!isWatched);
    const onAddToWatch  = () => toggleList("to-watch", !!inToWatch);

    return (
        <>
            <div className="navigation-top">
                <Link to="/" style={{ color: "inherit", textDecoration: "none" }} className="navigation-button active">SEARCH</Link>
                <div className="logo">cineMatch</div>
                <Link to="/register" style={{ textDecoration: "none" }} className="navigation-button">REGISTER</Link>
                <Link to="/login" style={{ textDecoration: "none" }} className="navigation-button">LOGIN</Link>
                <Link to="/help" style={{ textDecoration: "none" }} className="navigation-button">HELP</Link>
                <Link to="/feed" style={{ textDecoration: "none" }} className="navigation-button">FEED</Link>
                <Link to="/watchlist" style={{ textDecoration: "none" }} className="navigation-button">WATCHED LIST</Link>
                <Link to="/to-watch-list" style={{ textDecoration: "none" }} className="navigation-button">TO-WATCH LIST</Link>
            </div>

            <div className="main-container">
                <aside className="sidebar">
                    <ul className="search-filters">
                        {["Actor","Director","Title"].map(label => (
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
                        ))}

                        {/* Year range */}
                        <li className="year-range" key="YearRange">
                            <div className="year-label">YEAR</div>
                            <div className="year-bubbles">
                                <div className="filter-item">
                                    <div className="filter-link">
                                        <input
                                            id="qYear_Min"
                                            className="filter-input"
                                            placeholder="MIN"
                                            value={params.year_min}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                                <div className="filter-item">
                                    <div className="filter-link">
                                        <input
                                            id="qYear_Max"
                                            className="filter-input"
                                            placeholder="MAX"
                                            value={params.year_max}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>

                        {/* Rating range */}
                        <li className="rating-range" key="RatingRange">
                            <div className="rating-label">RATING (0–10)</div>
                            <div className="rating-bubbles">
                                <div className="filter-item">
                                    <div className="filter-link">
                                        <input
                                            id="qRating_Min"
                                            className="filter-input"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.1" min="0" max="10"
                                            placeholder="MIN"
                                            value={params.rating_min}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                                <div className="filter-item">
                                    <div className="filter-link">
                                        <input
                                            id="qRating_Max"
                                            className="filter-input"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.1" min="0" max="10"
                                            placeholder="MAX"
                                            value={params.rating_max}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>

                        {/* Genre multiselect */}
                        <li className="filter-item genre-dropdown" key="Genre">
                            <div className="filter-link genre-header" onClick={toggleDropdown}>
                                <span className="genre-label">{getGenreLabel()}</span>
                                <span className={getDropdownArrowClass()}>▼</span>
                            </div>
                            {genreDropdownOpen && (
                                <div className="genre-checkbox-list">
                                    {GENRES.map((g) => (
                                        <label key={g} className="genre-checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={isGenreChecked(g)}
                                                onChange={() => handleGenreToggle(g)}
                                            />
                                            <span>{g}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </li>
                    </ul>

                    <button className="go-btn" onClick={doSearch}>SEARCH</button>

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
                            <article className="movie-card" key={idx} onClick={() => openDetails(m)} style={{ cursor: "pointer" }}>
                                <img src={m.posterUrl || "https://placehold.co/300x450?text=No+Poster"} alt={m.title || ""} />
                                <div className="movie-title">{m.title ?? "Untitled"}</div>
                                <div className="movie-sub">
                                    {m.year ?? "—"} • {Array.isArray(m.genre) ? m.genre.join(", ") : (m.genre || "—")}
                                </div>
                                {m.rating != null && <div className="movie-sub">⭐ {m.rating}</div>}
                            </article>
                        ))}
                    </div>
                </main>

                {showDetails && (
                    <MovieDetails
                        details={details}
                        onClose={() => setShowDetails(false)}
                        isWatched={!!isWatched}
                        inToWatch={!!inToWatch}
                        onMarkWatched={onMarkWatched}
                        onAddToWatch={onAddToWatch}
                        castLimit={CAST_LIMIT}
                        runtime={typeof details?.runtime === "number" ? details.runtime : null}
                    />
                )}

                <ErrorModal message={errorMsg} onClose={() => setErrorMsg("")} />
            </div>
        </>
    );
}

export default App;
