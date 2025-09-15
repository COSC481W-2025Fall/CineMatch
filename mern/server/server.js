// THIS FILE IS ONLY FOR RUNNING LOCALLY, ANYONE DEPLOYING THIS WILL HAVE TO CHANGE THIS TO MAKE IT WORK FOR AWS AS OUTLINED BY THE GUIDE IN PROJECT GOOGLE DRIVE.
import express from "express";
import cors from "cors";
import records from "./routes/record.js";

const PORT = process.env.PORT || 5050;
const app = express();

app.use(cors());
app.use(express.json());
app.use("/record", records); 


import db from "./db/connection.js";
app.get("/__debug", async (_req, res) => {
  const names = await db.listCollections().toArray();
  const count = await db.collection("movies").countDocuments();
  res.json({ db: db.databaseName, collections: names.map(n => n.name), moviesCount: count });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
