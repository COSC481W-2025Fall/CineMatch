import express from "express";
import cors from "cors";
import records from "./routes/record.js";
import actors from "./routes/actors.js"
import directors from "./routes/directors.js";
import genre from "./routes/genre.js";

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/record/actors", actors); // Referencing actors endpoint for Vitest
app.use("/record/directors", directors); // Referencing directors endpoint for Vitest
app.use("/genre", genre); // Referencing genre endpoint for Vitest
app.use("/record", records); // Referencing record endpoint for Vitest (This can get all of the above)


import db from "./db/connection.js";
app.get("/__debug", async (_req, res) => {
  const names = await db.listCollections().toArray();
  const count = await db.collection("movies").countDocuments();
  res.json({ db: db.databaseName, collections: names.map(n => n.name), moviesCount: count });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
 