// server.js
// ENV LOADING 
import 'dotenv/config';               // loads default .env if present
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Explicitly load config.env (app DB, PORT, etc.)
dotenv.config({ path: path.join(__dirname, 'config.env') });
// Explicitly load auth.env (JWT secrets, users DB, CLIENT_ORIGIN)
dotenv.config({ path: path.join(__dirname, 'auth.env') });


// IMPORTS 
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import records from './routes/record.js';
import actors from './routes/actors.js';
import directors from './routes/directors.js';
import genre from './routes/genre.js';
import feedRouter from './routes/feed.js';

// auth router + access guard
import authRouter from './routes/auth.js';
import meRouter from "./routes/me.js";


// APP SETUP 
const PORT = process.env.PORT || 5050;
const app = express();

// CORS: allow your frontend to call this API (and send cookies for refresh)
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: ORIGIN,
  credentials: true,                // allow cookies/authorization headers
}));

app.use(express.json());
app.use(cookieParser());
app.use("/api/me", meRouter);

// ROUTES 
// Auth endpoints (register, login, refresh, logout)
app.use('/auth', authRouter);


// Public data routes (leave these public unless you want to require auth)
app.use('/record/actors', actors);
app.use('/record/directors', directors);
app.use('/record/genre', genre);
app.use('/record', records);

// protect /feed with access token (change as you like)
app.use('/feed', feedRouter);

// DEBUG ENDPOINT 
import db from './db/connection.js';
app.get('/__debug', async (_req, res) => {
  try {
    const names = await db.listCollections().toArray();
    const count = await db.collection('movies').countDocuments();
    res.json({
      db: db.databaseName,
      collections: names.map(n => n.name),
      moviesCount: count,
      usersDb: process.env.USERS_DB_NAME || '(unset)',
      origin: ORIGIN,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});
console.log('[env] USERS_ATLAS_URI present:', !!process.env.USERS_ATLAS_URI);
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));