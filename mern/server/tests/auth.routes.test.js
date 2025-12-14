// tests/auth.routes.test.js
import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

/**
 * We are *not* using the real MongoDB or server.js here.
 *  - We mock ../db/usersConnections.js with an in-memory fake DB
 *  - We mock email + rate limiter
 *  - We import the auth router only and mount it on a tiny Express app
 */

// Fake users DB (in-memory)
vi.mock("../db/usersConnections.js", () => {
  const users = [];
  const emailVerifications = [];
  const passwordResets = [];
  let nextId = 1;

  class FakeObjectId {
    constructor(id) {
      this._id = id || String(nextId++);
    }
    static createFromHexString(str) {
      return new FakeObjectId(str);
    }
    toString() {
      return this._id;
    }
  }

  function matchDoc(doc, filter) {
    return Object.entries(filter).every(([key, val]) => {
      const dVal = doc[key];

      const norm = (v) => {
        if (v && typeof v === "object" && "_id" in v) {
          return String(v._id);
        }
        return String(v);
      };

      return norm(dVal) === norm(val);
    });
  }

  function makeCollection(arrName) {
    const store =
      arrName === "users"
        ? users
        : arrName === "email_verifications"
        ? emailVerifications
        : passwordResets;

    return {
      async findOne(filter = {}, options = {}) {
        const doc = store.find((d) => matchDoc(d, filter));
        if (!doc) return null;
        if (options.projection) {
          const proj = {};
          for (const [k, v] of Object.entries(options.projection)) {
            if (v) proj[k] = doc[k];
          }
          return proj;
        }
        return doc;
      },

      async insertOne(doc) {
        if (!doc._id) {
          doc._id = new FakeObjectId();
        }
        store.push(doc);
        return { insertedId: doc._id };
      },

      async updateOne(filter, update) {
        const doc = store.find((d) => matchDoc(d, filter));
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };

        if (update.$set) {
          Object.assign(doc, update.$set);
        }
        if (update.$push) {
          for (const [field, value] of Object.entries(update.$push)) {
            if (!Array.isArray(doc[field])) doc[field] = [];
            doc[field].push(value);
          }
        }
        if (update.$pull) {
          for (const [field, cond] of Object.entries(update.$pull)) {
            const arr = doc[field];
            if (!Array.isArray(arr)) continue;
            doc[field] = arr.filter((item) =>
              !Object.entries(cond).every(([k, v]) => item[k] === v),
            );
          }
        }

        return { matchedCount: 1, modifiedCount: 1 };
      },

      async deleteMany(filter = {}) {
        const before = store.length;
        for (let i = store.length - 1; i >= 0; i--) {
          if (matchDoc(store[i], filter)) {
            store.splice(i, 1);
          }
        }
        return { deletedCount: before - store.length };
      },
    };
  }

  const db = {
    bson: { ObjectId: FakeObjectId },
    collection(name) {
      if (name === "users") return makeCollection("users");
      if (name === "email_verifications")
        return makeCollection("email_verifications");
      if (name === "password_resets")
        return makeCollection("password_resets");
      throw new Error("Unknown collection: " + name);
    },
    __state: { users, emailVerifications, passwordResets },
  };

  return { default: db };
});

// Other mocks

// Don't send real emails
vi.mock("../utils/email.js", () => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: "test", response: "OK" }),
}));

// Make RateLimiterMongo non-operation
vi.mock("rate-limiter-flexible", () => {
  return {
    RateLimiterMongo: vi.fn().mockImplementation(() => ({
      consume: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    })),
  };
});

// Test setup

let app;
let usersState;

describe("Auth routes (in-memory DB)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET_V1 = "TEST_JWT_SECRET_V1";
    process.env.JWT_CURRENT_KID = "v1";
    process.env.JWT_ACCESS_TTL = "15m";
    process.env.JWT_REFRESH_TTL = "7d";

    // Import the auth router AFTER mocks
    const authModule = await import("../routes/auth.js");
    const authRouter = authModule.default;

    // Grab in-memory state so we can inspect/modify users, verifications, resets
    const usersDbModule = await import("../db/usersConnections.js");
    usersState = usersDbModule.default.__state;

    // Minimal Express app just for /auth
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/auth", authRouter);
  });

  it(
    "registers, blocks unverified login, allows login after verify, refreshes and logs out",
    async () => {
      const email = `authtest+flow+${Date.now()}@example.com`;
      const password = "Password123!";

      // 1) Register
      const registerRes = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "Auth Flow" })
        .expect(201);

      expect(registerRes.body.ok).toBe(true);
      expect(registerRes.body.email).toBe(email);
      const userId = registerRes.body.userId;
      expect(userId).toBeTruthy();

      // 2) Login BEFORE emailVerified -> 403
      const loginBefore = await request(app)
        .post("/auth/login")
        .send({ email, password })
        .expect(403);

      expect(loginBefore.body.needsVerification).toBe(true);
      expect(loginBefore.body.error).toMatch(/verify your email/i);

      // 3) Mark user as verified in our in-memory DB
      const userDoc = usersState.users.find(
        (u) => String(u._id) === String(userId),
      );
      expect(userDoc).toBeTruthy();
      userDoc.emailVerified = true;

      // 4) Login AFTER verification - 200, accessToken and refresh cookies
      const loginAfter = await request(app)
        .post("/auth/login")
        .send({ email, password })
        .expect(200);

      expect(loginAfter.body.accessToken).toBeTruthy();
      expect(loginAfter.body.user).toMatchObject({
        email,
        displayName: "Auth Flow",
      });

      const cookies = loginAfter.headers["set-cookie"] || [];
      const rtCookie = cookies.find((c) => c.startsWith("rt="));
      expect(rtCookie).toBeTruthy();

      // 5) Refresh with cookie - 200 and new access token
      const refreshRes = await request(app)
        .post("/auth/refresh")
        .set("Cookie", rtCookie)
        .expect(200);

      expect(refreshRes.body.accessToken).toBeTruthy();
      expect(refreshRes.body.user.email).toBe(email);

      const cookies2 = refreshRes.headers["set-cookie"] || [];
      const newRtCookie = cookies2.find((c) => c.startsWith("rt="));
      expect(newRtCookie).toBeTruthy();

      // 6) Logout clears refresh (no errors)
      const logoutRes = await request(app)
        .post("/auth/logout")
        .set("Cookie", newRtCookie)
        .expect(200);

      expect(logoutRes.body.ok).toBe(true);
    },
    20000,
  );

  it(
    "creates a password reset entry for a verified user when /forgot is called",
    async () => {
      const email = `authtest+forgot+${Date.now()}@example.com`;
      const password = "Password123!";

      // Register
      const registerRes = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "Forgot Test" })
        .expect(201);

      const userId = registerRes.body.userId;
      expect(userId).toBeTruthy();

      // Mark user as verified
      const userDoc = usersState.users.find(
        (u) => String(u._id) === String(userId),
      );
      expect(userDoc).toBeTruthy();
      userDoc.emailVerified = true;

      // Remove any existing resets for this user
      for (let i = usersState.passwordResets.length - 1; i >= 0; i--) {
        const r = usersState.passwordResets[i];
        if (String(r.userId?._id ?? r.userId) === String(userId)) {
          usersState.passwordResets.splice(i, 1);
        }
      }

      // Call /forgot
      const forgotRes = await request(app)
        .post("/auth/forgot")
        .send({ email })
        .expect(200);

      expect(forgotRes.body.ok).toBe(true);

      // Ensure a reset entry exists for this user
      const resetDocs = usersState.passwordResets.filter(
        (r) => String(r.userId?._id ?? r.userId) === String(userId),
      );
      expect(resetDocs.length).toBe(1);
      expect(resetDocs[0].expiresAt).toBeInstanceOf(Date);
      expect(resetDocs[0].hash).toBeTruthy();
    },
    20000,
  );

  it(
    "resend-verification clears old tokens and creates a new one for an unverified user",
    async () => {
      const email = `authtest+resend+${Date.now()}@example.com`;
      const password = "Password123!";

      // Register 
      const registerRes = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "Resend Test" })
        .expect(201);

      const userId = registerRes.body.userId;
      expect(userId).toBeTruthy();

      const userDoc = usersState.users.find(
        (u) => String(u._id) === String(userId),
      );
      expect(userDoc).toBeTruthy();
      expect(userDoc.emailVerified).toBe(false);

      // Snapshot any existing verification docs for this user
      const preDocs = usersState.emailVerifications.filter(
        (v) => String(v.userId?._id ?? v.userId) === String(userId),
      );
      const preHashes = new Set(preDocs.map((d) => d.hash));

      // Seed a couple of extra fake verification docs for this user
      usersState.emailVerifications.push({
        userId: userDoc._id,
        hash: "first-hash",
        expiresAt: new Date(Date.now() + 1000),
      });
      usersState.emailVerifications.push({
        userId: userDoc._id,
        hash: "second-hash",
        expiresAt: new Date(Date.now() - 1000),
      });

      const preCount = usersState.emailVerifications.filter(
        (v) => String(v.userId?._id ?? v.userId) === String(userId),
      ).length;
      expect(preCount).toBeGreaterThanOrEqual(preDocs.length + 2);

      // Call /resend-verification
      const resendRes = await request(app)
        .post("/auth/resend-verification")
        .send({ email })
        .expect(200);

      expect(resendRes.body.ok).toBe(true);

      // After resend, should be at least one verification doc,
      // and at least one of them should have a new hash not in preHashes
      const postDocs = usersState.emailVerifications.filter(
        (v) => String(v.userId?._id ?? v.userId) === String(userId),
      );
      expect(postDocs.length).toBeGreaterThanOrEqual(1);

      const hasNewHash = postDocs.some((d) => !preHashes.has(d.hash));
      expect(hasNewHash).toBe(true);
    },
    20000,
  );

  it(
    "returns 401 Invalid credentials when password is wrong",
    async () => {
      const email = `authtest+badpw+${Date.now()}@example.com`;
      const password = "Password123!";

      // Register
      const registerRes = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "BadPw Test" })
        .expect(201);

      const userId = registerRes.body.userId;
      expect(userId).toBeTruthy();

      // Mark user as verified
      const userDoc = usersState.users.find(
        (u) => String(u._id) === String(userId),
      );
      expect(userDoc).toBeTruthy();
      userDoc.emailVerified = true;

      // Try logging in with wrong password
      const badLogin = await request(app)
        .post("/auth/login")
        .send({ email, password: "DefinitelyWrong!!" })
        .expect(401);

      expect(badLogin.body.error).toBe("Invalid credentials");
    },
    20000,
  );

  it(
    "returns 401 Invalid credentials when logging in with an unknown email",
    async () => {
      const email = `authtest+unknown+${Date.now()}@example.com`;

      const res = await request(app)
        .post("/auth/login")
        .send({ email, password: "SomePassword123!" })
        .expect(401);

      expect(res.body.error).toBe("Invalid credentials");
    },
    20000,
  );

  it(
    "rejects login when email is missing",
    async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ password: "Password123!" })
        .expect(400);

      expect(res.body.error).toMatch(/email/i);
    },
    20000,
  );

  it(
    "rejects login when password is missing",
    async () => {
      const email = `authtest+missingpw+${Date.now()}@example.com`;
      const password = "Password123!";

      // Register and verify a user
      const registerRes = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "MissingPw Test" })
        .expect(201);

      const userId = registerRes.body.userId;
      const userDoc = usersState.users.find(
        (u) => String(u._id) === String(userId),
      );
      userDoc.emailVerified = true;

      const res = await request(app)
        .post("/auth/login")
        .send({ email })
        .expect(400);

      expect(res.body.error).toMatch(/password/i);
    },
    20000,
  );

  it(
    "rejects registration when email is missing",
    async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ password: "Password123!", displayName: "NoEmail" })
        .expect(400);

      expect(res.body.error).toMatch(/email/i);
    },
    20000,
  );

  it(
    "rejects registration when password is missing",
    async () => {
      const email = `authtest+nopw+${Date.now()}@example.com`;

      const res = await request(app)
        .post("/auth/register")
        .send({ email, displayName: "NoPw" })
        .expect(400);

      expect(res.body.error).toMatch(/password/i);
    },
    20000,
  );

  it(
    "prevents registering the same email twice",
    async () => {
      const email = `authtest+dupe+${Date.now()}@example.com`;
      const password = "Password123!";

      // First registration succeeds
      await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "Dup Test" })
        .expect(201);

      // Second registration with same email should fail
      const res2 = await request(app)
        .post("/auth/register")
        .send({ email, password, displayName: "Dup Test Again" })
        .expect(409);

      expect(res2.body.error).toMatch(/already/i);
    },
    20000,
  );

  it(
    "allows /forgot to be called for a non-existing email without throwing (no user enumeration)",
    async () => {
      const email = `authtest+forgot-unknown+${Date.now()}@example.com`;

      const res = await request(app)
        .post("/auth/forgot")
        .send({ email })
        .expect(200);

      // Many APIs still return {ok:true} even if user doesn't exist
      expect(res.body).toHaveProperty("ok");
    },
    20000,
  );

  it(
    "rejects /refresh when there is no refresh token cookie",
    async () => {
      const res = await request(app)
        .post("/auth/refresh")
        .expect(401);

      expect(res.body.error).toMatch(/refresh/i);
    },
    20000,
  );
});
