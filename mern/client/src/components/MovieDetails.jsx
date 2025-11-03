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
        description,
        topCast,
        topCastCount,
        genres,
        runtime
    } = details;

    const runtimeText = formatRuntime(runtime);

    // Clicking the backdrop closes the modal
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

                <div className="modal-header"> {/* Use a placeholder image if no poster URL is provided */}
                    <img
                        src={posterUrl || "https://placehold.co/220x330?text=No+Poster"}
                        alt={title || ""}
                        width={220}
                        height={330}
                        style={{ borderRadius: 8, flexShrink: 0 }}
                    />

                    <div style={{ flex: 1 }}> {/* Show year if present, rating if its not null, and runtime if present*/}
                        <h2 style={{ margin: "0 0 8px" }}>{title ?? "Untitled"}</h2>
                        <div className="muted" style={{ marginBottom: 8 }}>
                            {(year ?? "—")}
                            {rating != null ? ` • ⭐ ${rating}` : ""}
                            {runtimeText ? ` • ${runtimeText}` : ""}
                        </div>

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

                        {description && (
                            <p style={{ marginTop: 12, lineHeight: 1.5 }}>{description}</p>
                        )}

                        {/* Buttons (swapped meanings) */}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button
                                className="go-btn"
                                onClick={onMarkWatched}
                                disabled={isWatched}
                            >
                                {isWatched ? "Added to Watched List!" : "Previously Seen"}
                            </button>
                            <button
                                className="go-btn"
                                onClick={onAddToWatch}
                                disabled={inToWatch}
                            >
                                {inToWatch ? "Added to To-Watch List!" : "Save for Later"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
