// src/components/ToWatchList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { API_BASE, authedFetch, refresh } from "../auth/api.js";
import { useAuth } from "../auth/AuthContext.jsx";


const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
    "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance",
    "Science Fiction", "Thriller", "War", "Western"
];

const AGE_RATINGS_DATA = [
    { id: 0, name: "Not Rated" },
    { id: 1, name: "G" },
    { id: 2, name: "PG" },
    { id: 3, name: "PG-13" },
    { id: 4, name: "R" },
    { id: 5, name: "NC-17" },
];

const CAST_LIMIT = 5; // cast limit
/*
// localStorage helpers
function loadSetFromStorage(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.map(Number));
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
        return parsed.map(Number);
    } catch {
        return [];
    }
}

 */

// recordId - tmdbId map (from Search page)
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

export default function ToWatchListPage() {
    const { user } = useAuth();
    const canModifyLists = !!user;

    const [watched, setWatched] = useState(new Set());
    const [toWatch, setToWatch] = useState(new Set());

    // for this page, watchlist = to-watch movie ids, derived from state
    const watchlist = useMemo(
        () => new Set([...toWatch]),
        [toWatch]
    );

    // liked / disliked TMDB ids – cleared when removed from watched list
    // removing completely because why would a watched movie be on the water later list??
    const [likedTmdbIds, setLikedTmdbIds] = useState([]);
    const [dislikedTmdbIds, setDislikedTmdbIds] = useState([]);

    // recordId - tmdbId map
    const [recordTmdbMap, setRecordTmdbMap] = useState(() =>
        loadMapFromStorage("recordTmdbMap")
    );

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);
    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        localStorage.setItem("recordTmdbMap", JSON.stringify(recordTmdbMap));
    }, [recordTmdbMap]);

    async function openDetails(movie) {
        try {
            const res = await fetch(`${API_BASE}/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const rawTmdbId =
                movie.tmdbId != null && movie.tmdbId !== ""
                    ? movie.tmdbId
                    : movie.id;

            const tmdbId =
                rawTmdbId != null && rawTmdbId !== ""
                    ? Number(rawTmdbId)
                    : null;



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

                    // get trailer
                    let trailerUrl = null;
                    if (tmdb && tmdb.videos && tmdb.videos.results) {
                        const trailer = tmdb.videos.results.find(
                            (v) => v.site === "YouTube" && v.type === "Trailer"
                        );
                        if (trailer) {
                            trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                        }
                    }

                    // check for prequel and sequel
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
                                        // prequel
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

                    if (!data.title) {
                        patch.title = tmdb.title;
                        patch.year = tmdb.release_date
                            ? parseInt(tmdb.release_date.slice(0, 4))
                            : null;
                        patch.description = tmdb.overview;
                        patch.posterUrl = tmdb.poster_path
                            ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`
                            : null;
                        patch.backdropUrl = tmdb.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}`
                            : null;
                        patch.rating = tmdb.vote_average;
                    }


                }
            }

            // Make sure we store tmdbId on details if we have one
            const finalTmdbId =
                typeof patch.tmdbId === "number"
                    ? patch.tmdbId
                    : typeof data.tmdbId === "number"
                        ? data.tmdbId
                        : movie.tmdbId != null && movie.tmdbId !== ""
                            ? Number(movie.tmdbId)
                            : null;

            setDetails({ id: movie.id, tmdbId: finalTmdbId, ...data, ...patch });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
        }
    }

    /*const [params, setParams] = useState({
        actor: "",
        director: "",
        genre: "",
        title: "",
        year: "",
        rating: "",
        year_min: "",
        year_max: "",
        rating_min: "",
        rating_max: ""
    });*/
    const [params, setParams] = useState({
        actor: "",
        director: "",
        title: "",
        keyword: "",
        year_min: "",
        year_max: "",
        rating_min: "",
        rating_max: "",
        genre: "",
        year: "",
        rating: "",
    });

    const [movies, setMovies] = useState([]);
    const [status, setStatus] = useState("Loading…");

    const [selectedGenres, setSelectedGenres] = useState([]);
    const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);


    const [ageRatingDropdownOpen, setAgeRatingDropdownOpen] = useState(false);
    const [selectedAgeRatings, setSelectedAgeRatings] = useState([]);

    function toggleDropdown() {
        setGenreDropdownOpen((prev) => !prev);
    }

    function toggleAgeRatingDropdown() {
        setAgeRatingDropdownOpen((prev) => !prev);
    }

    function handleGenreToggle(genre) {
        const newSelectedGenres = [...selectedGenres];

        if (selectedGenres.includes(genre)) {
            const index = newSelectedGenres.indexOf(genre);
            newSelectedGenres.splice(index, 1);
        } else {
            newSelectedGenres.push(genre);
        }
        setSelectedGenres(newSelectedGenres);
    }

    function getGenreLabel() {
        if (selectedGenres.length === 0) {
            return "GENRE...";
        } else {
            return selectedGenres.length + " SELECTED";
        }
    }

    function getDropdownArrowClass() {
        return genreDropdownOpen ? "dropdown-arrow open" : "dropdown-arrow";
    }

    function isGenreChecked(genre) {
        return selectedGenres.includes(genre);
    }

    function handleAgeRatingToggle(id) {
        const newSelected = [...selectedAgeRatings];
        if (selectedAgeRatings.includes(id)) {
            const index = newSelected.indexOf(id);
            newSelected.splice(index, 1);
        } else {
            newSelected.push(id);
        }
        setSelectedAgeRatings(newSelected);
    }

    function getAgeRatingLabel() {
        if (selectedAgeRatings.length === 0) {
            return "AGE RATING...";
        } else {
            return selectedAgeRatings.length + " SELECTED";
        }
    }

    function getAgeDropdownArrowClass() {
        return ageRatingDropdownOpen ? "dropdown-arrow open" : "dropdown-arrow";
    }

    function isAgeRatingChecked(id) {
        return selectedAgeRatings.includes(id);
    }

    const [loaded, setLoaded] = useState(false);

    // Re-search when the **toWatch** set changes
    const toWatchKey = useMemo(
        () => JSON.stringify(Array.from(toWatch).sort()),
        [toWatch]
    );

    // Function to fetch authoritative lists from the server
    async function loadLists() {
        const res = await authedFetch("/me/lists");
        if (res.status === 401) {
            throw new Error("Not authenticated (401). Open /login first.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();
        //console.log("[/api/me/lists] payload ->", raw);

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

        //console.log("toWatch set after loadLists ->", toWatchIds);
        return { watchedIds, toWatchIds };
    }

    // use /record/bulk to fetch only to-watch movies
    async function fetchWatchlistSubset(ids, p = {}) {
        const finalGenres = selectedGenres.length ? selectedGenres : [];
        const finalAgeRatings = selectedAgeRatings.length ? selectedAgeRatings : [];

        const body = {
            ids,
            params: {
                actor: p.actor || "",
                director: p.director || "",
                title: p.title || "",
                keyword: p.keyword || "",

                year_min: p.year_min || p.year || "",
                year_max: p.year_max || "",
                rating_min: p.rating_min || p.rating || "",
                rating_max: p.rating_max || "",
                ...(finalGenres.length ? { genre: finalGenres } : {}),
                ...(finalAgeRatings.length ? { age_rating: finalAgeRatings } : {}),
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
                setStatus("Your watch later list is empty.");
                return;
            }

            const data = await fetchWatchlistSubset(ids, params);

            // Attach known TMDB ids from recordTmdbMap
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
                    : "Your watch later list is empty or no matches for this search."
            );
        } catch (err) {
            console.error(err);
            setStatus("Error loading results.");
        }
    }

    // initial load
    useEffect(() => {
        (async () => {
            try {
                //await refresh().catch(() => {}); // ok if it fails
                const { toWatchIds } = await loadLists();
                await doSearch(toWatchIds);      // search using fresh IDs
            } catch (e) {
                console.error("initial load failed:", e);
                setStatus(e.message || "Error loading lists.");
            }
        })();
    }, []);

    // Reruns search when filters or list change
    useEffect(() => {
        if (!loaded) return;
        doSearch();
    }, [toWatchKey, loaded]);

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

    // Movie like/dislike (read-only)
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

    // Update lists server-side then refresh and re-searches
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

        const { toWatchIds } = await loadLists();
        await doSearch(toWatchIds);
    }

    // Toggle watched
    const onMarkWatched = async () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        const tmdbId =
            details.tmdbId != null ? Number(details.tmdbId) : null;

        const wasWatched = watched.has(id);

        try {
            await toggleList("watched", id);

            // If removed from watched list, clear like/dislike for this TMDB id
            if (wasWatched && tmdbId != null && Number.isFinite(tmdbId)) {
                setLikedTmdbIds((prev) => {
                    const next = prev.filter((x) => x !== tmdbId);
                    localStorage.setItem("likedTmdbIds", JSON.stringify(next));
                    return next;
                });

                setDislikedTmdbIds((prev) => {
                    const next = prev.filter((x) => x !== tmdbId);
                    localStorage.setItem("dislikedTmdbIds", JSON.stringify(next));
                    return next;
                });
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

    function clearFilters() {
        setParams({
            actor: "",
            director: "",
            title: "",
            keyword: "",
            genre: "",
            year: "",
            rating: "",
            year_min: "",
            year_max: "",
            rating_min: "",
            rating_max: "",
        });
        setSelectedGenres([]);
        setGenreDropdownOpen(false);
        setSelectedAgeRatings([]);
        setAgeRatingDropdownOpen(false);
        doSearch();
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
                    <Link to="/watchlist" style={{ textDecoration: 'none' }} className="navigation-button">WATCHED LIST</Link>
                    <Link to="/to-watch-list" style={{ textDecoration: 'none' }} className="navigation-button active">TO-WATCH LIST</Link>

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
                        {["Actor", "Director", "Title", "Keyword"].map((label) => (
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

                        {/* YEAR RANGE */}
                        <li className="year-range" key="YearRange">
                            <div className="year-label">YEAR</div>
                            <div className="year-bubbles">
                                <div className="filter-item">
                                    <div className="filter-link">
                                        <input
                                            id="qYear_Min"
                                            className="filter-input"
                                            type="number"
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
                                            type="number"
                                            placeholder="MAX"
                                            value={params.year_max}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>

                        {/* RATING RANGE */}
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
                                            step="0.1"
                                            min="0"
                                            max="10"
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
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            placeholder="MAX"
                                            value={params.rating_max}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </div>
                                </div>
                            </div>
                        </li>

                        {/* Genre dropdown */}
                        <li className="filter-item genre-dropdown" key="Genre">
                            <div
                                className="filter-link genre-header"
                                onClick={toggleDropdown}
                            >
                                <span className="genre-label">{getGenreLabel()}</span>
                                <span className={getDropdownArrowClass()}>▼</span>
                            </div>
                            {genreDropdownOpen && (
                                <div className="genre-checkbox-list">
                                    {GENRES.map((genre) => (
                                        <label key={genre} className="genre-checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={isGenreChecked(genre)}
                                                onChange={() => handleGenreToggle(genre)}
                                            />
                                            <span>{genre}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </li>

                        {/* Age rating dropdown */}
                        <li className="filter-item genre-dropdown" key="AgeRating">
                            <div
                                className="filter-link genre-header"
                                onClick={toggleAgeRatingDropdown}
                            >
                                <span className="genre-label">{getAgeRatingLabel()}</span>
                                <span className={getAgeDropdownArrowClass()}>▼</span>
                            </div>
                            {ageRatingDropdownOpen && (
                                <div className="genre-checkbox-list">
                                    {AGE_RATINGS_DATA.map((rating) => (
                                        <label key={rating.id} className="genre-checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={isAgeRatingChecked(rating.id)}
                                                onChange={() => handleAgeRatingToggle(rating.id)}
                                            />
                                            <span>{rating.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </li>
                    </ul>

                    <button className="go-btn" onClick={doSearch}>
                        SEARCH
                    </button>
                    {/* CLEAR FILTERS button */}
                    <button className="go-btn" onClick={clearFilters}>
                        CLEAR
                    </button>

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

                {!sidebarCollapsed && (
                    <div
                        className="sidebar-overlay"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}

                <main className="content-area">
                    <div id="status" className="muted">{status}</div>
                    <div id="results" className="movie-grid">
                        {movies.map((m) => {
                            const tmdbIdNum =
                                m.tmdbId != null
                                    ? Number(m.tmdbId)
                                    : recordTmdbMap[m.id] != null
                                        ? Number(recordTmdbMap[m.id])
                                        : null;

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
                    // read-only like/dislike info for the modal badge
                    isLiked={!!isLiked}
                    isDisliked={!!isDisliked}
                    // no onLike/onDislike, no likesEditable here
                    onNavigate={openDetails}
                />
            )}
        </>
    );
}
