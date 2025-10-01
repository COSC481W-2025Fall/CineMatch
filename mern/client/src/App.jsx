import React, { useState, useEffect } from "react";
import "./App.css";

const API_BASE = ""; // set your API base here

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
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
                  <article className="movie-card" key={idx}>
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
      </>
  );
}

export default App;