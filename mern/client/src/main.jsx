import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";  // Your App.jsx file
import "./App.css";

const root = createRoot(document.getElementById("root")); // grab the div
root.render(<App />); // render your React component into it
