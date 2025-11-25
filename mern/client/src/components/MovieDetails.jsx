// src/components/MovieDetails.jsx
import React from "react";

function formatRuntime(minutes)
{
    if (typeof minutes !== "number" || minutes < 0)
        return null;

    const hours= Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0)
        return `${hours}h ${mins}m`;
    return `${mins}m`;
}

export default function MovieDetails({ details, onClose, isWatched, inToWatch, onMarkWatched, onAddToWatch }) {
    if (!details) return null; // If no movie details are provided, render nothing

    const {
        title,
        year,
        rating,
        posterUrl,
        backdropUrl,
        description,
        topCast,
        topCastCount,
        genres,
        runtime,
        director,
        watchProviders
    } = details;

    const runtimeText = formatRuntime(runtime);

    // use linear gradiant to make it look better and text easier to read
    const modalStyle = backdropUrl ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(17,17,17,0.95) 85%, #111 100%), url(${backdropUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat'
    } : {};

    // Clicking the backdrop closes the modal
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={modalStyle}>
                <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
                <div className="modal-header"> {/* Use a placeholder image if no poster URL is provided */}
                    <img
                        src={posterUrl || "https://placehold.co/220x330?text=No+Poster"}
                        alt={title || ""}
                        width={220}
                        height={330}
                        style={{ borderRadius: 8, flexShrink: 0, boxShadow: "0 4px 10px rgba(0,0,0,0.5)" }}
                    />

                    <div style={{ flex: 1 }}> {/* Show year if present, rating if its not null, and runtime if present*/}
                        <h2 style={{ margin: "0 0 8px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>{title ?? "Untitled"}</h2> {/*add text shadow to make it easy to read on light background*/}
                        <div className="muted" style={{ marginBottom: 8, color: "rgba(255,255,255,0.8)" }}>
                            {(year ?? "—")}
                            {rating != null ? ` • ⭐ ${rating}` : ""}
                            {runtimeText ? ` • ${runtimeText}` : ""}
                        </div>

                        {Array.isArray(director) && director.length < 2 && (
                            <div style={{ marginBottom: 12 }}>
                                <strong>Director:</strong> {director.join(", ")}
                            </div>
                        )}
                        {Array.isArray(director) && director.length > 1 && (
                            <div style={{ marginBottom: 12 }}>
                                <strong>Directors:</strong> {director.join(", ")}
                            </div>
                        )}
                        {Array.isArray(genres) && genres.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <strong>Genres:</strong> {genres.join(", ")}
                            </div>
                        )}

                        {/* Only show up the top cast members */}
                        {Array.isArray(topCast) && topCast.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <strong>Top cast:</strong> {topCast.slice(0, topCastCount).join(", ")}
                            </div>
                        )}

                        {/*where to watch icons*/}
                        {Array.isArray(watchProviders) && watchProviders.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <strong style={{ display: 'block', marginBottom: 6 }}>Where to watch:</strong>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {watchProviders.map((provider, index) => {
                                        if (typeof provider === 'object' && provider.logo_path) {
                                            return (
                                                <img
                                                    key={index}
                                                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                                    alt={provider.provider_name}
                                                    title={provider.provider_name} // show name on hover, maybe add click to go to website
                                                    style={{
                                                        width: 45, // no automatic sizing for now
                                                        height: 45,
                                                        borderRadius: 8,
                                                        cursor: "help",
                                                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                                                    }}
                                                />
                                            );
                                        }
                                    })}
                                </div>
                                <div style={{ fontSize: "0.7em", opacity: 0.6, marginTop: 4 }}>
                                    Source: JustWatch
                                </div>
                            </div>
                        )}

                        {description && (
                            <p style={{ marginTop: 12, lineHeight: 1.5, textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>{description}</p>
                        )}

                        {/* Buttons (swapped meanings) */}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button
                                className="go-btn"
                                onClick={onMarkWatched}
                                aria-pressed={!!isWatched}
                            >
                                {isWatched ? "Remove from Watched List" : "Add to Watched List"}
                            </button>

                            <button
                                className="go-btn"
                                onClick={onAddToWatch}
                                aria-pressed={!!inToWatch}
                            >
                                {inToWatch ? "Remove from To-Watch List" : "Save for Later"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
