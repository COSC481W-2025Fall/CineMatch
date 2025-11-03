import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";     // utilities to render react components
import { MemoryRouter } from "react-router-dom";        // fake, self-contained router, not a real browser
import Help from "../components/Help";

// test suite
describe("Help Component", () => {
  // test 1 - render nav bar  
  it("renders navigation bar correctly", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    // verify top nav buttons and logo
    expect(screen.getByText("SEARCH")).toBeInTheDocument();
    expect(screen.getByText("HELP")).toBeInTheDocument();
    expect(screen.getByText("FEED")).toBeInTheDocument();
    expect(screen.getByText("WATCHED LIST")).toBeInTheDocument();
    expect(screen.getByText("TO-WATCH LIST")).toBeInTheDocument();
    expect(screen.getByText("cineMatch")).toBeInTheDocument();
  });

  // test 2 - render help header text
  it("renders help header text", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    expect(screen.getByText("Welcome to the Help Center!")).toBeInTheDocument();
    expect(
      screen.getByText(/Need a hand\? Click a button below/i)
    ).toBeInTheDocument();
  });

  // test 3 - click search button
  it("shows search info when 'Search' button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    expect(
      screen.getByText(/use the search page to filter movies/i)
    ).toBeInTheDocument();
  });

  // test 4 - click feed button
  it("shows feed info when 'Feed' button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const feedButton = screen.getByText("Feed");
    fireEvent.click(feedButton);

    expect(
      screen.getByText(/The main feed provides personalized movie recommendations/i)
    ).toBeInTheDocument();
  });

  // test 5 - click watchlist button
  it("shows watchlist info when 'Watchlist' button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const watchlistButton = screen.getByText("Watchlist");
    fireEvent.click(watchlistButton);

    expect(
      screen.getByText(/Your Watched List helps you keep a running history/i)
    ).toBeInTheDocument();
  });

  // test 6 - click to-watch list button
  it("shows to-watch info when 'To-Watch List' button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const toWatchButton = screen.getByText("To-Watch List");
    fireEvent.click(toWatchButton);

    expect(
      screen.getByText(/Use the To-Watch List as a bookmark/i)
    ).toBeInTheDocument();
  });

  // test 7 - click json file button
  it("shows upload/download info when 'Uploading/Downloading Json file' button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const uploadButton = screen.getByText("Uploading/Downloading Json file");
    fireEvent.click(uploadButton);

    expect(
      screen.getByText(/The data for both your Watched List and To-Watch List is stored locally/i)
    ).toBeInTheDocument();
  });

  // test 8 - change button color when clicked
  it("applies active style when button is clicked", () => {
    render(
      <MemoryRouter>
        <Help />
      </MemoryRouter>
    );

    const searchButton = screen.getByText("Search");
    fireEvent.click(searchButton);

    // verify active button has inline background style
    expect(searchButton).toHaveStyle(
      "background: linear-gradient(45deg,#f7e135,#cc8800)"
    );
  });
});
