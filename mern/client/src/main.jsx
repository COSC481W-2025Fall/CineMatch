import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ToWatchList from "./components/ToWatchList.jsx";
import WatchList from "./components/WatchList.jsx";
import RecommendationFeed from "./components/RecommendationFeed.jsx";
import Help from "./components/Help.jsx";

const root = createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/to-watch-list" element={<ToWatchList />} />
            <Route path="/watchlist" element={<WatchList />} />
            <Route path="/feed" element={<RecommendationFeed />} />
            <Route path="/help" element={<Help />} />
        </Routes>
    </BrowserRouter>
);
root.render(<App />);