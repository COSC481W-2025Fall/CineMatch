// src/components/feed.js - may change later

// -- LOGIC -- //
// takes an input of a list of database movie IDs, outputs a list of TMDB movie IDs in order from highest reccomended to least
// least recommended still are reccomended movies, just not as often
// movies with a tied number of reccomendations are scored by their TMDB score
// basic logic:
//  for every movie in the given list, convert it into a TMDB movie ID and store the ID and grab its reccomendations (reccomendations list holds the movie ID of the reccomended movie, its rating, and the number of times its appeared (starting at 1)
//  we store the TMDB movie IDs we called to get reccomendations so theyre excluded from the final output list of reccomended movies
//  repeat this for every movie given, until we have a list of reccomended movies
//  movies that appear the most times are ordered first, and then movies that appeared the same number of times are ordered by user rating from TMDB

import { findTmdbIdByTitleYear } from "./converter.js";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";


export async function generateFeed(databaseMovieIds = [])
{
    if (!TMDB_API_KEY)
    {
        console.error("Feed Error: TMDB API Key is missing.");
        return [];
    }
    if (!databaseMovieIds || databaseMovieIds.length === 0)
    {
        return []; // nothing to make
    }

    // stores the aggregated recommendations: { id, count, rating }
    const recommendations = new Map();

    // stores the TMDB IDs of the input movies to exclude them from the final output list
    const convertedInputTmdbIds = new Set();

    // process each database ID from the input list
    for (const dbId of databaseMovieIds)
    {
        let tmdbId = null;
        try
        {
            // get movie title and year from mangodb
            // NOTE THIS WILL BE VERY SLOW we will just pass the name and year directly later

            // debugging
            const detailsRes = await fetch(`/record/details/${dbId}`);
            if (!detailsRes.ok)
            {
                console.warn(`Feed: Could not fetch details for dbId ${dbId}`);
                continue;
            }

            const dbMovie = await detailsRes.json();
            if (!dbMovie.title || dbMovie.year == null)
            {
                console.warn(`Feed: Missing title/year for dbId ${dbId}`);
                continue;
            }

            // convert to a tmdb ID with converter script
            tmdbId = await findTmdbIdByTitleYear(dbMovie.title, dbMovie.year);
            if (tmdbId === null)
            {
                console.warn(`Feed: Could not find TMDB ID for "${dbMovie.title}" (${dbMovie.year})`);
                continue;
            }

            // store converted ID to exclude it
            convertedInputTmdbIds.add(tmdbId);

            // fetch recommendations for this TMDB ID
            const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}/recommendations`);
            url.searchParams.set("api_key", TMDB_API_KEY);

            const recResponse = await fetch(url.toString(), { headers: { accept: "application/json" } });
            if (!recResponse.ok)
            {
                console.warn(`Feed: Could not fetch recommendations for tmdbId ${tmdbId}`);
                continue;
            }

            const recJsonData = await recResponse.json();

            let recResults = [];
            if (recJsonData && Array.isArray(recJsonData.results))
            {
                recResults = recJsonData.results;
            }

            // process recommendations
            for (const rec of recResults)
            {
                if (!rec || typeof rec.id !== "number") continue;

                const recId = rec.id;

                // get rating directly from the recommendation response
                let userRating = 0; // default 0
                if (typeof rec.vote_average === "number")
                {
                    userRating = rec.vote_average;
                }

                if (recommendations.has(recId))
                {
                    // just increment its count if already reccomended
                    recommendations.get(recId).count++;
                }
                else
                {
                    // add to map if new
                    recommendations.set(recId,
                    {
                        id: recId,
                        count: 1, // start at 1
                        rating: userRating
                    });
                }
            }

        }
        catch (e) // ruh roh
        {
            console.error(`Feed: Failed to process movie (dbId: ${dbId}, tmdbId: ${tmdbId}):`, e);
        }
    }

    // convert map to array and sort
    const sortedRecs = Array.from(recommendations.values())
        // filter out movies from original input list
        .filter(rec => !convertedInputTmdbIds.has(rec.id))

        // sort
        .sort((a, b) =>
        {
            // primary sort by number of times it appeared
            if (a.count !== b.count)
            {
                return b.count - a.count;
            }
            // tie breaker sort by user rating
            return b.rating - a.rating;
        });

    // return list of tmdb IDs in the correct order
    return sortedRecs.map(rec => rec.id);
}