// start.js
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load BOTH env files before anything else
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'config.env') });
dotenv.config({ path: path.join(__dirname, 'auth.env') });

// Now load your app AFTER env is ready
await import('./server.js');
