// src/components/MovieDetails.jsx
import React, { useState, useEffect } from "react";

function formatRuntime(minutes) {
    if (typeof minutes !== "number" || minutes < 0) return null;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

export default function MovieDetails({
                                         details,
                                         onClose,
                                         isWatched,
                                         inToWatch,
                                         onMarkWatched,
                                         onAddToWatch,
                                         onDislike, // optional
                                         onLike,    // optional
                                         isLiked = false,
                                         isDisliked = false,
                                         canModifyLists = true,
                                     }) {
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
        ageRating,
        directors,
        director,
        watchProviders,
        tagline, // for later
    } = details;

    const runtimeText = formatRuntime(runtime);

    const directorList =
        Array.isArray(directors) && directors.length > 0
            ? directors
            : Array.isArray(director)
                ? director
                : [];

    const hasDirectors =
        directorList &&
        directorList.length > 0 &&
        !(directorList.length === 1 && directorList[0] === "NA");

    // preload background image
    const [bgLoaded, setBgLoaded] = useState(false);

    useEffect(() => {
        if (backdropUrl) {
            setBgLoaded(false);
            const img = new Image();
            img.src = backdropUrl;
            img.onload = () => {
                setBgLoaded(true); // fade in when data is ready
            };
        } else {
            setBgLoaded(false);
        }
    }, [backdropUrl]);

    // Separate style for the background layer
    const backgroundLayerStyle = backdropUrl
        ? {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(17,17,17,0.95) 85%, #111 100%), url(${backdropUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
            opacity: bgLoaded ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
            zIndex: 0,
            borderRadius: "12px",
        }
        : {};

    // Defensive fallbacks so missing handlers don't crash on click
    const handleMarkWatched =
        typeof onMarkWatched === "function" ? onMarkWatched : () => {};
    const handleAddToWatch =
        typeof onAddToWatch === "function" ? onAddToWatch : () => {};
    const handleLike = typeof onLike === "function" ? onLike : () => {};
    const handleDislike = typeof onDislike === "function" ? onDislike : () => {};

    // Clicking the backdrop closes the modal
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ position: "relative" }}
            >
                {/* dedicated layer */}
                <div style={backgroundLayerStyle} />

                {/* dedicated content layer too */}
                <div style={{ position: "relative", zIndex: 1 }}>

                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                    <div className="modal-header">
                        {" "}
                        {/* Use a placeholder image if no poster URL is provided */}
                        {/* Poster */}
                        <img
                            src={posterUrl || "https://placehold.co/220x330?text=No+Poster"}
                            alt={title || ""}
                            width={220}
                            height={330}
                            style={{
                                borderRadius: "12px",
                                flexShrink: 0,
                                objectFit: "cover", // Ensures image fills the box without stretching
                                boxShadow: "0 8px 25px rgba(0,0,0,0.6)", // Deeper, more professional shadow
                                border: "1px solid rgba(255, 255, 255, 0.1)", // Subtle glass-like border
                                backgroundColor: "#1a1a1a", // Dark background prevents white flashes
                            }}
                        />

                        <div style={{ flex: 1 }}>
                            {" "}
                            {/* Show year if present, rating if its not null, and runtime if present*/}
                            {/* Title / year / rating / runtime */}
                            <h2
                                style={{
                                    margin: "0 0 8px",
                                    textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                                }}
                            >
                                {title ?? "Untitled"}
                            </h2>{" "}
                            {/*add text shadow to make it easy to read on light background*/}
                            <div
                                className="muted"
                                style={{ marginBottom: 8, color: "rgba(255,255,255,0.8)" }}
                            >
                                {year ?? "—"}
                                {rating != null ? ` • ⭐ ${Number(rating).toFixed(1)}` : ""}
                                {runtimeText ? ` • ${runtimeText}` : ""}
                                {ageRating ? ` • ${ageRating}` : ""}
                            </div>

                            {/* condensed logic, list none listed for cases of no director */}
                            <div style={{ marginBottom: 12 }}>
                                <strong>
                                    {hasDirectors && directorList.length > 1
                                        ? "Directors:"
                                        : "Director:"}
                                </strong>{" "}
                                {hasDirectors ? directorList.join(", ") : "None Listed"}
                            </div>

                            {Array.isArray(genres) && genres.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <strong>Genres:</strong> {genres.join(", ")}
                                </div>
                            )}

                            {/* Only show up the top cast members */}
                            {Array.isArray(topCast) && topCast.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <strong>Top cast:</strong>{" "}
                                    {topCast
                                        .slice(
                                            0,
                                            typeof topCastCount === "number"
                                                ? topCastCount
                                                : topCast.length
                                        )
                                        .join(", ")}
                                </div>
                            )}

                            {/*where to watch icons*/}
                            {Array.isArray(watchProviders) && watchProviders.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <strong style={{ display: "block", marginBottom: 6 }}>
                                        Where to watch:
                                    </strong>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {watchProviders.map((provider, index) => {
                                            if (
                                                typeof provider === "object" &&
                                                provider.logo_path
                                            ) {
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
                                                            boxShadow:
                                                                "0 2px 4px rgba(0,0,0,0.3)",
                                                        }}
                                                    />
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.7em",
                                            opacity: 0.6,
                                            marginTop: 4,
                                        }}
                                    >
                                        Source: JustWatch
                                    </div>
                                </div>
                            )}

                            {description && (
                                <p
                                    style={{
                                        marginTop: 12,
                                        lineHeight: 1.5,
                                        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                                    }}
                                >
                                    {description}
                                </p>
                            )}

                            {/* Action buttons */}
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                {/* Buttons (swapped meanings) */}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        className={`go-btn ${
                                            !canModifyLists ? "go-btn-disabled" : ""
                                        }`}
                                        onClick={
                                            canModifyLists ? handleMarkWatched : undefined
                                        }
                                        disabled={!canModifyLists}
                                        aria-pressed={!!isWatched}
                                    >
                                        {isWatched
                                            ? "Unmark As Watched"
                                            : "Mark As Watched"}
                                    </button>

                                    <button
                                        className={`go-btn ${
                                            !canModifyLists ? "go-btn-disabled" : ""
                                        }`}
                                        onClick={
                                            canModifyLists ? handleAddToWatch : undefined
                                        }
                                        disabled={!canModifyLists}
                                        aria-pressed={!!inToWatch}
                                    >
                                        {inToWatch
                                            ? "Remove from Watch Later"
                                            : "Add to Watch Later"}
                                    </button>
                                </div>

                                {/* Like / Dislike row */}
                                {(onLike || onDislike) && (
                                    <div style={{ display: "flex", gap: 8 }}>
                                        {onLike && (
                                            <button
                                                type="button"
                                                className="go-btn"
                                                style={{
                                                    flex: 1,
                                                    fontWeight: isLiked ? 700 : 400,
                                                    backgroundColor: isLiked
                                                        ? "rgba(0, 128, 0, 0.85)" // green
                                                        : undefined,
                                                    borderColor: isLiked
                                                        ? "rgba(0, 128, 0, 0.85)"
                                                        : undefined,
                                                    color: isLiked ? "#fff" : undefined,
                                                }}
                                                onClick={handleLike}
                                                aria-pressed={!!isLiked}
                                            >
                                                {isLiked ? "Liked 👍" : "Like 👍"}
                                            </button>
                                        )}

                                        {onDislike && (
                                            <button
                                                type="button"
                                                className="go-btn"
                                                style={{
                                                    flex: 1,
                                                    fontWeight: isDisliked ? 700 : 400,
                                                    backgroundColor: isDisliked
                                                        ? "rgba(180, 0, 0, 0.85)" // red
                                                        : undefined,
                                                    borderColor: isDisliked
                                                        ? "rgba(180, 0, 0, 0.85)"
                                                        : undefined,
                                                    color: isDisliked ? "#fff" : undefined,
                                                }}
                                                onClick={handleDislike}
                                                aria-pressed={!!isDisliked}
                                            >
                                                {isDisliked
                                                    ? "Disliked 👎"
                                                    : "Dislike 👎"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}