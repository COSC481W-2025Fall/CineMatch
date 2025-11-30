// server/routes/me.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import usersDb from "../db/usersConnections.js";

const router = Router();
const Users = usersDb.collection("users");

// Helpers
function toObjectId(hex) {
    if (hex instanceof ObjectId) return hex;
    return ObjectId.createFromHexString(String(hex));
}

function asNumberArray(a) {
    if (!Array.isArray(a)) return [];
    return a
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n >= 0);
}

// Minimal access-token guard
function verifyAccess(req, res, next) {
    try {
        const hdr = req.header("authorization") || req.header("Authorization");
        if (!hdr || !hdr.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing bearer token" });
        }
        const token = hdr.slice(7);
        const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = { id: payload.sub, email: payload.email };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid/expired access token" });
    }
}

// Routes

// Return the user's watched and to-watch lists (arrays of numeric IDs)
router.get("/lists", verifyAccess, async (req, res) => {
    const _id = toObjectId(req.user.id);
    const doc = await Users.findOne(
        { _id },
        { projection: { _id: 0, watched: 1, "to-watch": 1 } }
    );

    return res.json({
        watched: Array.isArray(doc?.watched) ? doc.watched : [],
        "to-watch": Array.isArray(doc?.["to-watch"]) ? doc["to-watch"] : [],
    });
});

// Merge client-provided arrays into stored lists 
router.post("/lists/merge", verifyAccess, async (req, res) => {
    const _id = toObjectId(req.user.id);
    const bodyWatched = asNumberArray(req.body?.watched);
    const bodyToWatch = asNumberArray(req.body?.toWatchIds ?? req.body?.["to-watch"]);

    const doc = await Users.findOne(
        { _id },
        { projection: { watched: 1, "to-watch": 1 } }
    );

    const currentWatched = asNumberArray(doc?.watched);
    const currentToWatch = asNumberArray(doc?.["to-watch"]);

    const mergedWatched = [...new Set([...currentWatched, ...bodyWatched])];
    const mergedToWatch = [...new Set([...currentToWatch, ...bodyToWatch])];

    await Users.updateOne(
        { _id },
        { $set: { watched: mergedWatched, "to-watch": mergedToWatch } }
    );

    return res.json({
        ok: true,
        watched: mergedWatched,
        "to-watch": mergedToWatch,
    });
});

// Allow logged in user to add/remove movies from either 'Watched' or 'To-Watch' list
router.patch("/lists/:list", verifyAccess, async (req, res) => {
    const listParam = req.params.list; // "watched" | "to-watch"
    const list =
        listParam === "watched" || listParam === "to-watch" ? listParam : null;
    if (!list) return res.status(400).json({ error: "Unknown list name" });

    const action = req.body?.action;
    const idNum = Number(req.body?.id);
    if (!Number.isFinite(idNum)) {
        return res.status(400).json({ error: "id must be a number" });
    }

    // Convert the authenticated user's id into a MongoDB ObjectId
    const _id = toObjectId(req.user.id);

    if (action === "add") {
        // Add the movie id to the chosen list
        await Users.updateOne(
            { _id },
            { $addToSet: { [list]: idNum } }, // [list] is "watched" or "to-watch"
            { upsert: true }
        );
    } else if (action === "remove") {
        // Remove the movie id from the chosen list
        await Users.updateOne({ _id }, { $pull: { [list]: idNum } });
    } else {
        return res.status(400).json({ error: "action must be add or remove" });
    }

    return res.status(204).end();
});

// Return liked/disliked
router.get("/reactions", verifyAccess, async (req, res) => {
    const _id = toObjectId(req.user.id);

    const doc = await Users.findOne(
        { _id },
        { projection: { _id: 0, likedTmdbIds: 1, dislikedTmdbIds: 1 } }
    );

    return res.json({
        likedTmdbIds: asNumberArray(doc?.likedTmdbIds),
        dislikedTmdbIds: asNumberArray(doc?.dislikedTmdbIds),
    });
});

// Update a reaction for a single TMDB id
// body: { tmdbId, reaction: "like" | "dislike" | "clear" }
router.patch("/reactions/tmdb", verifyAccess, async (req, res) => {
    const _id = toObjectId(req.user.id);
    const idNum = Number(req.body?.tmdbId);
    const reaction = req.body?.reaction;

    if (!Number.isFinite(idNum) || idNum < 0) {
        return res.status(400).json({ error: "Invalid tmdbId" });
    }

    let update;
    if (reaction === "like") {
        update = {
            $addToSet: { likedTmdbIds: idNum },
            $pull: { dislikedTmdbIds: idNum },
        };
    } else if (reaction === "dislike") {
        update = {
            $addToSet: { dislikedTmdbIds: idNum },
            $pull: { likedTmdbIds: idNum },
        };
    } else if (reaction === "clear") {
        update = {
            $pull: { likedTmdbIds: idNum, dislikedTmdbIds: idNum },
        };
    } else {
        return res
            .status(400)
            .json({ error: "reaction must be like, dislike, or clear" });
    }

    const result = await Users.findOneAndUpdate(
        { _id },
        update,
        {
            returnDocument: "after",
            upsert: true,
            projection: { _id: 0, likedTmdbIds: 1, dislikedTmdbIds: 1 },
        }
    );

    return res.json({
        likedTmdbIds: asNumberArray(result.value?.likedTmdbIds),
        dislikedTmdbIds: asNumberArray(result.value?.dislikedTmdbIds),
    });
});

export default router;
