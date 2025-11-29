// src/tests/MovieDetails.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MovieDetails from "../components/MovieDetails.jsx";

const sampleMovie = {
  id: 1,
  title: "Interstellar",
  year: 2014,
  rating: 8.6,
  genres: ["Adventure", "Drama", "Sci-Fi"],
  description: "A team travels through a wormhole in search of a new home for humanity.",
  runtime: 169,
  director: ["Christopher Nolan"],
  topCast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
  topCastCount: 3,
  posterUrl: null,
  backdropUrl: null,
  watchProviders: [
    { provider_name: "Netflix", logo_path: "/netflix.png" },
    { provider_name: "Hulu", logo_path: "/hulu.png" }
  ],
};
// test suite
describe("MovieDetails Component", () => {
  // Test 1: nothing to render when no movie details
  it("renders nothing if no details are provided", () => {
    const { container } = render(<MovieDetails />);
    expect(container.firstChild).toBeNull();
  });

  // Test 2: render all details for movie
  it("renders all movie details", () => {
    render(<MovieDetails details={sampleMovie} />);

    expect(screen.getByText(/Interstellar/i)).toBeInTheDocument();
    expect(screen.getByText(/2014/i)).toBeInTheDocument();
    expect(screen.getByText(/⭐ 8.6/i)).toBeInTheDocument();
    expect(screen.getByText(/Adventure, Drama, Sci-Fi/i)).toBeInTheDocument();
    expect(screen.getByText(/Christopher Nolan/i)).toBeInTheDocument();
    expect(screen.getByText(/Matthew McConaughey, Anne Hathaway, Jessica Chastain/i)).toBeInTheDocument();
    expect(screen.getByText(/2h 49m/i)).toBeInTheDocument(); 

    // description
    expect(screen.getByText(sampleMovie.description)).toBeInTheDocument();

    // streaming providers
    sampleMovie.watchProviders.forEach(provider => {
      expect(screen.getByAltText(provider.provider_name)).toBeInTheDocument();
    });
  });

  // Test 3: Display watched and toWatch buttons depending on status of movie
  it("shows correct buttons depending on isWatched / inToWatch props", () => {
    const { rerender } = render(<MovieDetails details={sampleMovie} isWatched={false} inToWatch={false} />);
    expect(screen.getByRole("button", { name: /Add to Watched List/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save for Later/i })).toBeInTheDocument();

    rerender(<MovieDetails details={sampleMovie} isWatched={true} inToWatch={true} />);
    expect(screen.getByRole("button", { name: /Remove from Watched List/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove from To-Watch List/i })).toBeInTheDocument();
  });

  // Test 4: can close modal with x and backdrop
  it("calls onClose when backdrop or close button is clicked", () => {
    const onClose = vi.fn();
    render(<MovieDetails details={sampleMovie} onClose={onClose} />);
    
    // close button
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // backdrop click
    onClose.mockReset();
    fireEvent.click(screen.getByText(/Interstellar/i).closest(".modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Test 5: add to watched or ToWatch list if button clicked
  it("calls onMarkWatched and onAddToWatch when buttons are clicked", () => {
    const onMarkWatched = vi.fn();
    const onAddToWatch = vi.fn();
    render(<MovieDetails details={sampleMovie} onMarkWatched={onMarkWatched} onAddToWatch={onAddToWatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Add to Watched List/i }));
    expect(onMarkWatched).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Save for Later/i }));
    expect(onAddToWatch).toHaveBeenCalledTimes(1);
  });

  // Test 6: don't render where to watch if no streaming providers
  it("renders correctly when watchProviders is empty", () => {
    const movieNoProviders = { ...sampleMovie, watchProviders: [] };
    render(<MovieDetails details={movieNoProviders} />);
    
    // there shouldn't be any watch provider images
    expect(screen.queryByAltText(/Netflix/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText(/Hulu/i)).not.toBeInTheDocument();
    
    // the "Where to watch:" text isn't rendered
    expect(screen.queryByText(/Where to watch/i)).not.toBeInTheDocument();
  });

});
