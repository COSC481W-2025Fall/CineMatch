// server/utils/oneTimeToken.js
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Helper file for secure one-time tokens

export function newRawToken() {
    return crypto.randomBytes(32).toString("hex"); // URL-safe once encoded
}

// Turn the raw token into a secure hash and store hash in database 
export async function hashToken(raw) {
    return bcrypt.hash(raw, 12);
}

// Check if a raw token matches a stored hash
export async function tokenMatches(raw, hash) {
    return bcrypt.compare(raw, hash);
}