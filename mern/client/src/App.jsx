// App.jsx
import React, { useState, useEffect, useMemo } from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx";
import ErrorModal from "./components/ErrorModal.jsx";
import { findTmdbIdByTitleYear } from "./components/converter";
import { Link } from "react-router-dom";
import {
  getLikedTmdbIds,
  getDislikedTmdbIds,
} from "./components/likeDislikeStorage";

const API_BASE = "";

// get TMDB key from .env file
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// for exporting
const CAST_LIMIT = 7;

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

function App() {
  const [watched, setWatched] = useState(() =>
    loadSetFromStorage("watched")
  );
  const [toWatch, setWatchlist] = useState(() =>
    loadSetFromStorage("to-watch")
  );

  // liked/disliked arrays  (read-only) 
  const [likedTmdbIds, setLikedTmdbIds] = useState(() => getLikedTmdbIds());
  const [dislikedTmdbIds, setDislikedTmdbIds] = useState(() => getDislikedTmdbIds());

  // record id - TMDB id map 
  const [recordTmdbMap, setRecordTmdbMap] = useState(() =>
    loadMapFromStorage("recordTmdbMap")
  );

  // error modal message
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    localStorage.setItem("watched", JSON.stringify([...watched]));
  }, [watched]);

  useEffect(() => {
    localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
  }, [toWatch]);

  useEffect(() => {
    localStorage.setItem("recordTmdbMap", JSON.stringify(recordTmdbMap));
  }, [recordTmdbMap]);

  const [details, setDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  async function openDetails(movie) {
    try {
      const res = await fetch(`/record/details/${movie.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // grab title and year from database or fallback
      let titleForLookup = "";
      if (data && typeof data.title === "string" && data.title.length > 0) {
        titleForLookup = data.title;
      } else {
        titleForLookup = movie.title;
      }

      let yearForLookup;
      if (data && typeof data.year === "number") {
        yearForLookup = data.year;
      } else {
        yearForLookup = movie.year;
      }

      // give converter title and year
      const tmdbId = await findTmdbIdByTitleYear(
        titleForLookup,
        yearForLookup,
        { language: "en-US" }
      );
      console.log(
        "[TMDB TEST] input:",
        { titleForLookup, yearForLookup },
        "=> tmdbId:",
        tmdbId
      );

      let patch = {};

      // if found then pull actors and runtime from api
      if (tmdbId !== null && tmdbId !== undefined) {
        const numOfActors = CAST_LIMIT;
        const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
        url.searchParams.set("api_key", TMDB_API_KEY);
        url.searchParams.set("append_to_response", "credits"); // include cast list

        const tmdbRes = await fetch(url.toString(), {
          headers: { accept: "application/json" },
        });
        if (tmdbRes.ok) {
          const tmdb = await tmdbRes.json();

          // get cast (actors) from tmdb.credits.cast
          let tmdbCast = [];
          if (
            tmdb &&
            tmdb.credits &&
            tmdb.credits.cast &&
            Array.isArray(tmdb.credits.cast)
          ) {
            tmdbCast = tmdb.credits.cast;
          }

          // sort cast by "order"
          tmdbCast.sort(function (a, b) {
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
            if (
              person &&
              typeof person.name === "string" &&
              person.name.length > 0
            ) {
              topCast.push(person.name);
            }
          }

          // read runtime in min if it exists and is a number otherwise leave it as null
          let runtime = null;
          if (tmdb && typeof tmdb.runtime === "number") {
            runtime = tmdb.runtime;
          }

          let description = null;
          if (
            tmdb &&
            typeof tmdb.overview === "string" &&
            tmdb.overview.trim().length > 0
          ) {
            description = tmdb.overview.trim();
          }

          // fill patch objects
          patch.tmdbId = tmdbId; // keep for debugging or other uses
          if (topCast.length > 0) {
            patch.topCast = topCast; // override DB actors with top billed tmdb list
          }
          if (runtime !== null) {
            patch.runtime = runtime; // add runtime (minutes)
          }
          if (description !== null) {
            patch.description = description;
          }

          console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime);
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

  // State for search parameters
  const [params, setParams] = useState({
    actor: "",
    director: "",
    genre: "",
    title: "",
    year_min: "",
    year_max: "",
    rating_min: "",
    rating_max: "",
  });

  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState("Loading…");

  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);

  function toggleDropdown() {
    setGenreDropdownOpen((prev) => !prev);
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

  // Build the query string for the API request based on filled parameters
  function buildQuery(p) {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0))
        return;
      if (Array.isArray(v)) {
        v.forEach((val) => qs.append(k, val));
      } else {
        qs.append(k, v);
      }
    });
    const queryString = qs.toString().replace(/\+/g, "%20");
    return queryString ? `/record?${queryString}` : "/record";
  }

  // Fetch movies from the backend API
  async function fetchMovies(p = {}) {
    const res = await fetch(API_BASE + buildQuery(p));
    let payload;
    try {
      payload = await res.json();
    } catch {
      /* empty */
    }
    if (!res.ok) {
      const msg =
        payload?.error || `Error loading results (HTTP ${res.status}).`;
      throw new Error(msg);
    }
    return payload;
  }

  async function doSearch() {
    setStatus("Loading…");
    try {
      const query = {
        ...params,
        ...(selectedGenres.length ? { genre: selectedGenres } : {}),
      };

      const data = await fetchMovies(query);

      // Attach tmdbId from our persisted map, if we know it
      const withTmdb = data.map((m) => {
        const mapped = recordTmdbMap[m.id];
        if (mapped && m.tmdbId == null) {
          return { ...m, tmdbId: mapped };
        }
        return m;
      });

      setMovies(withTmdb);
      setStatus(withTmdb.length ? "" : "No results found.");
    } catch (err) {
      console.error(err);
      setStatus("");
      setErrorMsg(err.message);
    }
  }

  useEffect(() => {
    doSearch();
    // eslint-disable-next-line
  }, []);

  function handleChange(e) {
    const { id, value } = e.target;
    const raw = id.startsWith("q") ? id.slice(1) : id;
    const key = raw.toLowerCase();
    setParams((prev) => ({
      ...prev,
      [key]: value,
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

  // liked / disliked for the current details movie (read-only in Search)
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

  // Mark watched / unwatched from Search 
  const onMarkWatched = () => {
    if (!details) return;

    const id = Number(details.id);
    const tmdbId = details.tmdbId != null ? Number(details.tmdbId) : null;
    const wasWatched = watched.has(id);

    // Toggle watched
    setWatched((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

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

  return (
    <>
      <div className="navigation-top">
        <Link
          to="/"
          style={{ color: "inherit", textDecoration: "none" }}
          className="navigation-button active"
        >
          SEARCH
        </Link>
        <div className="logo">cineMatch</div>
        <Link
          to="/help"
          style={{ textDecoration: "none" }}
          className="navigation-button"
        >
          HELP
        </Link>
        <Link
          to="/feed"
          style={{ textDecoration: "none" }}
          className="navigation-button"
        >
          FEED
        </Link>
        <Link
          to="/watchlist"
          style={{ textDecoration: "none" }}
          className="navigation-button"
        >
          WATCHED LIST
        </Link>
        <Link
          to="/to-watch-list"
          style={{ textDecoration: "none" }}
          className="navigation-button"
        >
          TO-WATCH LIST
        </Link>
      </div>

      <div className="main-container">
        <aside className="sidebar">
          <ul className="search-filters">
            {["Actor", "Director", "Title"].map((label) => (
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

            {/* Genre dropdown with checkboxes */}
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
                    <label
                      key={genre}
                      className="genre-checkbox-item"
                    >
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
          </ul>

          <button className="go-btn" onClick={doSearch}>
            SEARCH
          </button>

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

              const likedFlag =
                tmdbIdNum != null && likedTmdbIds.includes(tmdbIdNum);
              const dislikedFlag =
                tmdbIdNum != null &&
                dislikedTmdbIds.includes(tmdbIdNum);

              return (
                <article
                  className="movie-card"
                  key={idx}
                  onClick={() => openDetails(m)}
                  style={{
                    cursor: "pointer",
                    position: "relative",
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
                          ? "rgba(0, 128, 0, 0.85)"
                          : "rgba(180, 0, 0, 0.85)",
                        color: "#fff",
                      }}
                    >
                      {likedFlag ? "👍" : "👎"}
                    </div>
                  )}

                  <img
                    src={
                      m.posterUrl ||
                      "https://placehold.co/300x450?text=No+Poster"
                    }
                    alt={m.title || ""}
                  />
                  <div className="movie-title">
                    {m.title ?? "Untitled"}
                  </div>
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

        {showDetails && details && (
          <MovieDetails
            details={details}
            onClose={() => setShowDetails(false)}
            isWatched={!!isWatched}
            inToWatch={!!inToWatch}
            onMarkWatched={onMarkWatched}
            onAddToWatch={onAddToWatch}
            // Read-only like/dislike state (no editing here)
            isLiked={!!isLiked}
            isDisliked={!!isDisliked}
            // likesEditable omitted - MovieDetails should hide Like/Dislike buttons
          />
        )}

        <ErrorModal
          message={errorMsg}
          onClose={() => setErrorMsg("")}
        />
      </div>
    </>
  );
}

export default App;
