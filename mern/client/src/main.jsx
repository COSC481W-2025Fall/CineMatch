// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import "./App.css";

import ToWatchList from "./components/ToWatchList.jsx";
import WatchList from "./components/WatchList.jsx";
import RecommendationFeed from "./components/RecommendationFeed.jsx";
import Help from "./components/Help.jsx";

import Login from "./components/Login.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import Register from "./components/Register.jsx";
import ResetPassword from "./auth/ResetPassword.jsx";
import ForgotPassword from "./auth/ForgotPassword.jsx";
import VerifyPending from "./components/VerifyPending.jsx";
import VerifySuccess from "./components/VerifySuccess.jsx";


const container = document.getElementById("root");
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-pending" element={<VerifyPending />} />
                <Route path="/verify-success" element={<VerifySuccess />} />
                <Route path="/to-watch-list" element={<ProtectedRoute><ToWatchList /></ProtectedRoute>} />
                <Route path="/watchlist" element={<ProtectedRoute><WatchList /></ProtectedRoute>}/>
                <Route path="/feed" element={<ProtectedRoute><RecommendationFeed /></ProtectedRoute>} />
                <Route path="/help" element={<Help />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
