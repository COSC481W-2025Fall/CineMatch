// src/tests/MovieDetails.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";     // utilities to render react components
import MovieDetails from "../components/MovieDetails";

// test suite
describe("MovieDetails Component", () => {
  // mock movie   
  const mockDetails = {
    title: "Interstellar",
    year: 2014,
    rating: 8.6,
    posterUrl: "https://test.poster/interstellar.jpg",
    description: "A team travels through a wormhole in search of a new home for humanity.",
    topCast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain", "Michael Caine"],
    genres: ["Adventure", "Drama", "Sci-Fi"],
  };
  // test 1 - app renders nothing when movie has no details
  it("renders nothing when no details are provided", () => {
    const { container } = render(<MovieDetails details={null} />);
    expect(container.firstChild).toBeNull();
  });
  // test 2 - app render movie details when provided
  it("renders movie details correctly", () => {
    render(
      <MovieDetails
        details={mockDetails}
        onClose={() => {}}
        isWatched={false}
        inToWatch={false}
        onMarkWatched={() => {}}
        onAddToWatch={() => {}}
      />
    );

    // check for title, year, and rating
    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText(/2014/i)).toBeInTheDocument();
    expect(screen.getByText(/⭐ 8.6/i)).toBeInTheDocument();

    // check genres, cast, and description
    expect(screen.getByText(/Genres:/i)).toBeInTheDocument();
    expect(screen.getByText(/Adventure, Drama, Sci-Fi/i)).toBeInTheDocument();
    expect(screen.getByText(/Top cast:/i)).toBeInTheDocument();
    expect(screen.getByText(/Matthew McConaughey/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A team travels through a wormhole/i)
    ).toBeInTheDocument();
  });
  // test 3 - clicking backdrop closes modal
  it("calls onClose when backdrop is clicked", () => {
    const mockClose = vi.fn();      // mock close function

    // render modal
    render(
      <MovieDetails
        details={mockDetails}
        onClose={mockClose}
        isWatched={false}
        inToWatch={false}
        onMarkWatched={() => {}}
        onAddToWatch={() => {}}
      />
    );
    // locate backdrop, simulate clicking backdrop, assert backdrop clicked
    const backdrop = screen.getByRole("button", { name: /close/i }).parentElement.parentElement;
    fireEvent.click(backdrop);
    expect(mockClose).toHaveBeenCalled();
  });
  // test 4 - clicking close button closes modal, similar to test 3, but explicitly press the 'x' in top right corner not backdrop
  it("calls onClose when close button is clicked", () => {
    const mockClose = vi.fn();      // mock close function

    // render modal
    render(
      <MovieDetails
        details={mockDetails}
        onClose={mockClose}
        isWatched={false}
        inToWatch={false}
        onMarkWatched={() => {}}
        onAddToWatch={() => {}}
      />
    );
    // locate close button, simulate clicking 'x', assert 'x' clicked
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(mockClose).toHaveBeenCalled();
  });
  // test 5 - clicking 'Watched?' calls handler
  it("calls onMarkWatched when 'Watched?' is clicked", () => {
    const mockMarkWatched = vi.fn();    // mock markWatched function

    // render movie modal
    render(
      <MovieDetails
        details={mockDetails}
        onClose={() => {}}
        isWatched={false}
        inToWatch={false}
        onMarkWatched={mockMarkWatched}
        onAddToWatch={() => {}}
      />
    );
    // simulate clicking 'watched', assert handler invoked
    fireEvent.click(screen.getByText(/Watched\?/i));
    expect(mockMarkWatched).toHaveBeenCalled();
  });
  // test 6 - clicking 'Add to To-Watch list' calls handler
  it("calls onAddToWatch when 'Add to To-Watch list' is clicked", () => {
    const mockAddToWatch = vi.fn();     // mock addToWatch function

    // render modal
    render(
      <MovieDetails
        details={mockDetails}
        onClose={() => {}}
        isWatched={false}
        inToWatch={false}
        onMarkWatched={() => {}}
        onAddToWatch={mockAddToWatch}
      />
    );
    // simulate clicking watched, assert handler invoked
    fireEvent.click(screen.getByText(/Add to To-Watch list/i));
    expect(mockAddToWatch).toHaveBeenCalled();
  });
  // test 7 - buttons disabled when already added/watched movie
  it("disables buttons when already watched or in to-watch", () => {

    // render movie modal
    render(
      <MovieDetails
        details={mockDetails}
        onClose={() => {}}
        isWatched={true}
        inToWatch={true}
        onMarkWatched={() => {}}
        onAddToWatch={() => {}}
      />
    );
    // verify buttons' text changes to 'Added!' and are disabled
    const [watchedButton, addButton] = screen.getAllByText(/Added!/i);
    expect(watchedButton).toBeDisabled();
    expect(addButton).toBeDisabled();

  });
});
