// server/db/users.js
import usersDb from "./usersConnection.js";
// Helper function to get the "users" collection
export function usersCol() { return usersDb.collection("users"); }
