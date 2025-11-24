// src/tests/SidebarCollapse.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App.jsx";
import { MemoryRouter } from "react-router-dom";

// group of tests
describe("Sidebar Collapse Behavior", () => {
    // before each test mount App to router
  beforeEach(() => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
  });
  // test 1 - sidebar expands onto screen
  test("sidebar starts expanded", () => {
    const mainContainer = screen.getByTestId("main-container");
    expect(mainContainer).not.toHaveClass("sidebar-collapsed");
  });
  // test 2 - siebar collapses on click
  test("sidebar collapses when toggle is clicked", () => {
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    const mainContainer = screen.getByTestId("main-container");

    fireEvent.click(toggleButton);

    expect(mainContainer).toHaveClass("sidebar-collapsed");
  });
  // test 3 - sidebar expands on second click
  test("sidebar expands again when toggled twice", () => {
    const toggleButton = screen.getByLabelText(/toggle sidebar/i);
    const mainContainer = screen.getByTestId("main-container");

    // collapse
    fireEvent.click(toggleButton);
    expect(mainContainer).toHaveClass("sidebar-collapsed");

    // expand
    fireEvent.click(toggleButton);
    expect(mainContainer).not.toHaveClass("sidebar-collapsed");
  });
  // test 4 - movie grid still displays with or without sidebar
  test("content area is always in the DOM", () => {
    const contentArea = screen.getByTestId("content-area");
    expect(contentArea).toBeInTheDocument();
  });
});
