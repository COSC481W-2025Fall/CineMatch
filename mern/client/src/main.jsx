import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";  
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ToWatchList from "./components/ToWatchList.jsx";

const root = createRoot(document.getElementById("root")).render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/to-watch-list" element={<ToWatchList />} />
        </Routes>
    </BrowserRouter>
); 
root.render(<App />); 