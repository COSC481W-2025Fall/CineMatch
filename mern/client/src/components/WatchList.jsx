// src/components/WatchList.jsx
import React, {useEffect, useMemo, useState} from "react";
import { Link } from "react-router-dom";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";

const API_BASE = "";

const GENRES = [
    "Action","Adventure","Animation","Comedy","Crime","Documentary","Drama",
    "Family","Fantasy","History","Horror","Music","Mystery","Romance",
    "Science Fiction","Thriller","War","Western"
];

const CAST_LIMIT = 7
export default function WatchListPage() {

    const [watched, setWatched] = useState(() => new Set(JSON.parse(localStorage.getItem("watched") || "[]")));
    const [toWatch, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("to-watch") || "[]")));
    const watchlist = new Set((JSON.parse(localStorage.getItem("watched") || "[]") || []).map(Number));
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);


    useEffect(() => {
        localStorage.setItem("watched", JSON.stringify([...watched]));
    }, [watched]);
    useEffect(() => {
        localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
    }, [toWatch]);


    // sidebar toggle functionality
    // useEffect(() => {
    //     const toggleButton = document.getElementById("sidebarToggle");
    //     const mainContainer = document.querySelector(".main-container");

    //     if (toggleButton && mainContainer) {
    //         const toggleSidebar = () => {
    //             mainContainer.classList.toggle("sidebar-collapsed");
    //         };
    //         toggleButton.addEventListener("click", toggleSidebar);
    //         return () => toggleButton.removeEventListener("click", toggleSidebar);
    //     }
    // }, []);

    // mobile navbar toggle functionality
    // useEffect(() => {
    //     const mobileNavToggle = document.getElementById("mobileNavToggle");
    //     const navLinks = document.getElementById("navLinks");

    //     if (!mobileNavToggle || !navLinks) return;

    //     const toggleMobileNav = () => {
    //         navLinks.classList.toggle("open");
    //     };

    //     mobileNavToggle.addEventListener("click", toggleMobileNav);
    //     return () => mobileNavToggle.removeEventListener("click", toggleMobileNav);
    // }, []);
    


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

            // if found then pull actors and runtime from api
            if (tmdbId !== null && tmdbId !== undefined) {
                const numOfActors = CAST_LIMIT;
                const url = new URL("https://api.themoviedb.org/3/movie/" + tmdbId);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                url.searchParams.set("append_to_response", "credits"); // include cast list

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
                    
                    // fill patch objects
                    patch.tmdbId = tmdbId; // keep for debugging or other uses
                    if (topCast.length > 0) {
                        patch.topCast = topCast; // override DB actors with top billed tmdb list
                    }
                    if (runtime !== null) {
                        patch.runtime = runtime; // add runtime (minutes) - convert this to hr/min on frontend
                    }

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime);
                }
            }

            setDetails({id: movie.id, ...data, ...patch});
            setShowDetails(true);
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
        rating: ""
    });

    const [movies, setMovies] = useState([]);
    const [status, setStatus] = useState("Loading…");

    // Since now we got the new /record/bulk backend, we can utilize it more efficiently
    async function fetchWatchlistSubset(p = {}) {
        const body = {
            ids: Array.from(watchlist),
            params: {
                actor: p.actor || "",
                director: p.director || "",
                genre: p.genre || "",
                title: p.title || "",
                year: p.year || "",
                rating: p.rating || ""
            }
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

            setMovies(data);
            setStatus(
                data.length
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
        // eslint-disable-next-line
    }, []);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams(prev => ({
            ...prev,
            [id.replace("q", "").toLowerCase()]: value
        }));
    }

    const isWatched = useMemo(() => details && watched.has(details.id), [details, watched]);
    const inToWatch = useMemo(() => details && toWatch.has(details.id), [details, toWatch]);

    const onMarkWatched = () => {
        if (!details) return;
        const id = Number(details.id);
        setWatched(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const onAddToWatch = () => {
        if (!details) return;
        const id = Number(details.id);
        setWatchlist(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    function clearFilters() {
    // Reset all text + numeric filters
    setParams({
        actor: "",
        director: "",
        title: "",
        year_min: "",
        year_max: "",
        rating_min: "",
        rating_max: ""
    });
    setSelectedGenres([]);// Reset genres 
    setGenreDropdownOpen(false); // Close genre dropdown (optional)
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
            
            <div className={`main-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <aside className="sidebar">
                    <ul className="search-filters">
                        {["Actor", "Director", "Genre", "Title", "Year", "Rating"].map((label) => (
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
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                            </div>
                        </li>
                    </ul>

                    <button className="go-btn" onClick={doSearch}>SEARCH</button>
                     {/* The button to actually search, this one is permanent */}
                    <button className="go-btn"onClick={clearFilters}>CLEAR</button>
                      {/* This clear the search filters  */}

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
                        {movies.map((m, idx) => (
                            <article
                                className="movie-card"
                                key={idx}
                                onClick={() => openDetails(m)}
                                style={{ cursor: "pointer" }}>
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
