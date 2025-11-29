// App.jsx
import React, {useState, useEffect, useMemo} from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx"
import ErrorModal from "./components/ErrorModal.jsx";

import { Link } from "react-router-dom";

const API_BASE = "";

// get TMDB key from .env file
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// for exporting
const CAST_LIMIT = 7

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
// utilities (top of file)
function shuffleArray(array) {
  const arr = [...array];  //<-- makes a shallow copy of the original array
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));    // picks a random index from 0 to n inclusively
    [arr[i], arr[j]] = [arr[j], arr[i]];   //swaps elemes
  }
  return arr;
}

    // Renders clickable chips for the active filters
    function ActiveFilterBar({ params, selectedGenres, visible, onRemove }) {
    if (!visible) return null; // don't show chips until a search has run

    const chips = [];
    // helper: push a chip into the list (idx helps remove the exact genre chip)
    const push = (key, value, text, idx = null) => chips.push({ key, value, text, idx });

    // Actor(s) — split comma list into one chip per actor
    if (params.actor?.trim()) {
        params.actor
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(name => push("actor", name, `Actor: ${name}`));
    }

        // Director — single chip only (no comma support)
    if (params.director?.trim()) {
    const d = params.director.trim();
    push("director", d, `Director: ${d}`); // <-- keep value so the X knows what to remove
    }

    // Title — single chip
    if (params.title?.trim()) push("title", null, `Title: ${params.title.trim()}`);

    // Year range — make chips if set
    if (params.year_min?.trim()) push("year_min", null, `Year ≥ ${params.year_min}`);
    if (params.year_max?.trim()) push("year_max", null, `Year ≤ ${params.year_max}`);

    // Rating range — make chips if set
    if (params.rating_min?.trim()) push("rating_min", null, `Rating ≥ ${params.rating_min}`);
    if (params.rating_max?.trim()) push("rating_max", null, `Rating ≤ ${params.rating_max}`);

    // Genres — one chip per selected genre (carry index so we can remove the exact one)
    (selectedGenres || []).forEach((g, i) => push("genre", g, `Genre: ${g}`, i));

    if (!chips.length) return null; // nothing to show

    return (
        <div className="active-filters">
        {chips.map((c, i) => (
            <button
            // key uses idx so duplicate genres are uniquely removable
            key={`${c.key}-${c.value ?? i}-${c.idx ?? "x"}`}
            className="chip"
            onClick={() => onRemove(c)}          // clicking chip calls parent to remove
            aria-label={`Remove ${c.text}`}      // a11y label for screen readers
            type="button"
            >
            <span className="chip-text">{c.text}</span>
            <span className="chip-x" aria-hidden>×</span> {/* the little X */}
            </button>
        ))}
        </div>
    );
    }


function App() {

    const [watched, setWatched] = useState(() => new Set(JSON.parse(localStorage.getItem("watched") || "[]")));
    //const [watchlist, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("watchlist") || "[]")));

    const [toWatch, setWatchlist] = useState(() => new Set(JSON.parse(localStorage.getItem("to-watch") || "[]")));

    // Creates error state message
    const [errorMsg, setErrorMsg] = useState("");

    
    useEffect(() => {
        localStorage.setItem("watched", JSON.stringify([...watched]));
    }, [watched]);
    useEffect(() => {
        localStorage.setItem("to-watch", JSON.stringify([...toWatch]));
    }, [toWatch]);

    // sidebar functionality
    useEffect(() => {
    const toggleButton = document.getElementById("sidebarToggle");
    const mainContainer = document.querySelector(".main-container");

    if (!toggleButton || !mainContainer) return;

    const toggleSidebar = () => {
        mainContainer.classList.toggle("sidebar-collapsed");
    };

    toggleButton.addEventListener("click", toggleSidebar);
    return () => toggleButton.removeEventListener("click", toggleSidebar);
    }, []);





    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // modified to use TMDB ID directly
    async function openDetails(movie) {
        try {
            const res = await fetch(`/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // replace whole conversion call and check with this
            const tmdbId = movie.id;
            console.log("[TMDB] Using ID:", tmdbId);

            let patch = {}; // empty

            // if found then pull actors, runtime, and watch providers
            if (tmdbId !== null && tmdbId !== undefined) {
                const numOfActors = CAST_LIMIT;
                const url = new URL("https://api.themoviedb.org/3/movie/" + tmdbId);
                url.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);

                url.searchParams.set("append_to_response", "credits,watch/providers"); // add where to watch to the append

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

                    // get where to watch
                    let watchProviders = [];

                    // use US by default, not important for other areas rn since it changes by location
                    if (tmdb && tmdb["watch/providers"] && tmdb["watch/providers"].results && tmdb["watch/providers"].results.US && tmdb["watch/providers"].results.US.flatrate) {
                        watchProviders = tmdb["watch/providers"].results.US.flatrate;
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
                    }

                    console.log("[TMDB TEST] topCast:", topCast, "runtime:", runtime, "providers:", watchProviders.length);
                }
            }

            setDetails({id: movie.id, ...data, ...patch});
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

    // Frozen copies of the last submitted filters (chips read from these)
    const [appliedParams, setAppliedParams] = useState(params);
    const [appliedGenres, setAppliedGenres] = useState(selectedGenres);
    const [hasSearched, setHasSearched] = useState(false);

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
            const qs = new URLSearchParams(); // Holds key and value pairs
            // Add each non-empty parameter to the query string
            Object.entries(p).forEach(([k, v]) => {
                if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
                if (Array.isArray(v)) {
                    v.forEach(val => qs.append(k, val));
                } else {
                    qs.append(k, v);
                }
            });
            const fullSearch = qs.toString().replace(/\+/g, "%20");
            return fullSearch ? `/record?${qs.toString()}` : "/record";
        }

        // Fetch movies from the backend API
        async function fetchMovies(p = {}) {
            const res = await fetch(API_BASE + buildQuery(p));
            let payload;
            try { payload = await res.json(); } catch { /* empty */ }
            // Error handling if HTTP status not working 
            if (!res.ok) {
                const msg = payload?.error || `Error loading results (HTTP ${res.status}).`;
                throw new Error(msg);
            }
            return payload;
        }


async function doSearch() {
    setStatus("Loading…");   //shows the loading state (UI)
    try {
        const query = {
            ...params,      //builds the query object from params 
            ...(selectedGenres.length ? { genre: selectedGenres } : {})
        };

        const data = await fetchMovies(query);      // fetch the resluts from the  backend u
        //checks all the params in the search filters for empty
        const noSearch =
            (!params.actor || !params.actor.trim()) &&
            (!params.director || !params.director.trim()) &&
            (!params.title || !params.title.trim()) &&
            !selectedGenres.length &&
            !params.year_min &&
            !params.year_max &&
            !params.rating_min &&
            !params.rating_max;

        setMovies(noSearch ? shuffleArray(data) : data); //if no parmas shuuffle else use the filer params

        setStatus(data.length ? "" : "No results found.");
    } catch (err) {
        console.error(err);
        setStatus("");
        setErrorMsg(err.message);
    }
}



        // helper: union (case-insensitive) of two comma lists
        function mergeCommaLists(prev = "", curr = "") {
        // turn "a, b, c" into ["a","b","c"] and clean spaces
        const toList = (s) =>
            (s || "")
            .split(",")
            .map(x => x.trim())
            .filter(Boolean);

        const prevList = toList(prev);  // what we already had applied
        const currList = toList(curr);  // what the user just typed

        // build union (case-insensitive unique)
        const seen = new Set(prevList.map(x => x.toLowerCase())); // remember lowercased items
        const merged = [...prevList];                              // start with old list
        for (const x of currList) {                                // go through new values
            const low = x.toLowerCase();
            if (!seen.has(low)) {                                    // only add if not already there
            seen.add(low);
            merged.push(x);
            }
        }
        return merged.join(", ");                                   // return as "a, b, c"
        }

            async function doSearch(overrideQuery, opts = {}) {
        // sometimes onClick passes the click event as the first arg
        // if that happens, ignore it so we don't treat it like overrides
        if (
            overrideQuery &&
            typeof overrideQuery === "object" &&
            ("nativeEvent" in overrideQuery || "target" in overrideQuery || "preventDefault" in overrideQuery)
        ) {
            overrideQuery = undefined; 
        }

        // Inline helper: same idea as above
        const mergeCommaLists = (prev = "", curr = "") => {
            const toList = (s) =>
            (s || "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
            const prevList = toList(prev);
            const currList = toList(curr);
            const seen = new Set(prevList.map((x) => x.toLowerCase()));
            const merged = [...prevList];
            for (const x of currList) {
            const low = x.toLowerCase();
            if (!seen.has(low)) {
                seen.add(low);
                merged.push(x);
            }
            }
            return merged.join(", ");
        };

        setStatus("Loading…"); // show loading message while we fetch
        try {
            // start from current inputs unless we received an override (chip removal, etc.)
            let nextParams = overrideQuery ? { ...params, ...overrideQuery } : { ...params };

            // GENRES handling:
            // - if override has "genre": use that 
            // - if override exists but no "genre": keep applied genres
            // - if no override: use the live checkbox selection
            let nextGenres = overrideQuery
            ? (Object.prototype.hasOwnProperty.call(overrideQuery, "genre")
                ? [...(overrideQuery.genre || [])]
                : [...appliedGenres])
            : [...selectedGenres];

            // ACTORS handling:
            // - merge previously applied actors with what's typed ONLY for normal searches
            // - skip merge when removal came from a chip (so last actor stays gone)
            const skipActorMerge = opts.fromChip === true;
            if (!skipActorMerge && hasSearched) {
            nextParams.actor = mergeCommaLists(appliedParams.actor, nextParams.actor);
            }

            // clean actor string (remove extra spaces/commas)
            if (typeof nextParams.actor === "string") {
            nextParams.actor = nextParams.actor
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .join(", ");
            }

            // final query object (only include genre if we have at least one)
            const query = {
            ...nextParams,
            ...(nextGenres.length ? { genre: nextGenres } : {})
            };

            // ask backend for results
            const data = await fetchMovies(query);

            // update UI
            setMovies(data);
            setStatus(data.length ? "" : "No results found.");

            // freeze what we actually searched (chips use these so they don't change while typing)
            setAppliedParams(nextParams);
            setAppliedGenres(nextGenres);
            setHasSearched(true); // after first success, we show the chips
        } catch (err) {
            console.error(err);
            setStatus("");            // stop showing "Loading…"
            setErrorMsg(err.message); // open error modal
        }
        }

        function handleRemoveChip(chip) {
        // start from the applied filters, this matches what's on screen
        const baseParams = { ...appliedParams };
        let baseGenres = [...appliedGenres];

        

        // remove one item from a comma list (case-insensitive)
        const removeFromCommaList = (raw, valueToRemove) =>
            (raw || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => s.toLowerCase() !== (valueToRemove || "").toLowerCase())
            .join(", ");

        // clear the right thing based on which chip was clicked
        switch (chip.key) {
            case "actor":
            baseParams.actor = removeFromCommaList(baseParams.actor, chip.value); // drop one actor
            break;
            case "director":
            baseParams.director = ""; // single-value field, just clear it           
            case "title":
            baseParams.title = ""; // clear title
            break;
            case "year_min":
            baseParams.year_min = ""; // clear min year
            break;
            case "year_max":
            baseParams.year_max = ""; // clear max year
            break;
            case "rating_min":
            baseParams.rating_min = ""; // clear min rating
            break;
            case "rating_max":
            baseParams.rating_max = ""; // clear max rating
            break;
            case "genre":
            // remove by index if provided 
            if (typeof chip.idx === "number") {
                baseGenres = baseGenres.filter((_, i) => i !== chip.idx);
            } else {
                baseGenres = baseGenres.filter(g => g !== chip.value);
            }
            break;
            default:
            break;
        }

        // keep sidebar inputs/checkboxes same with what we removed
        setParams(prev => ({ ...prev, ...baseParams }));
        setSelectedGenres(baseGenres);

        // UI: hide the chip right away (don't wait for the fetch)
        setAppliedParams(baseParams);
        setAppliedGenres(baseGenres);

        // run the search again with updated filters
        // tells doSearch not to "merge actors" back in
        doSearch({ ...baseParams, genre: baseGenres }, { fromChip: true });
        }

            useEffect(() => {
                doSearch();
                // eslint-disable-next-line
            }, []);

            function handleChange(e) {
                const {id, value} = e.target;
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

            return (
                <>
                    <div className="navigation-top">
                        <button className="navigation-button" id="sidebarToggle" aria-label="Toggle Sidebar">☰</button>
                        <Link to="/" style={{ color: "inherit", textDecoration: "none" }} className="navigation-button active">SEARCH</Link>
                        <div className="logo">cineMatch</div>
                        <Link to="/help" style={{ textDecoration: 'none' }} className="navigation-button">HELP</Link>
                        <Link to="/feed" style={{ textDecoration: 'none' }} className="navigation-button">FEED</Link>
                        <Link to="/watchlist" style={{ textDecoration: 'none' }} className="navigation-button">WATCHED LIST</Link>
                        <Link to="/to-watch-list" style={{ textDecoration: 'none' }} className="navigation-button">TO-WATCH LIST</Link>

                    </div>

                    <div className="main-container" data-testid="main-container">
                        <aside className="sidebar" data-testid="sidebar">
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
                                    <div className="rating-label">RATING (0–10)</div>

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
                                                    max="10"
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


                                {/*Genre dropdown with checkboxes for multiple selection */}
                                <li className="filter-item genre-dropdown" key="Genre">
                                    <div
                                        className="filter-link genre-header"
                                        onClick={toggleDropdown} // When clicked this opens or closes the dropdown
                                    >
                  <span
                      className="genre-label">  {/* Calls the function to display either GENRE or shows how many genres where selected  */}
                      {getGenreLabel()}

                  </span>
                                        <span
                                            className={getDropdownArrowClass()}>▼</span> {/* Displays dropdown arrow from getDropDownArrowClass */}
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

                            <button className="go-btn" onClick={() => doSearch()}>SEARCH</button>
                            {/* The button to actually search, this one is permanent */}

                            <footer className="sidebar-footer-credit">
                                <p>
                                    Source of data:{" "}
                                    <a href="https://www.themoviedb.org/">{/* We need this to abide by the TOS  */}
                                        TMDB{" "}
                                        <img
                                            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                                            style={{
                                                height: "10px",
                                                width: "auto",
                                                verticalAlign: "middle",
                                                marginLeft: "6px"
                                            }}
                                            alt="TMDB logo"
                                        />
                                    </a>
                                </p>
                                <p>
                                    This website uses TMDB and the TMDB APIs but is not endorsed, certified, or
                                    otherwise
                                    approved by TMDB.
                                </p>
                            </footer>
                        </aside>

                        {/* remove using the index, not needed for key since moivie ID is being used now */}
                        <main className="content-area">

                        <ActiveFilterBar
                        params={appliedParams}        // use the last SUBMITTED filters (not what is currently being typing)
                        selectedGenres={appliedGenres}// same for genres: chips show what was actually searched
                        visible={hasSearched}         // only show chips after the first search
                        onRemove={handleRemoveChip}   // clicking a chip's X calls this to remove it and rerun search
                        />
                            <div id="status" className="muted">{status}</div>
                            <div id="results" className="movie-grid">
                                {movies.map((m) => (
                                    <article
                                        className="movie-card"
                                        key={m.id} // use movie ID instead of index
                                        onClick={() => openDetails(m)}
                                        style={{cursor: "pointer"}}
                                    >
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

                                // detail pass from api
                                castLimit={CAST_LIMIT}
                                runtime={details && typeof details.runtime === "number" ? details.runtime : null} // safe read
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
