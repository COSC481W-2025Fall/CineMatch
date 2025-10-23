
// src/components/converter.js - may change later
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// normalizers
const DIACRITICS = /\p{M}/gu; // unicode combining marks
const PUNCTUATION_DASH = /['".,:;!?()[\]{}\/&\\\-–—_]/g; // remove these from title search too
const MULTI_SPACE = /\s+/g; // remove any mulitpsace formatting


// title normalizer function
function normalizedTitle(title = "") {
    let out = String(title).toLowerCase();
    out = out.normalize("NFKD"); // "Compatibility Decomposition"
    out = out.replace(DIACRITICS, "");
    out = out.replace(PUNCTUATION_DASH, " ");
    out = out.replace(MULTI_SPACE, " ").trim();
    return out;
}

// takes any language, just title and year
export async function findTmdbIdByTitleYear(title, year, { language } = {})
{
    if (!title || year == null || !TMDB_API_KEY) return null;

    const titleNorm = normalizedTitle(title);

    // make search with year hint
    const url = new URL(`${TMDB_BASE_URL}/search/movie`);
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("query", title);
    url.searchParams.set("year", String(year)); // sets a hint for the exact year
    if (language) url.searchParams.set("language", language);

    const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
    if (!response.ok) return null;

    const json = await response.json();

    // extract results array safely (avoid optional chaining and nullish coalescing)
    let results = [];
    if (json && Array.isArray(json.results))
    {
        results = json.results;
    }

    // now sort by exact year after soft search
    const y = String(year);
    results = results.filter(function (r)
    {
        const rd = r && r.release_date ? r.release_date : "";
        return rd.startsWith(y);
    });
    if (results.length === 0) return null;

    // score movies by best result
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < results.length; i++)
    {
        const r = results[i];

        // normalize titles comparison
        const t1 = normalizedTitle(r && r.title ? r.title : "");
        const t2 = normalizedTitle(r && r.original_title ? r.original_title : "");

        let score = 0;
        if (t1 === titleNorm || t2 === titleNorm)
        {
            score = 1000;              // exact title
        }

        else if (t1.startsWith(titleNorm) || t2.startsWith(titleNorm))
        {
            score = 600;
        }

        else if (titleNorm.startsWith(t1) || titleNorm.startsWith(t2))
        {
            score = 550;
        }

        // suggested tie breaker to go by populatity (maybe go by vote count later)
        let popularity = 0;
        if (r && typeof r.popularity === "number")
        {
            popularity = r.popularity;
        }
        score += popularity / 10;

        if (score > bestScore)
        {
            best = r;
            bestScore = score;
        }
    }

    // safely return id
    if (best && typeof best.id === "number")
    {
        return best.id;
    }
    return null;
}