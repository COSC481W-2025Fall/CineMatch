// src/components/ToWatchList.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import MovieDetails from "./MovieDetails";

const API_BASE = "";

const GENRES = [
    "Action","Adventure","Animation","Comedy","Crime","Documentary","Drama",
    "Family","Fantasy","History","Horror","Music","Mystery","Romance",
    "Science Fiction","Thriller","War","Western"
];

export default function WatchListPage() {

    const watchlist = new Set(JSON.parse(localStorage.getItem("to-watch") || "[]"));

    
    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    async function openDetails(movie) {
        try {
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setDetails({ id: movie.id, ...data });
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

    function buildQuery(p) {
        const qs = new URLSearchParams();
        Object.entries(p).forEach(([k, v]) => { if (v) qs.append(k, v); });
        const fullSearch = qs.toString().replace(/\+/g, "%20");
        return fullSearch ? `/record?${qs.toString()}` : "/record";
    }

    async function fetchMovies(p = {}) {
        const url = API_BASE + buildQuery(p);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function doSearch() {
        setStatus("Loading…");
        try {
            const data = await fetchMovies(params);
            
            const filtered = data.filter(m => watchlist.has(m.id));
            setMovies(filtered);
            setStatus(filtered.length ? "" : "Your watch list is empty or no matches for this search.");
        } catch (err) {
            console.error(err);
            setStatus("Error loading results.");
        }
    }

    useEffect(() => { doSearch(); /* eslint-disable-next-line */ }, []);

    function handleChange(e) {
        const { id, value } = e.target;
        setParams(prev => ({ ...prev, [id.replace("q", "").toLowerCase()]: value }));
    }

    return (
        <>
            <div className="navigation-top">
                <button className="navigation-button">
                    <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
                        SEARCH
                    </Link>
                </button>
                <div className="logo">cineMatch</div>
                <button className="navigation-button" >FEED</button>  
                <button className="navigation-button"><Link to="/watchlist" style={{ color: "inherit", textDecoration: "none" }}>WATCHED LIST</Link></button>
                <button className="navigation-button active"><Link to="/to-watch-list" style={{ color: "inherit", textDecoration: "none" }}>TO-WATCH LIST</Link></button>
            </div>

            <div className="main-container">
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
                        <li className="filter-item" key="Genre">
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
            </div>

            {showDetails && details && (
                <MovieDetails
                    details={details}
                    onClose={() => setShowDetails(false)}
                    isWatched={false}
                    inWatchlist={true}
                    onMarkWatched={() => {}}
                    onAddWatchlist={() => {}}
                />
            )}
        </>
    );
}
