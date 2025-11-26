import React from "react";
import { render, screen, fireEvent, waitFor} from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import App from "../App.jsx";
import { vi } from "vitest";

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (typeof url === "string" && url.startsWith("/record?")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              id: 1,
              title: "Inception",
              year: 2010,
              genre: ["Action"],
              rating: 8.8,
              posterUrl: "",
            },
          ]),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  });
});

afterEach(() => {
  vi.resetAllMocks();
});
// test suite
describe("Chip tests", () => {
  // Test 1: verify chips created upon search results
  it("creates chips for title, director, actor, year, rating, and genre", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // fill text inputs
    fireEvent.change(screen.getByPlaceholderText("ACTOR..."), {
      target: { value: "Leonardo DiCaprio" },
    });
    fireEvent.change(screen.getByPlaceholderText("DIRECTOR..."), {
      target: { value: "Christopher Nolan" },
    });
    fireEvent.change(screen.getByPlaceholderText("TITLE..."), {
      target: { value: "Inception" },
    });

    // min/max for year and rating
    const [yearMinInput, ratingMinInput] = screen.getAllByPlaceholderText("MIN");
    const [yearMaxInput, ratingMaxInput] = screen.getAllByPlaceholderText("MAX");

    fireEvent.change(yearMinInput, { target: { value: "2010" } });
    fireEvent.change(yearMaxInput, { target: { value: "2010" } });
    fireEvent.change(ratingMinInput, { target: { value: "8" } });
    fireEvent.change(ratingMaxInput, { target: { value: "10" } });

    // open genre dropdown and select action
    fireEvent.click(screen.getByText(/GENRE\.\.\./i));
    const actionCheckbox = screen.getByLabelText(/Action/i);
    fireEvent.click(actionCheckbox);

    // click the search button
    fireEvent.click(screen.getByRole("button", { name: "SEARCH" }));

    // wait for chips to appear
    expect(await screen.findByText(/Title: Inception/i)).toBeInTheDocument();
    expect(await screen.findByText(/Director: Christopher Nolan/i)).toBeInTheDocument();
    expect(await screen.findByText(/Actor: Leonardo DiCaprio/i)).toBeInTheDocument();
    expect(await screen.findByText(/Year ≥ 2010/)).toBeInTheDocument();
    expect(await screen.findByText(/Year ≤ 2010/)).toBeInTheDocument();
    expect(await screen.findByText(/Rating ≥ 8/)).toBeInTheDocument();
    expect(await screen.findByText(/Rating ≤ 10/)).toBeInTheDocument();
    expect(await screen.findByText(/Genre: Action/i)).toBeInTheDocument();
  });
    // Test 2: delete chips
    it("removes chips when the X is clicked", async () => {
    render(
        <BrowserRouter>
        <App />
        </BrowserRouter>
    );

    // fill inputs and select genre 
    fireEvent.change(screen.getByPlaceholderText("ACTOR..."), {
        target: { value: "Leonardo DiCaprio" },
    });
    fireEvent.change(screen.getByPlaceholderText("DIRECTOR..."), {
        target: { value: "Christopher Nolan" },
    });
    fireEvent.change(screen.getByPlaceholderText("TITLE..."), {
        target: { value: "Inception" },
    });

    const [yearMinInput, ratingMinInput] = screen.getAllByPlaceholderText("MIN");
    const [yearMaxInput, ratingMaxInput] = screen.getAllByPlaceholderText("MAX");

    fireEvent.change(yearMinInput, { target: { value: "2010" } });
    fireEvent.change(yearMaxInput, { target: { value: "2010" } });
    fireEvent.change(ratingMinInput, { target: { value: "8" } });
    fireEvent.change(ratingMaxInput, { target: { value: "10" } });

    const genreHeader = screen.getByText(/GENRE\.\.\./i);
    fireEvent.click(genreHeader);
    fireEvent.click(screen.getByText("Action"));

    // search
    fireEvent.click(screen.getByRole("button", { name: "SEARCH" }));

    // wait for chips to appear
    const actorChip = await screen.findByText(/Actor: Leonardo DiCaprio/i);
    const genreChip = await screen.findByText(/Genre: Action/i);

    // remove actor chip
    const actorX = actorChip.nextSibling; // the × button
    fireEvent.click(actorX);

    expect(screen.queryByText(/Actor: Leonardo DiCaprio/i)).not.toBeInTheDocument();

    // remove genre chip
    const genreX = genreChip.nextSibling;
    fireEvent.click(genreX);

    expect(screen.queryByText(/Genre: Action/i)).not.toBeInTheDocument();
  });
    // Test 3: new search automatically after chip is deleted
    it("removes chip and triggers new search", async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // fill in inputs and select genre
    fireEvent.change(screen.getByPlaceholderText("TITLE..."), {
      target: { value: "Inception" },
    });
    fireEvent.change(screen.getByPlaceholderText("ACTOR..."), {
      target: { value: "Leonardo DiCaprio" },
    });
    fireEvent.change(screen.getByPlaceholderText("DIRECTOR..."), {
      target: { value: "Christopher Nolan" },
    });

    // click search
    fireEvent.click(screen.getByRole("button", { name: "SEARCH" }));

    // wait for chips to appear
    const titleChip = await screen.findByText(/Title: Inception/i);
    const actorChip = await screen.findByText(/Actor: Leonardo DiCaprio/i);

    expect(titleChip).toBeInTheDocument();
    expect(actorChip).toBeInTheDocument();

    // Rremove the actor chip by clicking the X
    const actorChipButton = actorChip.closest("button");
    fireEvent.click(actorChipButton);

    // wait for UI to update after removal
    await waitFor(() => {
      expect(screen.queryByText(/Actor: Leonardo DiCaprio/i)).not.toBeInTheDocument();
    });

    // the other chips remain
    expect(screen.getByText(/Title: Inception/i)).toBeInTheDocument();

    // make sure fetch was called again with updated chips (without actor)
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[1][0]).not.toContain("Leonardo DiCaprio");
  });

});
