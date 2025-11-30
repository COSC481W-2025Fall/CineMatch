// server/db/initUsersIndexes.js
// Startup helper to ensure MongoDB indexes exist for the users database
import { usersCol } from "./users.js";
import usersDb from "./usersConnections.js";
export default async function initUsersIndexes() {
    const col = usersCol();
    await col.createIndex({email: 1}, {unique: true})
    await usersDb.collection("login_audit").createIndex({ userId:1, ts:-1 });
}