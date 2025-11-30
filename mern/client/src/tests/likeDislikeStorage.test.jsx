// src/tests/likeDislikeStorage.test.jsx
import { describe, test, expect, beforeEach } from "vitest";
import {
  getLikedTmdbIds,
  getDislikedTmdbIds,
  addLikedTmdbId,
  addDislikedTmdbId
} from "../components/likeDislikeStorage.js";

// simple mock for browser localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = value.toString();
  }
  removeItem(key) {
    delete this.store[key];
  }
}
// group tests
describe("likeDislikeStorage", () => {
  // reset localstorage each test
  beforeEach(() => {
    global.localStorage = new LocalStorageMock(); // mock localStorage
  });
  // test 1
  test("getLikedTmdbIds returns an empty array if nothing stored", () => {
    expect(getLikedTmdbIds()).toEqual([]);
  });
  // test 2
  test("getDislikedTmdbIds returns an empty array if nothing stored", () => {
    expect(getDislikedTmdbIds()).toEqual([]);
  });
  // test 3
  test("addLikedTmdbId stores a new ID", () => {
    addLikedTmdbId(123);
    expect(getLikedTmdbIds()).toEqual([123]);
  });
  // test 4
  test("addLikedTmdbId does not add duplicates", () => {
    addLikedTmdbId(123);
    addLikedTmdbId(123);
    expect(getLikedTmdbIds()).toEqual([123]);
  });
  // test 5
  test("addLikedTmdbId ignores invalid values", () => {
    addLikedTmdbId(null);
    addLikedTmdbId(undefined);
    addLikedTmdbId("abc");
    expect(getLikedTmdbIds()).toEqual([]);
  });
  // test 6
  test("addDislikedTmdbId stores a new ID", () => {
    addDislikedTmdbId(456);
    expect(getDislikedTmdbIds()).toEqual([456]);
  });
  // test 7
  test("addDislikedTmdbId does not add duplicates", () => {
    addDislikedTmdbId(456);
    addDislikedTmdbId(456);
    expect(getDislikedTmdbIds()).toEqual([456]);
  });
  // test 8
  test("addDislikedTmdbId ignores invalid values", () => {
    addDislikedTmdbId(null);
    addDislikedTmdbId(undefined);
    addDislikedTmdbId("abc");
    expect(getDislikedTmdbIds()).toEqual([]);
  });
  // test 9
  test("stored IDs are normalized to numbers", () => {
    addLikedTmdbId("789");
    expect(getLikedTmdbIds()).toEqual([789]);
  });
});
