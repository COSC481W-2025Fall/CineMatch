import React, {useState, useEffect, useMemo} from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx"
import ErrorModal from "./components/ErrorModal.jsx";

import { Link } from "react-router-dom";

const API_BASE = ""; // set your API base here

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

  const [toWatch, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("to-watch") || "[]")));


  useEffect(() => { localStorage.setItem("watched", JSON.stringify([...watched])); }, [watched]);
  useEffect(() => { localStorage.setItem("to-watch", JSON.stringify([...toWatch])); }, [toWatch]);

  const [details, setDetails] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  async function openDetails(movie) {
    try {
      const res = await fetch(`/record/details/${movie.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetails({ id: movie.id, ...data });  // <-- keep id
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

  // Creates error state message
  const [errorMsg, setErrorMsg] = useState("");

  // State for search parameters
  const [params, setParams] = useState({
    actor: "",
    director: "",
    genre: "",
    title: "",
    year_min: "", // implemented year_min and year_max instead of searching by
    year_max: "", // only one year
    rating_min: "", // implemented rating_min and rating_max instead of one rating 
    rating_max: ""
  });
  // State to store the list of movies returned from the API
  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState("Loading…");

  const [genreDropdownOpen, setGenreDropdownOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);


  function toggleDropdown() {
    if (genreDropdownOpen) {
      setGenreDropdownOpen(false);
    } else {
      setGenreDropdownOpen(true);
    }
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
    if (genreDropdownOpen) {
      return "dropdown-arrow open";
    } else {
      return "dropdown-arrow";
    }
  }

  function isGenreChecked(genre) {
    if (selectedGenres.includes(genre)) {
      return true;
    } else {
      return false;
    }
  }



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
    const res = await fetch(API_BASE + buildQuery(p));
    let payload;
    try { payload = await res.json(); } catch {}
    // Error handling if HTTP status not working 
    if (!res.ok) {
      const msg = payload?.error || `Error loading results (HTTP ${res.status}).`;
      throw new Error(msg);
    }
    return payload;
  }

  async function doSearch() {
  setStatus("Loading…");
    try {
      const data = await fetchMovies({ ...params });
      setMovies(data);
      setStatus(data.length ? "" : "No results found.");
    } catch (err) {
      console.error(err);
      setStatus("");
      setErrorMsg(err.message);  // Opens the error modal 
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
          <button className="navigation-button" >FEED</button>  {/* Only this goes nowhere right now */}
          <button className="navigation-button"><Link to="/watchlist" style={{ color: "inherit", textDecoration: "none" }}>WATCHED LIST</Link></button>
          <button className="navigation-button"><Link to="/to-watch-list" style={{ color: "inherit", textDecoration: "none" }}>TO-WATCH LIST</Link></button>

        </div>

        <div className="main-container">
          <aside className="sidebar">
            {/*  Simple text boxes that we will take as input  */}
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
            {/* === YEAR RANGE SECTION ===
            Displays a small label ("SEARCH BY YEAR") and two red pill inputs
            side by side — one for the minimum year, one for the maximum year.
            Each input behaves like the other search fields and updates state
            through handleChange(). */}
            <li className="year-range" key="YearRange">

              {/* Section label above both bubbles */}
              <div className="year-label">YEAR</div>

              {/* Container for the two pill-style year inputs */}
              <div className="year-bubbles">

                {/* ---- Minimum Year bubble ---- */}
                <div className="filter-item">
                  <div className="filter-link">
                    <input
                      id="qYear_Min"                     // maps to params.year_min
                      className="filter-input"           // reuses shared input styling
                      type="number"                
                      placeholder="MIN"                  // short placeholder text
                      value={params.year_min}            
                      onChange={handleChange}            // updates params when typed
                      onKeyDown={(e) => e.key === "Enter" && doSearch()} // triggers search on Enter
                    />
                  </div>
                </div>

                {/* ---- Maximum Year bubble ---- */}
                <div className="filter-item">
                  <div className="filter-link">
                    <input
                      id="qYear_Max"             // maps to params.year_max
                      className="filter-input"  // reuse styling
                      type="number"
                      placeholder="MAX"         // placeholder text
                      value={params.year_max}
                      onChange={handleChange}   // updates when typed
                      onKeyDown={(e) => e.key === "Enter" && doSearch()} // triggers search after hitting enter
                    />
                  </div>
                </div>

              </div>
            </li>

            {/* === RATING RANGE SECTION ===
                Two bubble inputs side-by-side for rating min and max (0–5).
                Works the same as the year. */}
            <li className="rating-range" key="RatingRange">
              <div className="rating-label">RATING (0–5)</div>

              <div className="rating-bubbles">
                {/* ---- Minimum Rating bubble ---- */}
                <div className="filter-item">
                  <div className="filter-link">
                    <input
                      id="qRating_Min"              // maps to params.rating_min
                      className="filter-input"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="MIN"
                      value={params.rating_min}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    />
                  </div>
                </div>

                {/* ---- Maximum Rating bubble ---- */}
                <div className="filter-item">
                  <div className="filter-link">
                    <input
                      id="qRating_Max"              // maps to params.rating_max
                      className="filter-input"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="5"
                      placeholder="MAX"
                      value={params.rating_max}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && doSearch()}
                    />
                  </div>
                </div>
              </div>
            </li>


              {/*Genre dropdown with checkboxes for multiple selection */}
              <li className="filter-item genre-dropdown" key="Genre">
                <div
                    className="filter-link genre-header"
                    onClick={toggleDropdown} // When clicked this opens or closes the dropdown
                >
                  <span className="genre-label">  {/* Calls the function to display either GENRE or shows how many genres where selected  */}
                    {getGenreLabel()}
                  </span>
                  <span className={getDropdownArrowClass()}>▼</span> {/* Displays dropdown arrow from getDropDownArrowClass */}
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
          <ErrorModal
            message={errorMsg}
            onClose={() => setErrorMsg("")}
          />
        </div>
      </>
  );
}

export default App;
