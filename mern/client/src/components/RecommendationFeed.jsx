// src/components/RecommendationFeed.jsx
import React, { useEffect, useMemo, useState } from "react";
import {Link, useNavigate} from "react-router-dom";
import "../App.css";
import MovieDetails from "./MovieDetails";
import { authedFetch, refresh } from "../auth/api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import NotificationModal from "./NotificationModal.jsx";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const DEFAULT_LIMIT = 10;
const CAST_LIMIT = 7 //limit for the cast

export default function RecommendationFeed() {
    const { user, logout } = useAuth();
    const canModifyLists = !!user;
    const [authMenuOpen, setAuthMenuOpen] = useState(false);
    const [notificationMsg, setNotificationMsg] = useState("");
    const navigate = useNavigate();
    async function handleLogoutClick() {
        try {
            navigate("/", { replace: true });
            await logout();
            setNotificationMsg("You have been logged out.");
        } catch (e) {
            console.error("logout failed", e);
            setNotificationMsg(e?.message || "Failed to log out.");
        } finally {
            setAuthMenuOpen(false);
        }
    }

    function closeAuthMenu() {
        setAuthMenuOpen(false);
    }


    // State hooks used for managing the user's "Watched and To watch" list
    const [watched, setWatched] = useState(new Set());
    const [toWatch, setWatchlist] = useState(new Set());
    useEffect(() => {
        localStorage.setItem("watched", JSON.stringify([...watched]));// whenever to-watch or watched lists change store it as json in the cache array
    }, [watched]);
    useEffect(() => {
        localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
    }, [toWatch]);

    // useMemo to efficiently get the watched IDs from local storage once on initial render
    const watchedIds = useMemo(
        () => new Set(Array.from(watched)),
        [watched]
    );

    // State hook for the recommendation limit input
    const [limit, setLimit] = useState(DEFAULT_LIMIT);
    const [recs, setRecs] = useState([]);
    const [status, setStatus] = useState("Loading…");

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // load watched / to-watch lists from the server
    async function loadLists() {
        const res = await authedFetch("/api/me/lists");
        if (res.status === 401) {
            throw new Error("Not authenticated (401). Open /login first.");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = await res.json();

        const w = Array.isArray(raw.watchedIds) ? raw.watchedIds
            : Array.isArray(raw.watched)       ? raw.watched
                : [];
        const t = Array.isArray(raw.toWatchIds)   ? raw.toWatchIds
            : Array.isArray(raw.toWatch)         ? raw.toWatch
                : Array.isArray(raw["to-watch"])     ? raw["to-watch"]
                    : [];

        const watchedIdsArr = w.map(Number);
        const toWatchIdsArr = t.map(Number);

        setWatched(new Set(watchedIdsArr));
        setWatchlist(new Set(toWatchIdsArr));

        return { watchedIds: watchedIdsArr, toWatchIds: toWatchIdsArr };
    }

    // server-side toggle for watched / to-watch
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

        await loadLists();
    }

    // Asynchronous function to open the details modal for a selected recommendation (rec)
    async function openDetails(rec) {
        try {
            const title = rec?.title ?? "";
            const year = rec?.year ? String(rec.year) : "";
            const qs = new URLSearchParams();
            if (title) qs.set("name", title);
            if (year) qs.set("year", year);
            const searchRes = await fetch(`/record?${qs.toString()}`);// Search the backend for a TMDB ID using the movie title and year
            let movieId = null;
            if (searchRes.ok) {
                const hits = await searchRes.json();
                if (Array.isArray(hits) && hits.length && hits[0]?.id != null) { // Check if a result with an ID was found
                    movieId = hits[0].id;
                }
            }

            //  If a TMDB ID was found, fetch full details from the backend
            if (movieId != null) {
                const res = await fetch(`/record/details/${movieId}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setDetails({ id: movieId, ...data }); // Set the details with the fetched data
                setShowDetails(true);
                return;
            }
            // If no TMDB ID was found in the search, display partial information from the recommendation object itself

            setDetails({
                id: null,     // Indicates we couldn't find a full record
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
        if (watchedIds.size === 0) { // Check if the user has watched any movies yet
            setStatus("Your watched list is empty — watch a few movies to seed recommendations.");
            setRecs([]);
            return;
        }
        setStatus("Building your feed…");
        try {
            const body = {// Prepare the request body with watched IDs and the desired limit
                watchedIds: Array.from(watchedIds),
                limit: Math.max(1, Number(limit) || DEFAULT_LIMIT),
            };
            const resp = await fetch("/feed", { // Send a POST request to the /feed endpoint
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

    useEffect(() => { buildRecommendations(); }, [watchedIds, limit]);

    const isWatched = useMemo(
        () => details && details.id != null && watched.has(Number(details.id)),
        [details, watched]
    );   // useMemo to check if the currently viewed movie is in the 'watched' list
    const inToWatch = useMemo(
        () => details && details.id != null && toWatch.has(Number(details.id)),
        [details, toWatch]
    );
    // Function to add/remove a movie from the 'watched' list
    const onMarkWatched = () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        toggleList("watched", id).catch(console.error);
    };
    // Function to add/remove a movie from the 'toWatch' list
    const onAddToWatch = () => {
        if (!details || !canModifyLists) return;
        const id = Number(details.id);
        toggleList("to-watch", id).catch(console.error);
    };

    return (
        <>
            <div className="navigation-top">
                <Link to="/" style={{ color: "inherit", textDecoration: "none" }} className="navigation-button">SEARCH</Link>
                <div className="logo">cineMatch</div>
                <Link to="/help" style={{ textDecoration: "none" }} className="navigation-button">HELP</Link>
                <Link to="/feed" style={{ textDecoration: "none" }} className="navigation-button active">FEED</Link>
                <Link to="/watchlist" style={{ textDecoration: "none" }} className="navigation-button">WATCHED LIST</Link>
                <Link to="/to-watch-list" style={{ textDecoration: "none" }} className="navigation-button">TO-WATCH LIST</Link>
                <div className="nav-auth-dropdown">
                    <button
                        type="button"
                        className="navigation-button nav-auth-toggle"
                        onClick={() => setAuthMenuOpen(open => !open)}
                    >
                        ACCOUNT ▾
                    </button>

                    {authMenuOpen && (
                        <div className="nav-auth-menu">
                            {user ? (
                                <>
                                    <div className="nav-auth-greeting">
                                        Welcome,&nbsp;
                                        {user.displayName || user.email?.split("@")[0] || "friend"}
                                    </div>
                                    <button
                                        type="button"
                                        className="nav-auth-link nav-auth-logout"
                                        onClick={handleLogoutClick}
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="nav-auth-link"
                                        onClick={closeAuthMenu}
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="nav-auth-link"
                                        onClick={closeAuthMenu}
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    )}
                </div>
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

            {showDetails && (
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
                />
            )}
            <NotificationModal message={notificationMsg} onClose={() => setNotificationMsg("")} />
        </>
    );
}