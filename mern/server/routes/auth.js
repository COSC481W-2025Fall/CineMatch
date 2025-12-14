// routes/auth.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { RateLimiterMongo } from "rate-limiter-flexible";
import { ObjectId } from "mongodb";
import usersDb from "../db/usersConnections.js";
import { sendMail } from "../utils/email.js";
import { newRawToken, hashToken, tokenMatches } from "../utils/oneTimeToken.js";

const Users = usersDb.collection("users");
const EmailVerifications = usersDb.collection("email_verifications");
const PasswordResets = usersDb.collection("password_resets");

const router = Router();

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || "7d";
const isProd = process.env.NODE_ENV === "production";


const SERVER_ORIGIN = process.env.SERVER_ORIGIN || "http://localhost:5050";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";


function userIdToString(id) {
    if (!id) return "";
    if (typeof id === "string") return id;
    if (typeof id.toHexString === "function") return id.toHexString();
    if (typeof id.toString === "function") return id.toString();
    return String(id);
}

/* ACTIVE_KEYS holds all active secrets */
const ACTIVE_KEYS = (() => {
    const map = {};
    if (process.env.JWT_SECRET_V1) map.v1 = process.env.JWT_SECRET_V1;
    if (process.env.JWT_SECRET_V2) map.v2 = process.env.JWT_SECRET_V2;
    if (!Object.keys(map).length && process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET) {
        map.v1 = process.env.JWT_ACCESS_SECRET; // fallback single key
    }
    return map;
})();
const CURRENT_KID = process.env.JWT_CURRENT_KID || (process.env.JWT_SECRET_V1 ? "v1" : "v1");

// Sign a JWT with the current key id (kid) and TTL
function signWithKid(payload, ttl) {
    const secret = ACTIVE_KEYS[CURRENT_KID];
    if (!secret) throw new Error("Missing JWT secret for CURRENT_KID");
    return jwt.sign(payload, secret, {
        header: { kid: CURRENT_KID, typ: "JWT" },
        expiresIn: ttl,
    });
}
// Verify a JWT by reading its kid from the header
function verifyByKid(token) {
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header?.kid || "v1";
    const secret = ACTIVE_KEYS[kid];
    if (!secret) throw new Error("Unknown JWT kid");
    return jwt.verify(token, secret);
}
// Access token: short-lived, basic user identity
/*function signAccess(user) {
    return signWithKid({ email: user.email, sub: String(user._id) }, ACCESS_TTL);
}*/
// Refresh token: longer-lived, includes a jti (token id)
/*function signRefresh(user, jti) {
    return signWithKid({ email: user.email, sub: String(user._id), jti }, REFRESH_TTL);
}*/


function signAccess(user) {
    return signWithKid(
        { email: user.email, sub: userIdToString(user._id) },
        ACCESS_TTL
    );
}

function signRefresh(user, jti) {
    return signWithKid(
        { email: user.email, sub: userIdToString(user._id), jti },
        REFRESH_TTL
    );
}

/* Refresh token helpers */
async function storeRefresh(userId, jti, rawToken) {
    const hash = await bcrypt.hash(rawToken, 12);
    await Users.updateOne(
        { _id: userId },
        { $push: { refreshTokens: { jti, hash, createdAt: new Date() } } }
    );
}
async function removeRefresh(userId, rawToken) {
    const user = await Users.findOne({ _id: userId }, { projection: { refreshTokens: 1 } });
    if (!user?.refreshTokens?.length) return;
    let matchJti = null;
    for (const r of user.refreshTokens) {
        const ok = await bcrypt.compare(rawToken, r.hash);
        if (ok) { matchJti = r.jti; break; }
    }
    if (matchJti) {
        await Users.updateOne({ _id: userId }, { $pull: { refreshTokens: { jti: matchJti } } });
    }
}

/* Brute-force limiters */
const emailLimiter = new RateLimiterMongo({
    storeClient: usersDb,
    dbName: usersDb.databaseName,
    tableName: "rl_email",
    points: 5,
    duration: 15 * 60,
    blockDuration: 15 * 60,
});
const ipLimiter = new RateLimiterMongo({
    storeClient: usersDb,
    dbName: usersDb.databaseName,
    tableName: "rl_ip",
    points: 20,
    duration: 15 * 60,
    blockDuration: 15 * 60,
});

// Express-rate-limit (route-level)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: "Too many attempts, please try again later." },
});

/* Cookies */
const cookieOpts = {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/auth",
};

/* Routes */

// Register new user and send email verification link
router.post('/register', async (req, res) => {
    try {
        const { email, password, displayName } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const normalized = String(email).trim().toLowerCase();
        const exists = await Users.findOne({ email: normalized });
        if (exists) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const userDoc = {
            email: normalized,
            displayName: displayName || normalized.split('@')[0],
            passwordHash,
            refreshTokens: [],
            emailVerified: false,    // Assume false to ensure verification
            createdAt: new Date(),
        };

        const { insertedId } = await Users.insertOne(userDoc);

        // Queue email verification for new user
        queueVerifyEmail({
            _id: insertedId,
            email: userDoc.email,
            displayName: userDoc.displayName,
        }).catch(err => {
            console.error("queueVerifyEmail failed:", err);
        });

        return res.status(201).json({
            ok: true,
            userId: String(insertedId),
            email: userDoc.email,
        });
    } catch (e) {
        console.error("REGISTER ERROR:", e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
});

/*router.post('/refresh', async (req, res) => {
    try {
        const token = req.cookies?.rt;
        if (!token) return res.status(401).json({ error: 'Missing refresh cookie' });

        let payload;
        try {
            payload = verifyByKid(token);
        } catch {
            return res.status(401).json({ error: 'Invalid/expired refresh token' });
        }

        /*const user = await Users.findOne(
            { _id: usersDb.bson.ObjectId.createFromHexString(payload.sub) },
            { projection: { email: 1, displayName: 1, refreshTokens: 1 } }
        );*/
/*
	const { ObjectId } = usersDb.bson;

	let userId;
	try {
    		userId = new ObjectId(payload.sub);
	} catch (err) {
    		return res.status(401).json({ error: "Invalid refresh token subject" });
	}

	const user = await Users.findOne(
    		{ _id: userId },
    		{ projection: { email: 1, displayName: 1, refreshTokens: 1 } }
	);

        if (!user) return res.status(401).json({ error: 'User not found' });

        // Ensure token matches a stored hashed one
        let matched = false;
        for (const r of user.refreshTokens || []) {
            if (await bcrypt.compare(token, r.hash)) { matched = true; break; }
        }
        if (!matched) return res.status(401).json({ error: 'Refresh token not recognized' });

        // Rotate
        await removeRefresh(user._id, token);
        const newJti = crypto.randomUUID();
        const newRefresh = signRefresh(user, newJti);
        await storeRefresh(user._id, newJti, newRefresh);

        const newAccess = signAccess(user);
        res.cookie('rt', newRefresh, { ...cookieOpts, maxAge: 1000 * 60 * 60 * 24 * 30 });

        return res.json({
            accessToken: newAccess,
            user: {
                id: String(user._id),
                email: user.email,
                displayName: user.displayName,
            },
        });
    } catch (e) {
        return res.status(500).json({ error: String(e?.message || e) });
    }
});*/

router.post("/refresh", async (req, res) => {
    try {
        const token = req.cookies?.rt;
        if (!token) {
            return res.status(401).json({ error: "Missing refresh cookie" });
        }

        // --- verify JWT itself ---
        let payload;
        try {
            payload = verifyByKid(token);
        } catch (err) {
            console.error("REFRESH verifyByKid failed:", err);
            return res.status(401).json({ error: "Invalid/expired refresh token" });
        }

        if (!payload?.sub) {
            return res.status(401).json({ error: "Invalid refresh token payload" });
        }

        let sub = String(payload.sub);
        const m = sub.match(/^ObjectId\("([0-9a-fA-F]{24})"\)$/);
        if (m) sub = m[1];

        let userId;
        try {
            userId = new ObjectId(sub);   // uses the imported { ObjectId } from "mongodb"
        } catch (err) {
            console.error("REFRESH invalid sub / ObjectId:", payload.sub, err);
            return res.status(401).json({ error: "Invalid refresh token subject" });
        }


        const user = await Users.findOne(
            { _id: userId },
            { projection: { email: 1, displayName: 1, refreshTokens: 1 } }
        );
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        let matched = false;
        for (const r of user.refreshTokens || []) {
            try {
                if (await bcrypt.compare(token, r.hash)) {
                    matched = true;
                    break;
                }
            } catch (cmpErr) {
                console.error("REFRESH bcrypt.compare error:", cmpErr);
            }
        }
        if (!matched) {
            return res.status(401).json({ error: "Refresh token not recognized" });
        }

        await removeRefresh(user._id, token);

        const newJti = crypto.randomUUID();
        const newRefresh = signRefresh(user, newJti);
        await storeRefresh(user._id, newJti, newRefresh);

        const newAccess = signAccess(user);

        res.cookie("rt", newRefresh, {
            ...cookieOpts,
            maxAge: 1000 * 60 * 60 * 24 * 30,
        });

        return res.json({
            accessToken: newAccess,
            user: {
                id: String(user._id),
                email: user.email,
                displayName: user.displayName,
            },
        });
    } catch (e) {
        console.error("REFRESH route fatal error:", e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
});



// Login (rate-limited)- requires verified email, issues access and refresh tokens
router.post('/login', async (req, res) => {
    try {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const normalized = String(email).trim().toLowerCase();
        await Promise.all([
            ipLimiter.consume(ip).catch((rej) => { throw { rej }; }),
            emailLimiter.consume(normalized).catch((rej) => { throw { rej }; }),
        ]);

        const user = await Users.findOne({ email: normalized });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify email before logging in
        if (!user.emailVerified) {
            return res.status(403).json({
                error: 'Please verify your email address before logging in. Check your inbox (and spam folder).',
                needsVerification: true,
            });
        }

        const access = signAccess(user);
        const jti = crypto.randomUUID();
        const refresh = signRefresh(user, jti);
        await storeRefresh(user._id, jti, refresh);

        await Promise.allSettled([
            emailLimiter.delete(normalized),
            ipLimiter.delete(ip),
        ]);

        res.cookie('rt', refresh, { ...cookieOpts, maxAge: 1000 * 60 * 60 * 24 * 30 });
        return res.json({
            accessToken: access,
            user: { id: String(user._id), email: user.email, displayName: user.displayName },
        });
    } catch (e) {
        if (e?.rej?.msBeforeNext !== undefined) {
            const secs = Math.ceil(e.rej.msBeforeNext / 1000);
            return res.status(429).json({ error: `Too many attempts. Try again in ${secs}s.` });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
    }
});


// Logout
router.post("/logout", async (req, res) => {
    try {
        const token = req.cookies?.rt;
        if (token) {
            try {
                const { sub } = verifyByKid(token);
                await removeRefresh(usersDb.bson.ObjectId.createFromHexString(sub), token);
            } catch {}
        }
        res.clearCookie("rt", { ...cookieOpts, maxAge: undefined });
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: String(e?.message || e) });
    }
});

/* Email flows (rate limited) */
router.post("/resend-verification", authLimiter, async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = await Users.findOne({ email: String(email).trim().toLowerCase() }, { projection: { email:1, emailVerified:1 } });
    if (!user || user.emailVerified) return res.json({ ok: true });

    await EmailVerifications.deleteMany({ userId: user._id });
    await queueVerifyEmail(user);
    return res.json({ ok: true });
});

// Handle click on email verification link
router.get("/verify-email", async (req, res) => {
    const { token, u } = req.query || {};
    console.log("DEBUG verify-email query:", req.query);

    if (!token || !u) return res.status(400).send("Invalid link");

    if (!ObjectId.isValid(String(u))) {
        return res.status(400).send("Invalid link");
    }
    const userId = new ObjectId(String(u));

    const doc = await EmailVerifications.findOne({ userId });
    if (!doc) return res.status(400).send("Link expired or already used");

    const ok = await tokenMatches(String(token), doc.hash);
    if (!ok || doc.expiresAt < new Date()) {
        return res.status(400).send("Link expired or invalid");
    }

    await Users.updateOne({ _id: userId }, { $set: { emailVerified: true } });
    await EmailVerifications.deleteMany({ userId });

    const redirectTo = new URL(
        "/verify-success", CLIENT_ORIGIN
    );
    return res.redirect(302, redirectTo.toString());
});


router.post("/forgot", authLimiter, async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) {
            // Don't leak anything; still return ok
            return res.status(200).json({ ok: true });
        }

        const normalized = String(email).trim().toLowerCase();

        const user = await Users.findOne(
            { email: normalized },
            { projection: { _id: 1, email: 1, emailVerified: 1 } }
        );

        console.log("[/forgot] request for:", normalized, "-> found:", !!user, "verified:", user?.emailVerified);

        if (!user) {
            // Email not in DB – respond the same so we don't leak which emails exist
            return res.status(200).json({ ok: true });
        }

        const isVerified = user.emailVerified === undefined ? true : !!user.emailVerified;
        if (!isVerified) {
            console.log("[/forgot] user exists but email not verified, skipping reset mail");
            return res.status(200).json({ ok: true });
        }

        const raw = newRawToken();
        const hash = await hashToken(raw);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await PasswordResets.deleteMany({ userId: user._id });
        await PasswordResets.insertOne({ userId: user._id, hash, expiresAt });

        const base = CLIENT_ORIGIN || process.env.CLIENT_ORIGIN || "http://localhost:5173";
        const url = new URL("/reset-password", base);
        url.searchParams.set("token", raw);
        url.searchParams.set("u", String(user._id));
        const link = url.toString();

        console.log("[/forgot] sending reset email to:", user.email, "link:", link);

        await sendMail({
            to: user.email,
            subject: "Reset your CineMatch password",
            text: `Reset your password: ${link}`,
            html: `<p>We received a password reset request. If this was you, click the button:</p>
                   <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Reset password</a></p>
                   <p>If you didn’t request this, ignore this email.</p>`,
        });

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("FORGOT ERROR:", err);
        // Still return ok so we don't leak anything to the client
        return res.status(200).json({ ok: true });
    }
});



/*router.post("/forgot", authLimiter, async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(200).json({ ok: true });

    const normalized = String(email).trim().toLowerCase();
    const user = await Users.findOne(
        { email: normalized },
        { projection: { _id: 1, email: 1, emailVerified: 1 } }
    );

    // if (user && user.emailVerified) {
    if (user) {
        const raw = newRawToken();
        const hash = await hashToken(raw);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await PasswordResets.deleteMany({ userId: user._id });
        await PasswordResets.insertOne({ userId: user._id, hash, expiresAt });

        const origin = CLIENT_ORIGIN || "http://localhost:5173"; // or whatever your dev client origin is
        const url = new URL("/reset-password", origin);
        url.searchParams.set("token", raw);
        url.searchParams.set("u", String(user._id));
        const link = url.toString();

        try {
            await sendMail({
                to: user.email,
                subject: "Reset your CineMatch password",
                text: `Reset your password: ${link}`,
                html: `<p>We received a password reset request. If this was you, click the button:</p>
                 <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Reset password</a></p>
                 <p>If you didn’t request this, ignore this email.</p>`,
            });
            console.log("[forgot] password reset email sent to", user.email);
        } catch (err) {
            console.error("[forgot] sendMail failed:", err);
            // you can still return ok: true here to avoid leaking info, but you now see the real error server-side
        }
    }

    return res.status(200).json({ ok: true });
});*/






// Start password reset flow
/*router.post("/forgot", authLimiter, async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(200).json({ ok: true });

    const normalized = String(email).trim().toLowerCase();
    const user = await Users.findOne({ email: normalized }, { projection: { _id:1, email:1, emailVerified:1 } });

    if (user && user.emailVerified) {
        const raw = newRawToken();
        const hash = await hashToken(raw);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await PasswordResets.deleteMany({ userId: user._id });
        await PasswordResets.insertOne({ userId: user._id, hash, expiresAt });

        const url = new URL("/reset-password", CLIENT_ORIGIN);
        url.searchParams.set("token", raw);
        url.searchParams.set("u", String(user._id));
        const link = url.toString();

        sendMail({
            to: user.email,
            subject: "Reset your CineMatch password",
            text: `Reset your password: ${link}`,
            html: `<p>We received a password reset request. If this was you, click the button:</p>
             <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Reset password</a></p>
             <p>If you didn’t request this, ignore this email.</p>`,
        });
    }

    return res.status(200).json({ ok: true });
});
*/

/*
router.post("/forgot", authLimiter, async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(200).json({ ok: true });

    const normalized = String(email).trim().toLowerCase();
    const user = await Users.findOne({ email: normalized }, { projection: { _id:1, email:1, emailVerified:1 } });

    if (user && user.emailVerified) {
        const raw = newRawToken();
        const hash = await hashToken(raw);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await PasswordResets.deleteMany({ userId: user._id });
        await PasswordResets.insertOne({ userId: user._id, hash, expiresAt });

        const url = new URL("/reset-password", CLIENT_ORIGIN);
        url.searchParams.set("token", raw);
        url.searchParams.set("u", String(user._id));
        const link = url.toString();

        sendMail({
            to: user.email,
            subject: "Reset your CineMatch password",
            text: `Reset your password: ${link}`,
            html: `<p>We received a password reset request. If this was you, click the button:</p>
             <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Reset password</a></p>
             <p>If you didn’t request this, ignore this email.</p>`,
        });
    }

    return res.status(200).json({ ok: true });
});
*/


// Complete password reset
router.post("/reset", async (req, res) => {
    const { token, u, password } = req.body || {};
    if (!token || !u || !password) {
        return res.status(400).json({ error: "Bad request" });
    }

    if (!ObjectId.isValid(String(u))) {
        return res.status(400).json({ error: "Bad request" });
    }
    const userId = new ObjectId(String(u));

    const doc = await PasswordResets.findOne({ userId });
    if (!doc) return res.status(400).json({ error: "Expired or invalid" });

    const ok = await tokenMatches(String(token), doc.hash);
    if (!ok || doc.expiresAt < new Date()) {
        return res.status(400).json({ error: "Expired or invalid" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await Users.updateOne({ _id: userId }, { $set: { passwordHash, refreshTokens: [] } });
    await PasswordResets.deleteMany({ userId });

    return res.json({ ok: true });
});

/*  Helpers  */
/*async function queueVerifyEmail(user) {
    const raw = newRawToken();
    const hash = await hashToken(raw);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await EmailVerifications.insertOne({ userId: user._id, hash, expiresAt });

    const apiBase = process.env.SERVER_ORIGIN || "http://localhost:3000/api";

    const url = new URL("/auth/verify-email", apiBase );
    url.searchParams.set("token", raw);
    url.searchParams.set("u", String(user._id));

    const link = url.toString();
    await sendMail({
        to: user.email,
        subject: "Confirm your CineMatch email",
        text: `Welcome to CineMatch! Confirm your email: ${link}`,
        html: `<p>Welcome to <b>CineMatch</b>! Click the button to confirm your email.</p>
           <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Confirm email</a></p>
           <p>If the button doesn’t work, copy this link:<br>${link}</p>`,
    });
}*/


async function queueVerifyEmail(user) {
    const raw = newRawToken();
    const hash = await hashToken(raw);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    await EmailVerifications.insertOne({ userId: user._id, hash, expiresAt });

    // This should be the *backend* origin (no /api here)
    const apiOrigin = process.env.SERVER_ORIGIN || "http://localhost:3000";

    // External URL we want users to click:
    //   https://cinematch.live/api/auth/verify-email?token=...&u=...
    const url = new URL("/api/auth/verify-email", apiOrigin);

    url.searchParams.set("token", raw);
    url.searchParams.set("u", String(user._id));

    const link = url.toString();

    await sendMail({
        to: user.email,
        subject: "Confirm your CineMatch email",
        text: `Welcome to CineMatch! Confirm your email: ${link}`,
        html: `<p>Welcome to <b>CineMatch</b>! Click the button to confirm your email.</p>
               <p><a href="${link}" style="padding:10px 16px; background:#222; color:#fff; text-decoration:none; border-radius:6px;">Confirm email</a></p>
               <p>If the button doesn’t work, copy this link:<br>${link}</p>`
    });
}



// Quick endpoint to test email is sending from the server
/*router.post("/test-email", async (req, res) => {
    try {
        const info = await sendMail({
            to: req.body.to || process.env.SMTP_USER,
            subject: "CineMatch test",
            text: "This is a test email from CineMatch.",
        });
        return res.json({ ok: true, id: info.messageId, resp: info.response });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
});*/

export default router;
