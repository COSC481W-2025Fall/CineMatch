// server/security/rateLimit.js
import { RateLimiterMongo } from 'rate-limiter-flexible';
import usersDb from '../db/usersConnections.js';
import rateLimit from "express-rate-limit";

const mongo = usersDb; // Connect to the User's database 

// 5 tries per 15 minutes per email
export const emailLimiter = new RateLimiterMongo({
    storeClient: mongo,
    dbName: usersDb.databaseName,
    tableName: 'rl_email',
    points: 5,
    duration: 15 * 60,          // Seconds
    blockDuration: 15 * 60,     // Block for 15 min after exceeding
    keyPrefix: 'email',
});

// 20 tries per 15 minutes per IP (broader backstop)
export const ipLimiter = new RateLimiterMongo({
    storeClient: mongo,
    dbName: usersDb.databaseName,
    tableName: 'rl_ip',
    points: 20,
    duration: 15 * 60,
    blockDuration: 15 * 60,
    keyPrefix: 'ip',
});