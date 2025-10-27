import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { findTmdbIdByTitleYear } from "./converter";


const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";


const DEFAULT_LIMIT = 10;

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
            const title = rec?.title ?? rec?.name ?? "";
            const year = (rec?.release_date || "").slice(0, 4) || "";

            const qs = new URLSearchParams();
            if (title) qs.set("name", title);
            if (year) qs.set("year", year);

            const searchRes = await fetch(`/record?${qs.toString()}`);
            let movieId = null;
            if (searchRes.ok) {
                const hits = await searchRes.json();
                if (Array.isArray(hits) && hits.length > 0 && hits[0]?.id != null) {
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
                year: year ? Number(year) : null,
                rating: typeof rec.vote_average === "number" ? rec.vote_average.toFixed(1) : null,
                posterUrl: rec?.poster_path ? `${TMDB_IMG}${rec.poster_path}` : null,
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
        if (!TMDB_API_KEY) {
            setStatus("Missing TMDB API key.");
            setRecs([]);
            return;
        }
        if (watchedIds.size === 0) {
            setStatus("Your watched list is empty — watch a few movies to seed recommendations.");
            setRecs([]);
            return;
        }

        setStatus("Building your feed…");


        const agg = new Map();

        const exclude = new Set();

        try {

            for (const dbId of watchedIds) {

                const dres = await fetch(`/record/details/${dbId}`);
                if (!dres.ok) {
                    console.warn("Feed: failed details for", dbId);
                    continue;
                }
                const movie = await dres.json();
                if (!movie?.title || movie?.year == null) continue;


                const tmdbId = await findTmdbIdByTitleYear(movie.title, movie.year);
                if (!tmdbId) continue;
                exclude.add(tmdbId);


                const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/recommendations`);
                url.searchParams.set("api_key", TMDB_API_KEY);
                const rres = await fetch(url.toString(), { headers: { accept: "application/json" } });
                if (!rres.ok) continue;
                const rjson = await rres.json();
                const results = Array.isArray(rjson?.results) ? rjson.results : [];

                for (const rec of results) {
                    if (!rec || typeof rec.id !== "number") continue;
                    const key = rec.id;
                    const rating = typeof rec.vote_average === "number" ? rec.vote_average : 0;
                    if (agg.has(key)) {
                        const entry = agg.get(key);
                        entry.count += 1;
                        if (rating > entry.rating) entry.rating = rating;
                    } else {
                        agg.set(key, {
                            id: key,
                            count: 1,
                            rating,
                            sample: rec,
                        });
                    }
                }
            }


            const sorted = Array.from(agg.values())
                .filter(x => !exclude.has(x.id))
                .sort((a, b) => {
                    if (a.count !== b.count) return b.count - a.count;
                    return b.rating - a.rating;
                })
                .slice(0, Math.max(1, Number(limit) || DEFAULT_LIMIT))
                .map(x => x.sample);

            setRecs(sorted);
            setStatus(sorted.length ? "" : "No recommendations yet. Try watching a few more movies.");
        } catch (e) {
            console.error("Feed error:", e);
            setStatus("Error building your feed.");
            setRecs([]);
        }
    }

    useEffect(() => {
        buildRecommendations();
    }, []);

    return (
        <>
            <div className="navigation-top">
                <button className="navigation-button">
                    <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
                        SEARCH
                    </Link>
                </button>
                <div className="logo">cineMatch</div>
                <button className="navigation-button active">FEED</button>
                <button className="navigation-button">
                    <Link to="/watchlist" style={{ color: "inherit", textDecoration: "none" }}>
                        WATCHED LIST
                    </Link>
                </button>
                <button className="navigation-button">
                    <Link to="/to-watch-list" style={{ color: "inherit", textDecoration: "none" }}>
                        TO-WATCH LIST
                    </Link>
                </button>
            </div>

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
                            const title = r?.title ?? r?.name ?? "Untitled";
                            const year = (r?.release_date || "").slice(0, 4) || "—";
                            const rating = typeof r?.vote_average === "number" ? r.vote_average.toFixed(1) : null;
                            const poster = r?.poster_path ? `${TMDB_IMG}${r.poster_path}` : "https://placehold.co/300x450?text=No+Poster";
                            return (
                                <article
                                    className="movie-card"
                                    key={`${r.id}_${idx}`}
                                    onClick={() => openDetails(r)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <img src={poster} alt={title} />
                                    <div className="movie-title">{title}</div>
                                    <div className="movie-sub">
                                        {year} • {rating ? `⭐ ${rating}` : "—"}
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
