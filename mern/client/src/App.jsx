// App.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./App.css";
import MovieDetails from "./components/MovieDetails.jsx";
import ErrorModal from "./components/ErrorModal.jsx";
import Navigation from "./components/Navigation.jsx";
import { API_BASE, authedFetch, refresh, fetchReactions, updateReaction} from "./auth/api.js"; // just need this
import { useAuth } from "./auth/AuthContext.jsx";


// get TMDB key from .env file
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// for exporting
const CAST_LIMIT = 5;

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

// rating map
const AGE_RATINGS_DATA = [
    { id: 0, name: "Not Rated" },
    { id: 1, name: "G" },
    { id: 2, name: "PG" },
    { id: 3, name: "PG-13" },
    { id: 4, name: "R" },
    { id: 5, name: "NC-17" },
];

// utilities (top of file)
function shuffleArray(array) {
    const arr = [...array]; // makes a shallow copy of the original array
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); // picks a random index
        [arr[i], arr[j]] = [arr[j], arr[i]]; // swap elems
    }
    return arr;
}

// Renders clickable chips for the active filters
function ActiveFilterBar({ params, selectedGenres, selectedAgeRatings, visible, onRemove }) {
    if (!visible) return null; // don't show chips until a search has run

    const chips = [];
    // helper: push a chip into the list (idx helps remove the exact genre chip)
    const push = (key, value, text, idx = null) =>
        chips.push({ key, value, text, idx });

    // Actor(s) — split comma list into one chip per actor
    if (params.actor?.trim()) {
        params.actor
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((name) => push("actor", name, `Actor: ${name}`));
    }

    if (params.keyword?.trim()) {
        params.keyword
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((k) => push("keyword", k, `Keyword: ${k}`));
    }

    // Director — single chip only (no comma support)
    if (params.director?.trim()) {
        const d = params.director.trim();
        push("director", d, `Director: ${d}`);
    }

    // Title — single chip
    if (params.title?.trim()) push("title", null, `Title: ${params.title.trim()}`);

    // Year range — make chips if set
    if (params.year_min?.trim()) push("year_min", null, `Year ≥ ${params.year_min}`);
    if (params.year_max?.trim()) push("year_max", null, `Year ≤ ${params.year_max}`);

    // Rating range — make chips if set
    if (params.rating_min?.trim())
        push("rating_min", null, `Rating ≥ ${params.rating_min}`);
    if (params.rating_max?.trim())
        push("rating_max", null, `Rating ≤ ${params.rating_max}`);

    // Genres — one chip per selected genre (carry index so we can remove the exact one)
    (selectedGenres || []).forEach((g, i) => push("genre", g, `Genre: ${g}`, i));

    // rating chips (maybe condense this into one chip later?)
    (selectedAgeRatings || []).forEach((id, i) => {
        const label = AGE_RATINGS_DATA.find(r => r.id === id)?.name || id;
        push("age_rating", id, `Age: ${label}`, i);
    });

    if (!chips.length) return null; // nothing to show

    return (
        <div className="active-filters">
            {chips.map((c, i) => (
                <button
                    key={`${c.key}-${c.value ?? i}-${c.idx ?? "x"}`}
                    className="chip"
                    onClick={() => onRemove(c)}
                    aria-label={`Remove ${c.text}`}
                    type="button"
                >
                    <span className="chip-text">{c.text}</span>
                    <span className="chip-x" aria-hidden>
            ×
          </span>
                </button>
            ))}
        </div>
    );
}



// ----------------------------------------------------
// App component
// ----------------------------------------------------
function App() {
    const { user } = useAuth();
    const canModifyLists = !!user;

    const [watched, setWatched] = useState(() => new Set());
    const [toWatch, setToWatch] = useState(() => new Set());

    // liked/disliked arrays  (read-only in Search)
    const [likedTmdbIds, setLikedTmdbIds] = useState([]);
    const [dislikedTmdbIds, setDislikedTmdbIds] = useState([]);

    // error state message
    const [errorMsg, setErrorMsg] = useState("");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);
    // track abort controller to cancel double shuffle
    const searchController = useRef(null);



    async function loadListsIntoApp() {
        try {

            //await refresh().catch(() => {});

            const res = await authedFetch("/me/lists");


            if (res.status === 401) {
                console.warn("loadListsIntoApp: not logged in (401), using empty lists");
                setWatched(new Set());
                setToWatch(new Set());
                return;
            }

            if (!res.ok) {
                console.warn("loadListsIntoApp failed:", res.status);
                setWatched(new Set());
                setToWatch(new Set());
                return;
            }

            let raw;
            try {
                raw = await res.json();
            } catch (err) {
                console.warn("loadListsIntoApp: failed to parse JSON from /api/me/lists", err);
                setWatched(new Set());
                setToWatch(new Set());
                return;
            }


            const watchedArr =
                Array.isArray(raw?.watchedIds) ? raw.watchedIds :
                    Array.isArray(raw?.watched)    ? raw.watched    :
                        [];

            const toWatchArr =
                Array.isArray(raw?.toWatchIds)   ? raw.toWatchIds :
                    Array.isArray(raw?.toWatch)      ? raw.toWatch    :
                        Array.isArray(raw?.["to-watch"]) ? raw["to-watch"] :
                            [];

            const watchedSet = new Set(
                watchedArr
                    .map(Number)
                    .filter((n) => Number.isFinite(n) && n >= 0)
            );

            const toWatchSet = new Set(
                toWatchArr
                    .map(Number)
                    .filter((n) => Number.isFinite(n) && n >= 0)
            );

            setWatched(watchedSet);
            setToWatch(toWatchSet);
            const reactions = await fetchReactions();
            setLikedTmdbIds(reactions.likedTmdbIds);
            setDislikedTmdbIds(reactions.dislikedTmdbIds);
        } catch (e) {
            console.warn("loadListsIntoApp error:", e);
            setWatched(new Set());
            setToWatch(new Set());
        }
    }


    useEffect(() => {
        if (!user) {
            // logged out- clear client-side sets
            setWatched(new Set());
            setToWatch(new Set());
            return;
        }
        loadListsIntoApp();
    }, [user]);


    useEffect(() => {
        function handleListsChanged() {
            if (user) loadListsIntoApp();
        }
        window.addEventListener("lists:changed", handleListsChanged);
        return () => window.removeEventListener("lists:changed", handleListsChanged);
    }, [user]);

    const [details, setDetails] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // State for search parameters
    const [params, setParams] = useState({
        actor: "",
        director: "",
        genre: "",
        keyword: "",
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

    const [ageRatingDropdownOpen, setAgeRatingDropdownOpen] = useState(false);
    const [selectedAgeRatings, setSelectedAgeRatings] = useState([]);

    // Frozen copies of the last submitted filters (chips read from these)
    const [appliedParams, setAppliedParams] = useState(params);
    const [appliedGenres, setAppliedGenres] = useState(selectedGenres);
    const [appliedAgeRatings, setAppliedAgeRatings] = useState(selectedAgeRatings);
    const [hasSearched, setHasSearched] = useState(false);

    // track latest applied filters
    const appliedParamsRef = useRef(appliedParams);
    const appliedGenresRef = useRef(appliedGenres);
    const appliedAgeRatingsRef = useRef(appliedAgeRatings);

    // ----------------------------------------------------
    // Navigation helpers
    // ----------------------------------------------------
    function toggleDropdown() {
        setGenreDropdownOpen((prev) => !prev);
    }

    // toggle for age ratings
    function toggleAgeRatingDropdown() {
        setAgeRatingDropdownOpen((prev) => !prev);
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

    // helpers for age ratings
    function handleAgeRatingToggle(id) {
        const newSelected = [...selectedAgeRatings];
        if (selectedAgeRatings.includes(id)) {
            const index = newSelected.indexOf(id);
            newSelected.splice(index, 1);
        } else {
            newSelected.push(id);
        }
        setSelectedAgeRatings(newSelected);
    }

    function getAgeRatingLabel() {
        if (selectedAgeRatings.length === 0) {
            return "AGE RATING...";
        } else {
            return selectedAgeRatings.length + " SELECTED";
        }
    }

    function getAgeDropdownArrowClass() {
        return ageRatingDropdownOpen ? "dropdown-arrow open" : "dropdown-arrow";
    }

    function isAgeRatingChecked(id) {
        return selectedAgeRatings.includes(id);
    }

    // ----------------------------------------------------
    // Backend helpers
    // ----------------------------------------------------
    // Build the query string for the API request based on filled parameters
    function buildQuery(p) {
        const qs = new URLSearchParams();
        Object.entries(p).forEach(([k, v]) => {
            if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return;
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
    // add signal param to support aborting a search (could be useful for chip issue as well)
    async function fetchMovies(p = {}, signal = null) {
        const res = await fetch(API_BASE + buildQuery(p), { signal });
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

    // ----------------------------------------------------
    // TMDB details loader
    // ----------------------------------------------------

    // make some changes to this to make sure all information is fetched
    async function openDetails(movie) {
        try {
            const res = await fetch(`${API_BASE}/record/details/${movie.id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // replace whole conversion call and check with this
            const tmdbId = movie.id;
            console.log("[TMDB] Using ID:", tmdbId);

            let patch = {}; // empty

            // if found then pull actors, runtime, and watch providers
            if (tmdbId !== null && tmdbId !== undefined) {
                const numOfActors = CAST_LIMIT;

                const tmdbRes = await fetch(
                    `${API_BASE}/record/tmdb/${tmdbId}?append_to_response=credits,watch/providers,videos`
                );

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
                    let watchType = null;

                    // use US by default, not important for other areas rn since it changes by location

                    if (tmdb && tmdb["watch/providers"] && tmdb["watch/providers"].results && tmdb["watch/providers"].results.US) {
                        const us = tmdb["watch/providers"].results.US;
                        if (us.flatrate && us.flatrate.length > 0) {
                            watchProviders = us.flatrate;
                            watchType = "stream";
                        } else if (us.rent && us.rent.length > 0) {
                            watchProviders = us.rent;
                            watchType = "rent";
                        }
                    }

                    // get trailer
                    let trailerUrl = null;
                    if (tmdb && tmdb.videos && tmdb.videos.results) {
                        const trailer = tmdb.videos.results.find(v => v.site === "YouTube" && v.type === "Trailer");
                        if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
                    }

                    // check for prequel and sequel
                    if (tmdb.belongs_to_collection && tmdb.belongs_to_collection.id) {
                        const collectionUrl = new URL(`https://api.themoviedb.org/3/collection/${tmdb.belongs_to_collection.id}`);
                        collectionUrl.searchParams.set("api_key", import.meta.env.VITE_TMDB_API_KEY);
                        try {
                            const collRes = await fetch(collectionUrl.toString(), { headers: { accept: "application/json" } });
                            if (collRes.ok) {
                                const collectionData = await collRes.json();
                                // sort by release date to determine order
                                const parts = (collectionData.parts || []).sort((a, b) => {
                                    return new Date(a.release_date || "9999-12-31") - new Date(b.release_date || "9999-12-31");
                                });
                                const currentIndex = parts.findIndex(p => p.id === tmdbId);
                                if (currentIndex !== -1) {
                                    if (currentIndex > 0) {
                                        // prequel
                                        const prev = parts[currentIndex - 1];
                                        patch.prequel = { id: prev.id, tmdbId: prev.id, title: prev.title };
                                    }
                                    if (currentIndex < parts.length - 1) {
                                        // sequel exists
                                        const next = parts[currentIndex + 1];
                                        patch.sequel = { id: next.id, tmdbId: next.id, title: next.title };
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Collection fetch error:", e);
                        }

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
                        patch.watchType = watchType;
                    }

                    if (trailerUrl) {
                        patch.trailerUrl = trailerUrl;
                    }

                    if (!data.title) {
                        patch.title = tmdb.title;
                        patch.year = tmdb.release_date ? parseInt(tmdb.release_date.slice(0, 4)) : null;
                        patch.description = tmdb.overview;
                        patch.posterUrl = tmdb.poster_path ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : null;
                        patch.backdropUrl = tmdb.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}` : null;
                        patch.rating = tmdb.vote_average;
                    }

                    console.log(
                        "[TMDB TEST] topCast:",
                        topCast,
                        "runtime:",
                        runtime,
                        "providers:",
                        watchProviders.length
                    );
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

        } catch (e) {
            console.error(e);
        }
    }



    // ----------------------------------------------------
    // Search + filters
    // ----------------------------------------------------
    function handleChange(e) {
        const { id, value } = e.target;
        const raw = id.startsWith("q") ? id.slice(1) : id;
        const key = raw.toLowerCase();
        setParams((prev) => ({
            ...prev,
            [key]: value,
        }));
    }

    async function doSearch(overrideQuery, opts = {}) {
        // abort prior request
        if (searchController.current) {
            searchController.current.abort();
        }
        // make new controller for request
        const controller = new AbortController();
        searchController.current = controller;
        const signal = controller.signal;
        // sometimes onClick passes the click event as the first arg
        // if that happens, ignore it so we don't treat it like overrides
        if (
            overrideQuery &&
            typeof overrideQuery === "object" &&
            ("nativeEvent" in overrideQuery ||
                "target" in overrideQuery ||
                "preventDefault" in overrideQuery)
        ) {
            overrideQuery = undefined;
        }

        // Inline helper to merge comma-separated actor lists without duplicates
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
            // separate genre from other overrides
            const { genre: overrideGenre, age_rating: overrideAgeRating, ...otherOverrides } = overrideQuery || {};

            // start from current inputs unless we received an override (chip removal, clear, etc.)
            // ghost fix: use otherOverrides instead of overrideQuery to keep genre out of nextParams
            let nextParams = overrideQuery ? { ...params, ...otherOverrides } : { ...params };

            // GENRES handling:
            // - if override has "genre": use that
            // - if override exists but no "genre": keep applied genres
            // - if no override: use the live checkbox selection
            let nextGenres = overrideQuery
                ? Object.prototype.hasOwnProperty.call(overrideQuery, "genre")
                    ? [...(overrideGenre || [])]
                    : [...appliedGenres]
                : [...selectedGenres];

            let nextAgeRatings = overrideQuery
                ? Object.prototype.hasOwnProperty.call(overrideQuery, "age_rating")
                    ? [...(overrideAgeRating || [])]
                    : [...appliedAgeRatings]
                : [...selectedAgeRatings];

            // ACTORS handling:
            // - merge previously applied actors with what's typed ONLY for normal searches
            // - skip merge when removal came from a chip or a CLEAR
            const skipActorMerge = opts.fromChip === true || opts.isClear === true;
            if (!skipActorMerge && hasSearched) {
                nextParams.actor = mergeCommaLists(appliedParams.actor, nextParams.actor);
                nextParams.keyword = mergeCommaLists(appliedParams.keyword, nextParams.keyword); // added for keywords
            }

            // clean actor string (remove extra spaces/commas)
            if (typeof nextParams.actor === "string") {
                nextParams.actor = nextParams.actor
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join(", ");
            }

            // clean keywords
            if (typeof nextParams.keyword === "string") {
                nextParams.keyword = nextParams.keyword
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join(", ");
            }

            // final query object (only include genre if we have at least one)
            const query = {
                ...nextParams,
                ...(nextGenres.length ? { genre: nextGenres } : {}),
                ...(nextAgeRatings.length ? { age_rating: nextAgeRatings } : {}),
            };

            // ask backend for results
            // pass signal here
            const data = await fetchMovies(query, signal);

            // Attach tmdbId from our persisted map, if we know it

            const withTmdb = data.map((m) => {
                return m;
            });



            // determine if this is a "no filters" search (shuffle results)
            const noSearch =
                (!nextParams.actor || !nextParams.actor.trim()) &&
                (!nextParams.director || !nextParams.director.trim()) &&
                (!nextParams.title || !nextParams.title.trim()) &&
                (!nextParams.keyword || !nextParams.keyword.trim()) &&
                !nextGenres.length &&
                !nextAgeRatings.length &&
                !nextParams.year_min &&
                !nextParams.year_max &&
                !nextParams.rating_min &&
                !nextParams.rating_max;

            // shuffle 50 from top 200
            setMovies(noSearch ? shuffleArray(withTmdb).slice(0, 50) : withTmdb);
            setStatus(withTmdb.length ? "" : "No results found.");

            setAppliedParams(nextParams);
            appliedParamsRef.current = nextParams;

            setAppliedGenres(nextGenres);
            appliedGenresRef.current = nextGenres;

            setAppliedAgeRatings(nextAgeRatings);
            appliedAgeRatingsRef.current = nextAgeRatings;

            if (!opts.isClear) setHasSearched(true);
        } catch (err) {
            // if the fetch was aborted, ignore the error
            if (err.name === 'AbortError') return;
            console.error(err);
            setStatus("");
            setErrorMsg(err.message);
        }
    }

    function handleRemoveChip(chip) {
        // start from the applied filters, this matches what's on screen
        const baseParams = { ...appliedParamsRef.current };
        let baseGenres = [...appliedGenresRef.current];
        let baseAgeRatings = [...appliedAgeRatingsRef.current];

        // remove one item from a comma list (case-insensitive)
        const removeFromCommaList = (raw, valueToRemove) =>
            (raw || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((s) => s.toLowerCase() !== (valueToRemove || "").toLowerCase())
                .join(", ");

        // clear the right thing based on which chip was clicked
        switch (chip.key) {
            case "actor":
                baseParams.actor = removeFromCommaList(baseParams.actor, chip.value);
                break;
            case "director":
                baseParams.director = "";
                break;
            case "title":
                baseParams.title = "";
                break;
            case "keyword":
                baseParams.keyword = removeFromCommaList(baseParams.keyword, chip.value);
                break;
            case "year_min":
                baseParams.year_min = "";
                break;
            case "year_max":
                baseParams.year_max = "";
                break;
            case "rating_min":
                baseParams.rating_min = "";
                break;
            case "rating_max":
                baseParams.rating_max = "";
                break;
            case "genre":
                if (typeof chip.idx === "number") {
                    baseGenres = baseGenres.filter((_, i) => i !== chip.idx);
                } else {
                    baseGenres = baseGenres.filter((g) => g !== chip.value);
                }
                break;

            // rating removal
            case "age_rating":
                if (typeof chip.idx === "number") {
                    baseAgeRatings = baseAgeRatings.filter((_, i) => i !== chip.idx);
                } else {
                    baseAgeRatings = baseAgeRatings.filter((r) => r !== chip.value);
                }
                break;
            default:
                break;
        }

        // Update refs right away so the next click sees the new states
        appliedParamsRef.current = baseParams;
        appliedGenresRef.current = baseGenres;
        appliedAgeRatingsRef.current = baseAgeRatings;

        // keep sidebar inputs/checkboxes same with what we removed
        setParams((prev) => ({ ...prev, ...baseParams }));
        setSelectedGenres(baseGenres);
        setSelectedAgeRatings(baseAgeRatings);

        // UI: hide the chip right away (don't wait for the fetch)
        setAppliedParams(baseParams);
        setAppliedGenres(baseGenres);
        setAppliedAgeRatings(baseAgeRatings);

        // run the search again with updated filters
        doSearch({ ...baseParams, genre: baseGenres, age_rating: baseAgeRatings }, { fromChip: true }); // added in ratings
    }

    function clearFilters() {
        const emptyParams = {
            actor: "",
            director: "",
            title: "",
            keyword: "",
            year_min: "",
            year_max: "",
            rating_min: "",
            rating_max: "",
        };

        // Reset all states
        setParams(emptyParams);
        setSelectedGenres([]);
        setSelectedAgeRatings([]);

        setAppliedParams(emptyParams);
        setAppliedGenres([]);
        setAppliedAgeRatings([]);

        // reset refs
        appliedParamsRef.current = emptyParams;
        appliedGenresRef.current = [];
        appliedAgeRatingsRef.current = [];

        // Run search with empty filters
        doSearch({ ...emptyParams, genre: [], age_rating: [] }, { fromChip: true, isClear: true });
    }

    useEffect(() => {
        doSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ----------------------------------------------------
    // Derived state: watched / to-watch / likes / dislikes
    // ----------------------------------------------------
    const isWatched = useMemo(
        () => details && watched.has(Number(details.id)),
        [details, watched]
    );
    const inToWatch = useMemo(
        () => details && toWatch.has(Number(details.id)),
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

    async function toggleList(list, hasIt) {
        if (!details) return;
        const id = Number(details.id);
        const action = hasIt ? "remove" : "add";

        // Call API (requires logged-in user, authedFetch sets Authorization if you’ve logged in)
        try {
            const res = await authedFetch(`/me/lists/${list}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, id }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            console.error(e);
            // don’t update local state if server failed
            setErrorMsg(e.message || "Failed to update list.");
            return;
        }

        // Local mirror so existing WatchList page still works
        if (list === "watched") {
            setWatched(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        } else {
            setToWatch(prev => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });
        }

        // Let other pages refresh if they care
        window.dispatchEvent(new CustomEvent("lists:changed", { detail: { list, action, id } }));
    }

    // Mark watched / unwatched from Search
    const onMarkWatched = () => {
        if (!details) return;

        const id = Number(details.id);
        const tmdbId = details.tmdbId != null ? Number(details.tmdbId) : null;
        const wasWatched = watched.has(id);

        // Toggle watched
        if (canModifyLists) {
            toggleList("watched", isWatched);
        }

        // If removed from watched list, clear like/dislike for this TMDB id
        if (wasWatched && tmdbId != null && Number.isFinite(tmdbId)) {
            setLikedTmdbIds((prev) => prev.filter((x) => x !== tmdbId));
            setDislikedTmdbIds((prev) => prev.filter((x) => x !== tmdbId));

            updateReaction(tmdbId, "clear").catch(console.error);
        }
    };

    const onAddToWatch = () => {
        if (!details || !canModifyLists) return;
        toggleList("to-watch", inToWatch);
    };

    // ----------------------------------------------------
    // Render
    // ----------------------------------------------------
    return (
        <>
            <Navigation
                sidebarCollapsed={sidebarCollapsed}
                setSidebarCollapsed={setSidebarCollapsed}
            />

            <div className={`main-container ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
                <aside className="sidebar">
                    {/* Simple text boxes that we will take as input */}
                    <ul className="search-filters">
                        {["Actor", "Director", "Title", "Keyword"].map((label) => (
                            <li className="filter-item" key={label}>
                                <label className="filter-link" htmlFor={`q${label}`} style={{ display: "block", cursor: "text" }}>
                                    <input
                                        id={`q${label}`}
                                        className="filter-input"
                                        placeholder={`${label.toUpperCase()}...`}
                                        value={params[label.toLowerCase()] || ""}
                                        onChange={handleChange}
                                        onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                    />
                                </label>
                            </li>
                        ))}

                        {/* YEAR RANGE */}
                        <li className="year-range" key="YearRange">
                            <div className="year-label">YEAR</div>
                            <div className="year-bubbles">
                                <div className="filter-item">
                                    <label
                                        className="filter-link"
                                        htmlFor="qYear_Min"
                                        style={{ display: "block", cursor: "text" }}
                                    >
                                        <input
                                            id="qYear_Min"
                                            className="filter-input"
                                            type="number"
                                            placeholder="MIN"
                                            value={params.year_min}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </label>
                                </div>

                                <div className="filter-item">
                                    <label
                                        className="filter-link"
                                        htmlFor="qYear_Max"
                                        style={{ display: "block", cursor: "text" }}
                                    >
                                        <input
                                            id="qYear_Max"
                                            className="filter-input"
                                            placeholder="MAX"
                                            type="number"
                                            value={params.year_max}
                                            onChange={handleChange}
                                            onKeyDown={(e) => e.key === "Enter" && doSearch()}
                                        />
                                    </label>
                                </div>
                            </div>
                        </li>

                        {/* RATING RANGE */}
                        <li className="rating-range" key="RatingRange">
                            <div className="rating-label">RATING (0–10)</div>

                            <div className="rating-bubbles">
                                <div className="filter-item">
                                    <label
                                        className="filter-link"
                                        htmlFor="qRating_Min"
                                        style={{ display: "block", cursor: "text" }}
                                    >
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
                                    </label>
                                </div>

                                <div className="filter-item">
                                    <label
                                        className="filter-link"
                                        htmlFor="qRating_Max"
                                        style={{ display: "block", cursor: "text" }}
                                    >
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
                                    </label>
                                </div>
                            </div>
                        </li>

                        {/* Genre dropdown with checkboxes for multiple selection */}
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

                        {/* age ratings drop down hurr durr copy genre dropdown */}
                        <li className="filter-item genre-dropdown" key="AgeRating">
                            <div
                                className="filter-link genre-header"
                                onClick={toggleAgeRatingDropdown}
                            >
                                <span className="genre-label">{getAgeRatingLabel()}</span>
                                <span className={getAgeDropdownArrowClass()}>▼</span>
                            </div>
                            {ageRatingDropdownOpen && (
                                <div className="genre-checkbox-list">
                                    {AGE_RATINGS_DATA.map((rating) => (
                                        <label key={rating.id} className="genre-checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={isAgeRatingChecked(rating.id)}
                                                onChange={() => handleAgeRatingToggle(rating.id)}
                                            />
                                            <span>{rating.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </li>

                    </ul>

                    <button
                        className="go-btn"
                        onClick={() => {
                            doSearch();
                            // collapse sidebar on mobile after pressing search (recommendation from my father)
                            if (window.innerWidth < 768) {
                                setSidebarCollapsed(true);
                            }
                        }}
                    >
                        SEARCH
                    </button>
                    <button className="go-btn" onClick={clearFilters}>
                        CLEAR
                    </button>

                    <footer className="sidebar-footer-credit">
                        <p>
                            Source of data:{" "}
                            <a
                                href="https://www.themoviedb.org/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
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

                {!sidebarCollapsed && (
                    <div
                        className="sidebar-overlay"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}

                <main className="content-area">
                    <ActiveFilterBar
                        params={appliedParams}
                        selectedGenres={appliedGenres}
                        selectedAgeRatings={appliedAgeRatings}
                        visible={hasSearched}
                        onRemove={handleRemoveChip}
                    />

                    <div id="status" className="muted">
                        {status}
                    </div>
                    <div id="results" className="movie-grid">
                        {movies.map((m) => {
                            const tmdbIdNum =
                                m.tmdbId != null
                                    ? Number(m.tmdbId)
                                    : Number(m.id);

                            const likedFlag =
                                tmdbIdNum != null && likedTmdbIds.includes(tmdbIdNum);
                            const dislikedFlag =
                                tmdbIdNum != null && dislikedTmdbIds.includes(tmdbIdNum);

                            return (
                                <article
                                    className="movie-card"
                                    key={m.id}
                                    onClick={() => openDetails(m)}
                                    style={{
                                        cursor: "pointer",
                                        position: "relative",
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        backgroundColor: "#222", // ensuring consistent background for card
                                        borderRadius: "8px",
                                        overflow: "hidden", // ensures image respects border radius
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
                                                    ? "rgba(0, 128, 0, 1)"   // make solid
                                                    : "rgba(180, 0, 0, 1)", // make solid
                                                color: "#fff",
                                                zIndex: 10, // bring to front
                                                boxShadow: "0 2px 4px rgba(0,0,0,0.5)"
                                            }}
                                        >
                                            {likedFlag ? "👍" : "👎"}
                                        </div>
                                    )}

                                    <img
                                        src={
                                            m.posterUrl || "https://placehold.co/300x450?text=No+Poster"
                                        }
                                        alt={m.title || ""}
                                        style={{
                                            width: "100%",
                                            aspectRatio: "2/3",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                    />

                                    <div
                                        style={{
                                            padding: "10px",
                                            display: "flex",
                                            flexDirection: "column",
                                            flex: 1,
                                            gap: "4px", // element gap, maybe increase later?
                                        }}
                                    >
                                        <div
                                            className="movie-title"
                                            style={{
                                                whiteSpace: "normal",
                                                overflow: "visible",
                                                lineHeight: "1.2",
                                                fontSize: "1rem",
                                                fontWeight: "600",
                                                marginBottom: "2px",
                                            }}
                                        >
                                            {m.title ?? ""}
                                        </div>
                                        <div
                                            className="movie-sub"
                                            style={{
                                                fontSize: "0.85rem",
                                                opacity: 0.8,
                                                marginBottom: "2px"
                                            }}
                                        >
                                            {m.year ?? "—"}
                                        </div>

                                        {(m.rating != null || m.ageRating) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                    flexWrap: "wrap",
                                                    marginBottom: "2px",
                                                }}
                                            >
                                                {m.rating != null && (
                                                    <div
                                                        className="movie-sub"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            lineHeight: 1,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                display: "inline-block",
                                                                transform: "translateY(-1px)", // translate emoji to fix vertical allignment issue
                                                            }}
                                                        >
                                                          ⭐
                                                        </span>
                                                        <span>{Number(m.rating).toFixed(1)}</span>
                                                    </div>
                                                )}

                                                {m.ageRating && (
                                                    <span
                                                        style={{
                                                            border: "1px solid #555",
                                                            padding: "1px 6px",
                                                            borderRadius: "4px",
                                                            fontSize: "0.75rem",
                                                            color: "#ccc",
                                                            lineHeight: "1.2", // prevent offset
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        {m.ageRating}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div
                                            className="movie-sub"
                                            style={{
                                                marginTop: "auto", // move genres to bottom
                                                fontSize: "0.8rem",
                                                opacity: 0.6,
                                                lineHeight: "1.3",
                                                paddingTop: "6px"
                                            }}
                                        >
                                            {(() => {
                                                const list = Array.isArray(m.genre)
                                                    ? m.genre
                                                    : [m.genre];
                                                // remove NA or null or empty
                                                const clean = list.filter(
                                                    (g) => g && g !== "NA"
                                                );
                                                return clean.length > 0
                                                    ? clean.join(", ")
                                                    : "—";
                                            })()}
                                        </div>
                                    </div>
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
                        canModifyLists={canModifyLists}
                        // Read-only like/dislike state (no editing here)
                        isLiked={!!isLiked}
                        isDisliked={!!isDisliked}
                        // likesEditable omitted - MovieDetails should hide Like/Dislike buttons
                        castLimit={CAST_LIMIT}
                        runtime={
                            details && typeof details.runtime === "number"
                                ? details.runtime
                                : null
                        }
                        onNavigate={openDetails}
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
