// server/db/usersConnections.js
import { MongoClient } from 'mongodb';

// A single MongoDB connection to your users database and exports for later use
const uri = process.env.USERS_ATLAS_URI;
const dbName = process.env.USERS_DB_NAME;

if (!uri) {
    throw new Error('USERS_ATLAS_URI is not set (auth.env)');
}
if (!dbName) {
    throw new Error('USERS_DB_NAME is not set (auth.env)');
}

const client = new MongoClient(uri, { maxPoolSize: 10 });
await client.connect();
const usersDb = client.db(dbName);

export default usersDb;