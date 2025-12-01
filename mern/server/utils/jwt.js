// mern/server/utils/jwt.js
import jwt from "jsonwebtoken";

// JWT helper module for signing and verifying access/refresh tokens

// Secrets and lifetimes are read from environment variables
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.JWT_ACCESS_TTL  || "15m";
const REFRESH_TTL    = process.env.JWT_REFRESH_TTL || "7d";

export function signAccess(payload) {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefresh(payload) {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

// Verify and decode an access token
export function verifyAccess(token) {
    return jwt.verify(token, ACCESS_SECRET);
}

// Verify and decode a refresh token
export function verifyRefresh(token) {
    return jwt.verify(token, REFRESH_SECRET);
}