// src/components/RecommendationFeed.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "./Navigation.jsx";
import "../App.css";
import MovieDetails from "./MovieDetails";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const DEFAULT_LIMIT = 20; // changing for testing, full change already made on feed cleanup

export default function RecommendationFeed() {
    const watchedIds = useMemo(
        () => new Set(JSON.parse(localStorage.getItem("watched") || "[]")),
        []
    );

    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [recs, setRecs] = useState([]);
    const [status, setStatus] = useState("Loading…");

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    async function openDetails(rec) {
        try {
            const title = rec?.title ?? "";
            const year = rec?.year ? String(rec.year) : "";
            const qs = new URLSearchParams();
            if (title) qs.set("name", title);
            if (year) qs.set("year", year);
            const searchRes = await fetch(`/record?${qs.toString()}`);
            let movieId = null;
            if (searchRes.ok) {
                const hits = await searchRes.json();
                if (Array.isArray(hits) && hits.length && hits[0]?.id != null) {
                    movieId = hits[0].id;
                }
            }

            if (movieId != null) {
                const res = await fetch(`/record/details/${movieId}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setDetails({ id: movieId, ...data });
                setShowDetails(true);
                return;
            }

            setDetails({
                id: null,
                title,
                year: rec?.year ?? null,
                rating: rec?.rating ?? null,
                posterUrl: rec?.posterPath ? `${TMDB_IMG}${rec.posterPath}` : null,
                description: rec?.overview || "",
                genres: [],
                topCast: [],
            });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
        }
    }

    async function buildRecommendations() {
        if (watchedIds.size === 0) {
            setStatus("Your watched list is empty — watch a few movies to seed recommendations.");
            setRecs([]);
            return;
        }
        setStatus("Building your feed…");
        try {
            const body = {
                watchedIds: Array.from(watchedIds),
                limit: Math.max(1, Number(limit) || DEFAULT_LIMIT),
            };
            const resp = await fetch("/feed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            const items = Array.isArray(json?.items) ? json.items : [];
            setRecs(items);
            setStatus(items.length ? "" : "No recommendations yet. Try watching a few more movies.");
        } catch (e) {
            console.error("Feed error:", e);
            setStatus("Error building your feed.");
            setRecs([]);
        }
    }

    useEffect(() => { buildRecommendations(); }, []);

    return (
        <>
            {/* <div className="navigation-top">
                <Link to="/" style={{ color: "inherit", textDecoration: "none" }} className="navigation-button">SEARCH</Link>
                <Link to="/" className="logo"><div className="logo">cineMatch</div></Link>  
                <Link to="/help" style={{ textDecoration: 'none' }} className="navigation-button">HELP</Link>
                <Link to="/feed" style={{ textDecoration: 'none' }} className="navigation-button active">FEED</Link>
                <Link to="/watchlist" style={{ textDecoration: 'none' }} className="navigation-button">WATCHED LIST</Link>
                <Link to="/to-watch-list" style={{ textDecoration: 'none' }} className="navigation-button">TO-WATCH LIST</Link>
            </div> */}

            <Navigation sidebarCollapsed={false} setSidebarCollapsed={() => {}} />

            <div className="main-container">
                <aside className="sidebar">
                    <ul className="search-filters">
                        <li className="filter-item" key="Limit">
                            <div className="filter-link">
                                <input
                                    id="qLimit"
                                    className="filter-input"
                                    placeholder="LIMIT…"
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={limit}
                                    onChange={(e) => setLimit(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && buildRecommendations()}
                                />
                            </div>
                        </li>
                    </ul>
                    <button className="go-btn" onClick={buildRecommendations}>REBUILD FEED</button>

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
                        {recs.map((r, idx) => {
                            const poster = r.posterPath ? `${TMDB_IMG}${r.posterPath}` : "https://placehold.co/300x450?text=No+Poster";
                            return (
                                <article
                                    className="movie-card"
                                    key={`${r.tmdbId}_${idx}`}
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

            {showDetails && details && (
                <MovieDetails
                    details={details}
                    onClose={() => setShowDetails(false)}
                    isWatched={details.id != null && watchedIds.has(details.id)}
                    inToWatch={false}
                    onMarkWatched={() => {}}
                    onAddToWatch={() => {}}
                />
            )}
        </>
    );
}
