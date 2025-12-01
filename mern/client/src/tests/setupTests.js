// src/tests/setupTests.js
import { expect, vi, beforeEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

// Add jest-dom matchers (toBeInTheDocument, etc.)
expect.extend(matchers);

// Default fetch mock so App's initial search doesn't crash
if (!global.fetch) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });
}

// Clear localStorage before each test
beforeEach(() => {
  window.localStorage.clear();
});
