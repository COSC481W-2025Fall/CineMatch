import express from "express";
import cors from "cors";
import records from "./routes/record.js";

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/record", records); // ← keep /record OR update your frontend to /movie


import db from "./db/connection.js";
app.get("/__debug", async (_req, res) => {
  const names = await db.listCollections().toArray();
  const count = await db.collection("movies").countDocuments();
  res.json({ db: db.databaseName, collections: names.map(n => n.name), moviesCount: count });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
