import React, {useState, useEffect, useMemo} from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx"
import { findTmdbIdByTitleYear } from "./components/converter";

import { Link } from "react-router-dom";

const API_BASE = ""; // Your backend API

// get TMDB key from .env file
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
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
  "Western"
]

function App() {

  const [watched, setWatched] = useState(() => new Set(JSON.parse(localStorage.getItem("watched") || "[]")));
  //const [watchlist, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("watchlist") || "[]")));

  const [toWatch, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("toWatch") || "[]")));


  useEffect(() => { localStorage.setItem("watched", JSON.stringify([...watched])); }, [watched]);
  useEffect(() => { localStorage.setItem("to-watch", JSON.stringify([...toWatch])); }, [toWatch]);

  const [details, setDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
// App.jsx
    async function openDetails(movie)
    {
        try {
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // grab title and year from database
            let titleForLookup = "";
            if (data && typeof data.title === "string" && data.title.length > 0)
            {
                titleForLookup = data.title;
            }
            else
            {
                titleForLookup = movie.title;
            }

            let yearForLookup;
            if (data && typeof data.year === "number")
            {
                yearForLookup = data.year;
            }
            else
            {
                yearForLookup = movie.year;
            }

            // give converter title and year
            const tmdbId = await findTmdbIdByTitleYear(titleForLookup, yearForLookup, { language: "en-US" }); // change to any if having issues with forign movies (forign movies might have different release date based on language if 2 versions exist)
            console.log("[TMDB TEST] input:", { titleForLookup, yearForLookup }, "=> tmdbId:", tmdbId);

            let patch = {}; // empty

            // if found then pull actors and runtime from api
            if (tmdbId !== null && tmdbId !== undefined)
            {
                const numOfActors = 7;
                const url = new URL("https://api.themoviedb.org/3/movie/" + tmdbId);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                url.searchParams.set("append_to_response", "credits"); // include cast list

                const tmdbRes = await fetch(url.toString(), { headers: { accept: "application/json" } });
                if (tmdbRes.ok)
                {
                    const tmdb = await tmdbRes.json();

                    // get cast (actors) from tmdb.credits.cast
                    // tmdbCast will be empty if invalid
                    let tmdbCast = [];
                    if (tmdb && tmdb.credits && tmdb.credits.cast && Array.isArray(tmdb.credits.cast))
                    {
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
                    for (let i = 0; i < topActors.length; i++)
                    {
                        const person = topActors[i];
                        if (person && typeof person.name === "string" && person.name.length > 0)
                        {
                            topCast.push(person.name);
                        }
                    }

                    // read runtime in min if it exists and is a number otherwise leave it as null
                    let runtime = null;
                    if (tmdb && typeof tmdb.runtime === "number")
                    {
                        runtime = tmdb.runtime;
                    }

                    // fill patch objects
                    patch.tmdbId = tmdbId; // keep for debugging or other uses
                    if (topCast.length > 0)
                    {
                        patch.topCast = topCast; // override DB actors with top billed tmdb list
                    }
                    if (runtime !== null)
                    {
                        patch.runtime = runtime; // add runtime (minutes) - convert this to hr/min on frontend
                    }

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime);
                }
            }

            setDetails({ id: movie.id, ...data, ...patch });
            setShowDetails(true);
        } catch (e) {
            console.error(e);
        }
    }


  /*function markWatched(movie) {
    setWatched(prev => {
      const next = new Set(prev);
      next.add(movie.id);
      return next;
    });
  }

  function addToWatchlist(movie) {
    setWatchlist(prev => {
      const next = new Set(prev);
      next.add(movie.id);
      return next;
    });
  }*/




  // State for search parameters
  const [params, setParams] = useState({
    actor: "",
    director: "",
    genre: "",
    title: "",
    year: "",
    rating: ""
  });
  // State to store the list of movies returned from the API
  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState("Loading…");
  // Build the query string for the API request based on filled parameters
  function buildQuery(p) {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => { if (v) qs.append(k, v); });
    // this would allow the spaces to work, basically replacing empty with the %20, which is identified by browsers to be a space
    const fullSearch = qs.toString().replace(/\+/g, '%20');
    return fullSearch ? `/record?${qs.toString()}` : "/record";
  }
  // Fetch movies from the backend API
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
      setMovies(data);
      setStatus(data.length ? "" : "No results found.");
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
    setParams((prev) => ({
      ...prev,
      // map input id to state key by stripping 'q' prefix and lowercasing
      [id.replace("q", "").toLowerCase()]: value // to fix the spaces in the string
    }));
  }


  const isWatched = useMemo(() => details && watched.has(details.id), [details, watched]);
  const inToWatch = useMemo(() => details && toWatch.has(details.id), [details, toWatch]);

  const onMarkWatched = () => {
    if (!details) return;
    if (watched.has(details.id)) return;
    setWatched(prev => new Set(prev).add(details.id));
  };
  const onAddToWatch = () => {
    if (!details) return;
    if (toWatch.has(details.id)) return;
    setWatchlist(prev => new Set(prev).add(details.id));
  };

  return (
      <>
        <div className="navigation-top">
          <button className="navigation-button active" onClick={doSearch}>{/*
  <button class="navigation-button active" id="searchTop">SEARCH</button> <!-- Temporary till we add in Feed and Watch List, for now this just does the same as search */}
            SEARCH
          </button>
          <div className="logo">cineMatch</div>
          <button className="navigation-button">FEED</button>   {/* They both go nowhere rightnow */}
          <button className="navigation-button">WATCH LIST</button>

        </div>

        <div className="main-container">
          <aside className="sidebar">
            {/*  Simple text boxes that we will take as input  */}
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

              {/*Genre dropdown selection that will handle the state and changes of the genre filter by looping through an
            array of the 19 genres listed above */}
              <li className="filter-item" key="Genre">
                <div className="filter-link">
                  <select id="qGenre"
                          className="filter-select"
                          value={params.genre || ""}
                          onChange={handleChange}>
                    <option value="">GENRE...</option>
                    {GENRES.map((genre) => (
                        <option key={genre} value={genre}> {genre}
                        </option>
                    ))}
                  </select>
                </div>
              </li>
            </ul>

            <button className="go-btn" onClick={doSearch}>SEARCH</button>  {/* The button to actually search, this one is permanent */}

            <footer className="sidebar-footer-credit">
              <p>
                Source of data:{" "}
                <a href="https://www.themoviedb.org/">{/* We need this to abide by the TOS  */}
                  TMDB{" "}
                  <img
                      src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                      style={{ height: "10px", width: "auto", verticalAlign: "middle", marginLeft: "6px" }}
                      alt="TMDB logo"
                  />
                </a>
              </p>
              <p>
                This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
              </p>
            </footer>
          </aside>

          <main className="content-area">
            <div id="status" className="muted">{status}</div>
            <div id="results" className="movie-grid">
              {movies.map((m, idx) => (
                  <article className="movie-card" key={idx} onClick={() => openDetails(m)} style={{cursor: "pointer"}}>
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
          {showDetails && (
              <MovieDetails
                  details={details}
                  onClose={() => setShowDetails(false)}
                  isWatched={!!isWatched}
                  inToWatch={!!inToWatch}
                  onMarkWatched={onMarkWatched}
                  onAddToWatch={onAddToWatch}
              />
          )}
        </div>
      </>
  );
}

export default App;
