// src/components/MovieDetails.jsx
import React from "react";

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
}) {
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
    runtime,
    director,
  } = details;

  const runtimeText = formatRuntime(runtime);

  // Defensive fallbacks so missing handlers don't crash on click
  const handleMarkWatched =
    typeof onMarkWatched === "function" ? onMarkWatched : () => {};
  const handleAddToWatch =
    typeof onAddToWatch === "function" ? onAddToWatch : () => {};
  const handleLike = typeof onLike === "function" ? onLike : () => {};
  const handleDislike = typeof onDislike === "function" ? onDislike : () => {};

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="modal-header">
          {/* Poster */}
          <img
            src={posterUrl || "https://placehold.co/220x330?text=No+Poster"}
            alt={title || ""}
            width={220}
            height={330}
            style={{ borderRadius: 8, flexShrink: 0 }}
          />

          <div style={{ flex: 1 }}>
            {/* Title / year / rating / runtime */}
            <h2 style={{ margin: "0 0 8px" }}>{title ?? "Untitled"}</h2>
            <div className="muted" style={{ marginBottom: 8 }}>
              {year ?? "—"}
              {rating != null ? ` • ⭐ ${rating}` : ""}
              {runtimeText ? ` • ${runtimeText}` : ""}
            </div>

            {Array.isArray(director) && director.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong>Director(s):</strong> {director.join(", ")}
              </div>
            )}

            {Array.isArray(genres) && genres.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong>Genres:</strong> {genres.join(", ")}
              </div>
            )}

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

            {description && (
              <p style={{ marginTop: 12, lineHeight: 1.5 }}>{description}</p>
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
              {/* Watched / To-watch */}
              <button
                type="button"
                className="go-btn"
                onClick={handleMarkWatched}
                aria-pressed={!!isWatched}
              >
                {isWatched ? "Remove from Watched List" : "Add to Watched List"}
              </button>

              <button
                type="button"
                className="go-btn"
                onClick={handleAddToWatch}
                aria-pressed={!!inToWatch}
              >
                {inToWatch ? "Remove from To-Watch List" : "Save for Later"}
              </button>

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
                      {isDisliked ? "Disliked 👎" : "Dislike 👎"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
