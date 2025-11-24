// mern/server/middleware/requireAuth.js
import { verifyAccess } from "../utils/jwt.js";

// Express middleware to require a valid access token
export default function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const [, token] = auth.split(" ");
    if (!token) return res.status(401).json({ error: "Missing token" });

    try {
        // Verify the token using JWT helper
        const payload = verifyAccess(token);
        req.user = payload; // { id, email }
        next();
    } catch {
        return res.status(401).json({ error: "Invalid/expired token" });
    }
}